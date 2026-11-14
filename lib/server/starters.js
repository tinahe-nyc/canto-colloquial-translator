// Authored lessons are available when a deployment has no translation provider.
// They are fixed examples, independent of the selected listener and style.
function line(parts, punctuation, back, notes, tip) {
  const words = parts.map(([hanzi, trad, jyutping, meaning]) => ({ hanzi, trad, jyutping, meaning }));
  return {
    hanzi: words.map(w => w.hanzi).join('') + punctuation,
    trad: words.map(w => w.trad).join('') + punctuation,
    jyutping: words.map(w => w.jyutping).join(' '), back, words,
    notes: notes.map(([english, chosen, note]) => ({ english, chosen, note })), tip,
  };
}

const you = ['你', '你', 'nei5', 'you'];
const me = ['我', '我', 'ngo5', 'I'];
const wo = ['我', '我', 'wǒ', 'I'];
const home = ['返屋企', '返屋企', 'faan1 uk1 kei2', 'go home'];
const huiJia = ['回家', '回家', 'huí jiā', 'go home'];
const meal = ['饭', '飯', 'faan6', 'a meal'];
const eat = ['食', '食', 'sik6', 'eat'];
const done = ['咗', '咗', 'zo2', 'completed action'];
const yet = ['未', '未', 'mei6', 'yet?'];
const ma = ['吗', '嗎', 'ma', 'question marker'];
const le = ['了', '了', 'le', 'signals a change or completion'];

export const starterPhrases = ['Have you eaten yet?', "I'm going home now.", "I'm tired."];
const lessons = [
  {
    cantonese: [
      line([you, eat, done, meal, yet], '？', 'Have you eaten a meal yet?', [
        ['eaten', '食咗', 'Sik6 is the everyday verb for eating. Zo2 marks the action as done.'],
        ['yet?', '未', 'Ending with mei6 asks whether it has happened yet.'],
      ], 'Keep faan6 and mei6 low and level.'),
      line([eat, done, meal, yet], '？', 'Eaten a meal yet?', [
        ['you', '食咗饭未', 'When you are facing the listener, you can leave “you” out.'],
        ['a meal', '饭', 'Faan6 can mean a meal as well as rice.'],
      ], 'Keep the last syllable low. The question already comes through in mei6.'),
    ],
    mandarin: [
      line([['你', '你', 'nǐ', 'you'], ['吃饭', '吃飯', 'chī fàn', 'eat a meal'], le, ma], '？', 'Have you eaten a meal?', [
        ['eat', '吃饭', 'Chī fàn is the everyday way to say “eat a meal.”'],
        ['yet?', '了吗', 'Le ma asks whether the action has happened by now.'],
      ], 'Keep le and ma short and light.'),
      line([['吃过', '吃過', 'chī guo', 'have eaten'], ['饭', '飯', 'fàn', 'a meal'], ['没', '沒', 'méi', 'or not?']], '？', 'Had a meal or not?', [
        ['you', '吃过饭没', 'You can drop the subject when speaking directly to someone.'],
        ['yet?', '没', 'Ending with méi makes this a short, casual question.'],
      ], 'Let méi rise.'),
    ],
    difference: 'Cantonese uses 食 (sik6) for “eat” and closes the question with 未 (mei6, “yet?”). Mandarin uses 吃 (chī) and can end with 了吗 (le ma).',
  },
  {
    cantonese: [
      line([me, ['而家', '而家', 'ji4 gaa1', 'now'], home], '。', 'I’m going home now.', [
        ['now', '而家', 'Ji4 gaa1 is the everyday word for “now.”'],
        ['go home', '返屋企', 'Faan1 means to return. Uk1 kei2 means home.'],
      ], 'Say uk1 briefly and let kei2 rise.'),
      line([me, home, ['喇', '喇', 'laa3', 'announces a change']], '。', 'I’m heading home now.', [
        ['now', '喇', 'Laa3 lets the listener know you are about to go.'],
        ['go home', '返屋企', 'The direction is clear from faan1, so you do not need a separate “go.”'],
      ], 'Keep laa3 light and level.'),
    ],
    mandarin: [
      line([wo, ['现在', '現在', 'xiàn zài', 'now'], huiJia], '。', 'I’m going home now.', [
        ['now', '现在', 'Xiàn zài puts the timing right before the action.'],
        ['go home', '回家', 'Huí jiā is the usual way to say “go home.”'],
      ], 'Xiàn and zài both fall. Keep the first fall short so the words flow together.'),
      line([wo, huiJia, le], '。', 'I’m heading home now.', [
        ['now', '了', 'At the end of a departure announcement, le signals a change of plans or activity.'],
        ['go home', '回家', 'The verb huí already carries the idea of returning.'],
      ], 'Say jiā high and level, then let le trail off lightly.'),
    ],
    difference: 'Everyday Cantonese says 返屋企 (faan1 uk1 kei2) for “go home.” Mandarin uses 回家 (huí jiā). Both can put “now” before this action.',
  },
  {
    cantonese: [
      line([me, ['好', '好', 'hou2', 'quite / linking word'], ['攰', '攰', 'gui6', 'tired']], '。', 'I’m tired.', [
        ['tired', '攰', 'Gui6 describes an everyday feeling of tiredness.'],
        ['I’m', '我好攰', 'Hou2 links the description naturally. With ordinary stress it need not mean “very.”'],
      ], 'Keep the last syllable gui6 low and level.'),
      line([me, ['攰', '攰', 'gui6', 'tired'], ['喇', '喇', 'laa3', 'now / change of state']], '。', 'I’m feeling tired now.', [
        ['tired', '攰', 'The short word gui6 is enough to describe how you feel.'],
        ['now', '喇', 'This version suggests the tiredness has set in.'],
      ], 'Go from low gui6 to a light, level laa3.'),
    ],
    mandarin: [
      line([wo, ['很', '很', 'hěn', 'links a description'], ['累', '累', 'lèi', 'tired']], '。', 'I’m tired.', [
        ['tired', '累', 'Lèi is the everyday word for feeling tired.'],
        ['I’m', '我很累', 'An unstressed hěn makes this a plain description.'],
      ], 'Wǒ and hěn both have dictionary tone 3. In speech the first one rises, as if it were wó.'),
      line([wo, ['累', '累', 'lèi', 'tired'], le], '。', 'I’m tired now.', [
        ['tired', '累', 'Lèi gives the feeling directly in one syllable.'],
        ['now', '了', 'This version suggests you have become tired.'],
      ], 'Let lèi fall and keep le light.'),
    ],
    difference: 'Cantonese uses 攰 (gui6), while Mandarin uses 累 (lèi). In an ordinary description, 好 (hou2) and 很 (hěn) can sound natural without adding strong emphasis.',
  },
];

function normalize(english) {
  return english.toLowerCase().replaceAll('’', "'").replace(/[.!?]+$/u, '').trim().replace(/\s+/gu, ' ');
}

export function starterLesson(english) {
  const index = starterPhrases.findIndex(phrase => normalize(phrase) === normalize(english));
  return lessons[index];
}
