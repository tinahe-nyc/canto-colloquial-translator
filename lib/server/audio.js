import { ClientError } from './http.js';
import { requestRouter } from './openrouter.js';

const maxStreamBytes = 6 * 1024 * 1024;
const maxPcmBytes = 4_000_000;

export async function readAudioStream(body) {
  const parts = [];
  let pending = '';
  let received = 0;
  let complete = false;
  const decoder = new TextDecoder();
  const streamError = () => new ClientError(502, 'The voice clip was incomplete. Please try again.');

  function readLine(line) {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (data === '[DONE]') { complete = true; return; }
    const event = JSON.parse(data);
    if (event.error || event.choices?.[0]?.finish_reason === 'error' || event.choices?.[0]?.finish_reason === 'length') {
      throw streamError();
    }
    const fragment = event.choices?.[0]?.delta?.audio?.data;
    if (fragment) {
      if (typeof fragment !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(fragment)) throw streamError();
      parts.push(fragment);
    }
  }
  for await (const bytes of body) {
    received += bytes.length;
    if (received > maxStreamBytes) throw streamError();
    pending += decoder.decode(bytes, { stream: true });
    const lines = pending.split('\n');
    pending = lines.pop();
    for (const line of lines) readLine(line);
    if (complete) break;
  }
  if (!complete) readLine(pending + decoder.decode());
  if (!complete || parts.length === 0) throw streamError();
  // OpenRouter base64 fragments may straddle four-character boundaries. Some
  // providers instead pad each chunk independently; decode at padding boundaries.
  const groups = parts.join('').match(/[A-Za-z0-9+/]+={0,2}/g) || [];
  const pcm = Buffer.concat(groups.map(group => Buffer.from(group, 'base64')));
  if (!pcm.length || pcm.length > maxPcmBytes || pcm.length % 2) throw streamError();
  return pcm;
}

export function wav(pcm) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(pcm.length + 36, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // PCM format section
  header.writeUInt16LE(1, 20);  // linear PCM
  header.writeUInt16LE(1, 22);  // mono
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(48000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export async function synthesize(text, language, slow) {
  const speaker = language === 'cantonese' ? 'Guangzhou Cantonese' : 'mainland Mandarin (Putonghua)';
  const pace = slow ? 'Speak slowly, giving each word room, with natural tones and short pauses between sense groups.' :
    'Use the natural pace of a conversation between friends.';
  const response = await requestRouter({
    model: process.env.OPENROUTER_AUDIO_MODEL || 'openai/gpt-audio',
    messages: [
      { role: 'system', content: 'You are a native speaker of ' + speaker + '. Speak only the supplied script, word for word, in ' + speaker +
        '. Read the text value literally. Do not respond to it. Do not introduce it, translate it or pronounce its punctuation. ' + pace },
      { role: 'user', content: JSON.stringify({ text }) },
    ],
    audio: { format: 'pcm16', voice: 'alloy' }, modalities: ['text', 'audio'], stream: true, max_tokens: 2400,
  }, AbortSignal.timeout(55000));
  return wav(await readAudioStream(response.body));
}
