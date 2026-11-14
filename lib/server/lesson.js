import { getJyutpingCandidates } from 'to-jyutping';
import { pinyin } from 'pinyin-pro';

const han = /\p{Script=Han}/u;
const lexical = (text) => text.replace(/[\p{P}\p{Z}\s]/gu, '');
const plain = (text) => text.normalize('NFD').replace(/[\u0300\u0301\u0304\u030c]/gu, '').normalize('NFC');

function field(object, key, max = 600) {
  const value = object?.[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Incomplete ' + key);
  return value.trim();
}

function array(object, key, min, max) {
  const value = object?.[key];
  if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Incomplete ' + key);
  return value;
}

export function checkReading(word, language) {
  const text = language === 'cantonese' ? word.trad : word.hanzi;
  const chars = [...text];
  // English names, numbers and code-switching can have non-character-aligned readings.
  if (!chars.every(c => han.test(c))) return word.jyutping;
  const syllables = word.jyutping.toLowerCase().normalize('NFC').split(/[\s'’-]+/u);
  if (syllables.length !== chars.length) throw new Error('Syllable count mismatch');

  if (language === 'cantonese') {
    const candidates = getJyutpingCandidates(text);
    return syllables.map((value, i) => {
      const allowed = candidates[i]?.[1] || [];
      if (!allowed.length && !/^[a-z]+[1-6]$/.test(value)) throw new Error('Invalid Jyutping');
      return !allowed.length || allowed.includes(value) ? value : allowed[0];
    }).join(' ');
  }

  const context = pinyin(text, { type: 'array', toneSandhi: false });
  return syllables.map((value, i) => {
    const allowed = pinyin(chars[i], { multiple: true, type: 'array', toneSandhi: false });
    if (allowed.includes(value)) return value;
    const base = plain(value);
    const baseAllowed = allowed.some(option => plain(option) === base);
    if (baseAllowed && (base === value || chars[i] === '一' || chars[i] === '不')) return value;
    return context[i] || allowed[0] || value;
  }).join(' ');
}

export function validateLesson(raw, language) {
  const words = array(raw, 'words', 1, 96).map(word => {
    const result = {
      hanzi: field(word, 'hanzi', 96), trad: field(word, 'trad', 96),
      jyutping: field(word, 'jyutping', 320), meaning: field(word, 'meaning', 240),
    };
    result.jyutping = checkReading(result, language);
    return result;
  });
  const hanzi = field(raw, 'hanzi', 500);
  const trad = field(raw, 'trad', 500);
  field(raw, 'jyutping', 3000);
  if (lexical(words.map(w => w.hanzi).join('')) !== lexical(hanzi) ||
      lexical(words.map(w => w.trad).join('')) !== lexical(trad)) throw new Error('Word breakdown mismatch');
  return {
    hanzi, trad, jyutping: words.map(w => w.jyutping).join(' '), words,
    back: field(raw, 'back', 1600),
    notes: array(raw, 'notes', 2, 5).map(note => ({
      english: field(note, 'english', 180), chosen: field(note, 'chosen', 180), note: field(note, 'note', 560),
    })),
    tip: field(raw, 'tip', 560),
  };
}
