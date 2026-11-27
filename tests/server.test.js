import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import translate from '../api/translate.js';
import speak from '../api/speak.js';
import { validateLesson, checkReading } from '../lib/server/lesson.js';
import { starterLesson, starterPhrases } from '../lib/server/starters.js';

function call(handler, data, cookie = '', method = 'POST') {
  const headers = {};
  const req = { method, headers: { cookie, 'content-type': 'application/json' }, body: data };
  const res = { setHeader(name, value) { headers[name] = value; }, end(value) { this.body = value; } };
  return handler(req, res).then(() => ({
    status: res.statusCode, headers,
    data: headers['Content-Type']?.startsWith('application/json') ? JSON.parse(res.body) : res.body,
  }));
}

async function withServer(t, providerReady = false) {
  const envKeys = ['APP_PASSCODE', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'ANTHROPIC_TEXT_MODEL'];
  const old = envKeys.map(key => [key, process.env[key]]);
  const code = randomUUID();
  process.env.APP_PASSCODE = code;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_TEXT_MODEL;
  if (providerReady) process.env.OPENROUTER_API_KEY = 'sk-or-v1-local-test-only';
  else delete process.env.OPENROUTER_API_KEY;
  t.after(() => {
    for (const [key, value] of old) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const login = await call(translate, { action: 'login', passcode: code });
  assert.equal(login.status, 200);
  assert.match(login.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
  return login.headers['Set-Cookie'].split(';')[0];
}

test('a friend can reopen a session and practice an exact starter without provider access', async t => {
  const cookie = await withServer(t);
  assert.equal((await call(translate, {}, '', 'GET')).data.authenticated, false);
  assert.equal((await call(translate, {}, cookie, 'GET')).data.authenticated, true);
  const input = { action: 'translate', english: starterPhrases[0], language: 'cantonese' };
  const lesson = await call(translate, input, cookie);
  assert.equal(lesson.data.source, 'starter');
  assert.equal(lesson.data.result.hanzi, '你食咗饭未？');
  const alternatives = await call(translate, { ...input, action: 'alternatives', result: lesson.data.result }, cookie);
  assert.equal(alternatives.data.alternatives[0].hanzi, '食咗饭未？');
  assert.equal((await call(translate, { ...input, english: 'Have you eaten an apple yet?' }, cookie)).status, 503);
  assert.equal((await call(translate, input, '')).status, 401);
  assert.equal((await call(speak, { text: '饭', language: 'cantonese' })).status, 401);
  process.env.APP_PASSCODE = randomUUID();
  assert.equal((await call(translate, {}, cookie, 'GET')).data.authenticated, false);
});

test('public starters serve the authored Cantonese lessons and retired modes cannot reach providers', async t => {
  const cookie = await withServer(t, true);
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected network request'); });
  const visitor = { english: starterPhrases[0], language: 'cantonese' };
  const main = await call(translate, { ...visitor, action: 'starter' });
  assert.equal(main.status, 200);
  assert.equal(main.headers['Set-Cookie'], undefined);
  assert.equal(main.data.source, 'starter');
  assert.equal(main.data.result.hanzi, starterLesson(visitor.english).cantonese[0].hanzi);
  const alternatives = await call(translate, { ...visitor, action: 'starter-alternatives' });
  assert.deepEqual(alternatives.data.alternatives, starterLesson(visitor.english).cantonese.slice(1));
  for (const action of ['starter', 'starter-alternatives']) {
    assert.equal((await call(translate, { ...visitor, action, english: 'My custom phrase.' })).status, 400);
    assert.equal((await call(translate, { ...visitor, action, language: 'mandarin' })).status, 400);
  }
  for (const action of ['translate', 'alternatives', 'compare', 'practice', 'recent-practice']) {
    assert.equal((await call(translate, { ...visitor, action })).status, 401);
  }
  for (const action of ['starter-compare', 'compare']) {
    assert.equal((await call(translate, { ...visitor, action }, cookie)).status, 400);
  }
  assert.equal((await call(translate, { action: 'coach', lang: 'zh', text: visitor.english }, cookie)).status, 400);
  assert.equal((await call(translate, { action: 'coach', mode: 'compare', text: visitor.english }, cookie)).status, 400);
  assert.equal((await call(speak, { text: main.data.result.hanzi, language: 'mandarin' }, cookie)).status, 400);
  assert.equal(network.mock.callCount(), 0);
});

test('all authored lessons align both scripts with their word breakdown', () => {
  for (const phrase of starterPhrases) {
    const lesson = starterLesson(phrase);
    for (const language of ['mandarin', 'cantonese']) {
      for (const line of lesson[language]) {
        const checked = validateLesson(line, language);
        assert.equal(checked.jyutping, line.jyutping);
      }
    }
  }
});

test('corrects unsupported readings while preserving alternate, neutral and flexible readings', () => {
  assert.equal(checkReading({ trad: '屋企', jyutping: 'uk1 kei5' }, 'cantonese'), 'uk1 kei5');
  assert.equal(checkReading({ trad: '屋企', jyutping: 'uk1 wrong6' }, 'cantonese'), 'uk1 kei2');
  assert.equal(checkReading({ hanzi: '你好', jyutping: 'nǐ mà' }, 'mandarin'), 'nǐ hǎo');
  assert.equal(checkReading({ hanzi: '好', jyutping: 'hào' }, 'mandarin'), 'hào');
  assert.equal(checkReading({ hanzi: '不', jyutping: 'bú' }, 'mandarin'), 'bú');
  assert.equal(checkReading({ hanzi: '妈', jyutping: 'ma' }, 'mandarin'), 'ma');
  assert.equal(checkReading({ hanzi: '女', jyutping: 'nu' }, 'mandarin'), 'nǚ');
});

test('an incomplete provider lesson retries once, repairs syntax, and fixes readings', async t => {
  const cookie = await withServer(t, true);
  const lesson = structuredClone(starterLesson(starterPhrases[0]).cantonese[0]);
  lesson.words[0].jyutping = 'nope1';
  const outputs = [JSON.stringify({ words: [] }), JSON.stringify(lesson).replace(/}$/, ',}')];
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.equal(request.messages[0].content[0].cache_control.type, 'ephemeral');
    return Response.json({ choices: [{ message: { content: outputs[requests++] } }] });
  });
  const res = await call(translate, { action: 'translate', english: 'Have you eaten?', language: 'cantonese' }, cookie);
  assert.equal(res.status, 200);
  assert.equal(res.data.source, 'openrouter');
  assert.equal(requests, 2);
  assert.equal(res.data.result.jyutping.split(' ')[0], 'nei5');
});

