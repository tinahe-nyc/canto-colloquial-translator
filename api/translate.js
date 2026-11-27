import {
  ClientError, inputText, language, login, methodNotAllowed, readBody, requireSession,
  sendError, sendJson, session, throttle,
} from '../lib/server/http.js';
import { generate } from '../lib/server/openrouter.js';
import { localCoach } from '../lib/server/local-coach.js';
import { providerStatus } from '../lib/server/providers.js';
import { starterLesson, starterPhrases } from '../lib/server/starters.js';
import { recordPractice, recentPractice } from '../lib/server/practice.js';

const listeners = new Set(['parents', 'family', 'friends', 'partner', 'coworker', 'shop', 'stranger']);
const publicLessons = new Map([
  ['starter', 'translate'], ['starter-alternatives', 'alternatives'],
]);

function status(authenticated) {
  return { authenticated, ...providerStatus(), starterPhrases };
}

function lineText(value) {
  return inputText(typeof value === 'string' ? value : value?.hanzi, 500, 'Choose a complete phrase first.');
}

function translationInput(body) {
  const { action } = body;
  const english = inputText(body.english, 600, 'Enter a phrase of up to 600 characters.');
  if (action !== 'translate' && action !== 'alternatives') throw new ClientError(400, 'Unknown coach action.');
  const lang = language(body.language);
  const listener = body.listener ?? 'parents';
  const style = body.style ?? 'simple';
  if (!listeners.has(listener) || !['simple', 'full'].includes(style)) throw new ClientError(400, 'Choose a listener and a style.');
  const input = { action, english, language: lang, listener, style };
  if (action === 'alternatives') input.original = lineText(body.result);
  return input;
}

function starterResponse(action, lesson) {
  const [main, ...alternatives] = lesson.cantonese;
  if (action === 'alternatives') return { alternatives, source: 'starter' };
  return { result: main, source: 'starter' };
}

export default async function translate(req, res) {
  try {
    if (req.method === 'GET') return sendJson(res, 200, status(Boolean(session(req))));
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST');
    const body = await readBody(req);
    if (publicLessons.has(body.action)) {
      const lesson = starterLesson(inputText(body.english, 600, 'Choose a starter phrase.'));
      if (!lesson) throw new ClientError(400, 'Choose one of the three starter phrases.');
      language(body.language);
      return sendJson(res, 200, starterResponse(publicLessons.get(body.action), lesson));
    }
    if (body.action === 'login') {
      login(req, res, body.passcode);
      return sendJson(res, 200, status(true));
    }
    const id = requireSession(req);
    if (body.action === 'coach') {
      throttle('text:' + id, 60, 10 * 60000);
      return sendJson(res, 200, await localCoach(body));
    }
    if (body.action === 'practice') {
      const lang = language(body.language);
      throttle('practice:' + id, 60, 10 * 60000);
      return sendJson(res, 201, await recordPractice(lang));
    }
    if (body.action === 'recent-practice') return sendJson(res, 200, { entries: await recentPractice() });
    const input = translationInput(body);
    if (!providerStatus().providerReady) {
      const lesson = starterLesson(input.english);
      if (!lesson) throw new ClientError(503, 'Custom phrases need a translation provider. Choose one of the three starter phrases for now.');
      return sendJson(res, 200, starterResponse(input.action, lesson));
    }
    throttle('text:' + id, 60, 10 * 60000);
    return sendJson(res, 200, await generate(input));
  } catch (error) {
    sendError(res, error);
  }
}
