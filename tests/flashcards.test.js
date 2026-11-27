import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { starterLesson } from '../lib/server/starters.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\ninitialize\(\);\s*$/, '');
const phrase = "I'm tired.";
const [main, alternate] = starterLesson(phrase).cantonese;

function coach(storage = new Map()) {
  const context = createContext({
    window: {},
    document: { addEventListener() {}, querySelector: () => ({ value: phrase }) },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    main: structuredClone(main),
    alternate: structuredClone(alternate),
  });
  runInContext(script, context);
  return code => runInContext(code, context);
}

test('translation and alternatives stay in the phrasebook until individual versions are selected', async () => {
  const storage = new Map();
  const run = coach(storage);
  await run(`
    render = () => {};
    api = async body => body.mode === 'alts' ? { alts: [alternate] } : { ...main, source: 'starter' };
    (async () => { await translate(true); await loadAlts(state.result); })();
  `);
  assert.equal(run('state.history.length'), 1);
  assert.equal(run('cards().length'), 0);
  const stored = JSON.parse(storage.get('canto:history'));
  assert.equal(stored[0].result.alts[0].hanzi, alternate.hanzi);
  assert.deepEqual(stored[0].flashcards, []);

  assert.equal(run('toggleFlashcard(state.history[0], alternate.hanzi)'), true);
  assert.deepEqual(Array.from(run('cards().map(card => card.hanzi)')), [alternate.hanzi]);
  assert.equal(run('cards()[0].en'), alternate.back);
  assert.equal(run('toggleFlashcard(state.history[0], main.hanzi)'), true);
  assert.deepEqual(Array.from(coach(storage)('cards().map(card => card.hanzi)')), [main.hanzi, alternate.hanzi]);

  assert.equal(run('toggleFlashcard(state.history[0], alternate.hanzi)'), true);
  assert.deepEqual(Array.from(coach(storage)('cards().map(card => card.hanzi)')), [main.hanzi]);
  assert.deepEqual(Array.from(run(`state.deck = 'words'; cards().map(card => card.hanzi)`)), main.words.map(word => word.hanzi));
});

test('older phrasebook entries keep their main card and review schedule', () => {
  const reviewKey = 'say|l:' + main.hanzi;
  const storage = new Map([
    ['canto:history', JSON.stringify([{ input: phrase, listener: 'My parents', result: { ...main, alts: [alternate] } }])],
    ['canto:srs', JSON.stringify({ [reviewKey]: { box: 3, due: 999999 } })],
  ]);
  const run = coach(storage);
  assert.deepEqual(Array.from(run('cards().map(card => card.hanzi)')), [main.hanzi]);
  assert.equal(run('prog(cards()[0]).box'), 3);
  assert.equal(run('toggleFlashcard(state.history[0], main.hanzi)'), true);
  assert.equal(coach(storage)('cards().length'), 0);
});