test('the new coach uses the existing session and reports the cost of both generation attempts', async t => {
  const cookie = await withServer(t, true);
  const lesson = structuredClone(starterLesson(starterPhrases[0]).cantonese[0]);
  lesson.words[0].jyutping = 'wrong1';
  lesson.jyutping = lesson.jyutping.replace('nei5', 'wrong1');
  const answers = ['{"words":[]}', JSON.stringify(lesson)];
  const network = t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.match(request.messages[1].content, /Keep the context/);
    return Response.json({
      choices: [{ message: { content: answers.shift() } }], usage: { cost: 0.01 },
    });
  });
  const input = { action: 'coach', text: 'Have you eaten yet?', about: 'Keep the context' };
  assert.equal((await call(translate, input)).status, 401);
  assert.equal(network.mock.callCount(), 0);
  const response = await call(translate, input, cookie);
  assert.equal(response.status, 200);
  assert.equal(response.data.lang, 'yue');
  assert.equal(response.data.jyutping.split(' ')[0], 'nei5');
  assert.equal(response.data.cost, 0.02);
  assert.equal(network.mock.callCount(), 2);
});

test('a direct Claude key enables custom lessons and stays off the audio endpoint', async t => {
  const cookie = await withServer(t);
  const key = 'sk-ant-api03-local-test-only';
  process.env.ANTHROPIC_API_KEY = key;
  const lesson = starterLesson(starterPhrases[0]).cantonese[0];
  const network = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    assert.equal(init.headers['anthropic-version'], '2026-10-21');
    const body = JSON.parse(init.body);
    assert.equal(body.model, 'claude-sonnet-5-5');
    assert.match(body.system, /Cantonese speaking coach/);
    assert.match(body.messages[0].content, /My parents/);
    return Response.json({ content: [{ type: 'thinking', thinking: 'internal' }, { type: 'text', text: JSON.stringify(lesson) }] });
  });
  const status = await call(translate, {}, cookie, 'GET');
  assert.equal(status.data.providerReady, true);
  assert.equal(status.data.audioReady, false);
  const result = await call(translate, { action: 'coach', text: 'Have you eaten?', listener: 'My parents' }, cookie);
  assert.equal(result.status, 200);
  assert.equal(result.data.source, 'anthropic');
  assert.equal(result.data.hanzi, lesson.hanzi);
  assert.equal(result.data.cost, null);
  assert.equal((await call(speak, { text: lesson.hanzi, language: 'cantonese' }, cookie)).status, 503);
  assert.equal(network.mock.callCount(), 1);
});

test('an OpenRouter key under the Anthropic name is sent only to OpenRouter', async t => {
  const cookie = await withServer(t);
  const key = 'sk-or-v1-alias-test-only';
  process.env.ANTHROPIC_API_KEY = key;
  const lesson = starterLesson(starterPhrases[0]).cantonese[0];
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(init.headers.Authorization, `Bearer ${key}`);
    return Response.json({ choices: [{ message: { content: JSON.stringify(lesson) } }] });
  });
  const status = await call(translate, {}, cookie, 'GET');
  assert.equal(status.data.audioReady, true);
  const result = await call(translate, { action: 'coach', text: 'Have you eaten?' }, cookie);
  assert.equal(result.status, 200);
  assert.equal(result.data.source, 'openrouter');
});

test('audio endpoint reconstructs SSE fragments and sends sized, playable PCM WAV', async t => {
  const cookie = await withServer(t, true);
  const audio = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
  const encoded = audio.toString('base64');
  const dataEvent = value => 'data: ' + JSON.stringify({ choices: [{ delta: { audio: { data: value } } }] }) + '\r\n\r\n';
  const sse = ': ping\n\n' + dataEvent(encoded.slice(0, 5)) + dataEvent(encoded.slice(5)) + 'data: [DONE]\n\n';
  let clipped = false;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.equal(request.audio.format, 'pcm16');
    assert.equal(request.stream, true);
    assert.match(request.messages[0].content, /Guangzhou Cantonese/);
    assert.match(request.messages[0].content, /slowly/);
    const text = clipped ? sse.slice(0, -15) : sse;
    return new Response(new ReadableStream({
      start(controller) {
        for (let i = 0; i < text.length; i += 17) controller.enqueue(Buffer.from(text.slice(i, i + 17)));
        controller.close();
      },
    }));
  });
  const input = { language: 'cantonese', text: '你好', slow: true };
  const result = await call(speak, input, cookie);
  assert.equal(result.status, 200);
  assert.equal(result.headers['Content-Type'], 'audio/wav');
  assert.equal(result.data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(result.data.readUInt32LE(24), 24000);
  assert.equal(result.data.readUInt32LE(40), audio.length);
  assert.deepEqual(result.data.subarray(44), audio);
  clipped = true;
  assert.equal((await call(speak, input, cookie)).status, 502);
});
