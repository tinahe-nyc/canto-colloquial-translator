import ToJyutping from 'to-jyutping';
import { jsonrepair } from 'jsonrepair';
import { CANTONESE, ALTERNATIVES, userMsg } from '../prompt.js';
import { ClientError, inputText } from './http.js';
import { requestTranslation } from './providers.js';

const HAN = /[㐀-鿿]/;
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

// Second opinion on readings from a dictionary. A syllable the dictionary allows for that character
// (colloquial readings included) is kept; one it doesn't know is a model slip, so it's replaced in the word and the line.
function fixJyutping(w) {
  const cands = ToJyutping.getJyutpingCandidates(w.trad || w.hanzi).filter(([c, r]) => HAN.test(c) && r);
  const said = norm(w.jyutping);
  if (!cands.length) return null;
  if (said.length !== cands.length) { w.dict = norm(ToJyutping.getJyutpingText(w.trad || w.hanzi)).join(' '); return null; }
  const best = ToJyutping.getJyutpingList(w.trad || w.hanzi).filter(([c, r]) => HAN.test(c) && r).map(([, r]) => r);
  return [said, said.map((s, i) => (cands[i][1].length && !cands[i][1].includes(s) ? best[i] || cands[i][1][0] : s))];
}

function checkReadings(v) {
  for (const w of v.words || []) {
    const res = fixJyutping(w);
    if (!res) continue;
    const [said, fixed] = res;
    if (fixed.join(' ') !== said.join(' ')) {
      v.jyutping = (v.jyutping || '').replace(said.join(' '), fixed.join(' '));
      w.jyutping = fixed.join(' ');
      w.fixed = said.join(' ');
    }
  }
}

function parse(txt) {
  const s = txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1);
  try { return JSON.parse(s); } catch { return JSON.parse(jsonrepair(s)); } // stray quotes inside Chinese text are the usual culprit
}

async function ask(system, user, maxTokens, isValid) {
  const signal = AbortSignal.timeout(55000);
  const messages = [{ role: 'user', content: user }];
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const answer = await requestTranslation(system, messages, maxTokens, signal);
    cost = answer.cost === null ? null : cost + answer.cost;
    try {
      const out = parse(answer.content);
      if (isValid(out)) return { out, cost, source: answer.source };
    } catch { /* Retry malformed model output once. */ }
  }
  throw new ClientError(502, 'The coach could not make a complete lesson. Try a shorter phrase.');
}

const lesson = value => value && [value.hanzi, value.trad, value.jyutping, value.back].every(text => typeof text === 'string' && text.trim()) &&
  Array.isArray(value.words) && value.words.length > 0 && value.words.every(word =>
    word && [word.hanzi, word.trad, word.jyutping, word.meaning].every(text => typeof text === 'string')) &&
  Array.isArray(value.notes) && value.notes.every(note => note &&
    [note.english, note.chosen, note.note].every(text => typeof text === 'string'));

export async function localCoach(body) {
  if (body.lang !== undefined && body.lang !== 'yue') throw new ClientError(400, 'Kapok Club supports Cantonese.');
  if (body.mode !== undefined && !['main', 'alts'].includes(body.mode)) throw new ClientError(400, 'Unknown coach action.');
  const text = inputText(body.text, 2000, 'Enter a phrase of up to 2,000 characters.');
  const alternatives = body.mode === 'alts';
  const about = typeof body.about === 'string' ? body.about.slice(0, 1500) : '';
  const listener = typeof body.listener === 'string' ? body.listener.slice(0, 80) : '';
  const main = alternatives ? inputText(body.main, 2000, 'Choose the original phrase first.') : '';
  const level = body.level === 'full' ? 'full' : 'simple';
  const system = alternatives ? CANTONESE + '\n\n' + ALTERNATIVES : CANTONESE;
  const user = userMsg({ text, listener, about, main, level });
  const { out, cost, source } = await ask(system, user, 4000, alternatives
    ? value => Array.isArray(value?.alts) && value.alts.length >= 1 && value.alts.length <= 2 && value.alts.every(lesson)
    : lesson);
  if (alternatives) {
    for (const line of out.alts) checkReadings(line);
    return { alts: out.alts, cost, source };
  }
  delete out.alts;
  delete out.alt;
  checkReadings(out);
  return { ...out, lang: 'yue', cost, source };
}
