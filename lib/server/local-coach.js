import ToJyutping from 'to-jyutping';
import { pinyin } from 'pinyin-pro';
import { jsonrepair } from 'jsonrepair';
import { SYSTEMS, ALTS, COMPARE, userMsg } from '../prompt.js';
import { ClientError, inputText } from './http.js';
import { requestRouter } from './openrouter.js';

const HAN = /[㐀-鿿]/;
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
const normPy = (s) => (s || '').toLowerCase().normalize('NFC').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean);
const toneless = (s) => s.normalize('NFD').replace(/[̀́̄̌]/g, '').normalize('NFC');

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

// Pinyin: accept any dictionary reading, a neutral-tone (unmarked) version of one, or any tone on 一/不 (tone sandhi).
function fixPinyin(w) {
  const chars = [...(w.hanzi || '')].filter((c) => HAN.test(c));
  const said = normPy(w.jyutping);
  if (!chars.length) return null;
  if (said.length !== chars.length) { w.dict = pinyin(w.hanzi, { type: 'array' }).join(' '); return null; }
  const ctx = pinyin(chars.join(''), { type: 'array' });
  return [said, said.map((s, i) => {
    const all = pinyin(chars[i], { multiple: true, type: 'array' });
    const ok = all.includes(s) || all.some((r) => toneless(r) === s) || ('一不'.includes(chars[i]) && all.some((r) => toneless(r) === toneless(s)));
    return ok ? s : ctx[i];
  })];
}

function checkReadings(v, lang) {
  for (const w of v.words || []) {
    const res = (lang === 'zh' ? fixPinyin : fixJyutping)(w);
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
  const model = process.env.OPENROUTER_TEXT_MODEL || 'anthropic/claude-sonnet-5.5';
  const signal = AbortSignal.timeout(55000);
  let cost = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await requestRouter({
      model, max_tokens: maxTokens,
      ...(model === 'anthropic/claude-sonnet-5.5' ? { reasoning: { effort: 'low' } } : {}),
      messages: [
        { role: 'system', content: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] },
        { role: 'user', content: user },
      ],
    }, signal);
    const answer = await response.json();
    if (answer.error) throw new ClientError(502, 'The language provider could not finish the request.');
    cost += Number(answer.usage?.cost) || 0;
    try {
      const out = parse(answer.choices[0].message.content);
      if (isValid(out)) return { out, cost };
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
  const text = inputText(body.text, 2000, 'Enter a phrase of up to 2,000 characters.');
  const lang = body.lang === 'zh' ? 'zh' : 'yue';
  if (body.mode === 'compare') {
    const yue = inputText(body.yue, 2000, 'Choose a Cantonese phrase to compare.');
    const zh = inputText(body.zh, 2000, 'Choose a Mandarin phrase to compare.');
    const { out, cost } = await ask(COMPARE, JSON.stringify({ english: text, cantonese: yue, mandarin: zh }), 1200,
      value => Array.isArray(value?.diffs) && value.diffs.length > 0 && value.diffs.every(diff => diff && [diff.yue, diff.zh, diff.note].every(entry => typeof entry === 'string')));
    return { diffs: out.diffs, cost };
  }
  const alternatives = body.mode === 'alts';
  const about = typeof body.about === 'string' ? body.about.slice(0, 1500) : '';
  const listener = typeof body.listener === 'string' ? body.listener.slice(0, 80) : '';
  const main = alternatives ? inputText(body.main, 2000, 'Choose the original phrase first.') : '';
  const level = body.level === 'full' ? 'full' : 'simple';
  const system = SYSTEMS[lang] + (alternatives ? '\n\n' + ALTS[lang] : '');
  const user = userMsg({ text, listener, about, main, level });
  const { out, cost } = await ask(system, user, 4000, alternatives
    ? value => Array.isArray(value?.alts) && value.alts.length >= 1 && value.alts.length <= 2 && value.alts.every(lesson)
    : lesson);
  if (alternatives) {
    for (const line of out.alts) checkReadings(line, lang);
    return { alts: out.alts, cost };
  }
  delete out.alts;
  delete out.alt;
  checkReadings(out, lang);
  return { ...out, lang, cost };
}
