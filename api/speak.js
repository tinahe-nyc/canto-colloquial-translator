import { ClientError, inputText, language, methodNotAllowed, readBody, requireSession, sendError, throttle } from '../lib/server/http.js';
import { synthesize } from '../lib/server/audio.js';

export default async function speak(req, res) {
  try {
    if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
    const session = requireSession(req);
    const body = await readBody(req);
    const text = inputText(body.text, 500, 'Please choose a line of up to 500 characters.');
    const lang = language(body.language);
    if (body.slow !== undefined && typeof body.slow !== 'boolean') throw new ClientError(400, 'Choose a valid speed.');
    throttle('audio:' + session, 120, 10 * 60000);
    const clip = await synthesize(text, lang, body.slow === true);
    res.statusCode = 200;
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', clip.length);
    res.end(clip);
  } catch (error) {
    sendError(res, error);
  }
}
