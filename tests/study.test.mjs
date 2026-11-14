import {test} from "node:test";
import assert from "node:assert/strict";

globalThis.window = {};
await import("../src/study.js");
const {scheduleReview, studyCards} = window.Study;

test("a missed card returns to today and a remembered card advances by local calendar days", () => {
  const now = new Date(2026, 9, 31, 23, 30);
  let card;
  for (const due of ["2026-11-01", "2026-11-03", "2026-11-07", "2026-11-16", "2026-12-05", "2026-12-05"]) {
    card = scheduleReview("phrase", card, true, now);
    assert.equal(card.due, due);
    assert.equal(card.completed, "2026-10-31");
  }
  const retry = scheduleReview("phrase", card, false, now);
  assert.equal(retry.due, "2026-10-31");
  assert.equal(retry.completed, null);
  assert.equal(retry.box, 0);
  assert.equal(scheduleReview("phrase", retry, true, now).due, "2026-11-01");
});

test("a bilingual phrase and its alternate yield distinct line cards but shared words enter the deck once", () => {
  const word = {hanzi:"食", jyutping:"sik6", meaning:"eat"};
  const entry = {
    english:"Have you eaten?",
    results:{
      cantonese:{hanzi:"食咗未？", jyutping:"sik6 zo2 mei6", words:[word]},
      mandarin:{hanzi:"吃了吗？", jyutping:"chī le ma", words:[{hanzi:"吃", jyutping:"chī", meaning:"eat"}]}
    },
    alternatives:{cantonese:[{hanzi:"食咗饭未？", jyutping:"sik6 zo2 faan6 mei6", back:"Have you eaten a meal?", words:[word]}]}
  };
  const lines = studyCards([entry, entry], "line");
  assert.equal(lines.length, 3);
  assert.ok(lines.some(card => card.prompt === "Have you eaten a meal?"));
  assert.equal(studyCards([entry, entry], "word").length, 2);
});
