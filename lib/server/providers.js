import { ClientError } from './http.js';

function openRouterKey() {
  const configured = process.env.OPENROUTER_API_KEY?.trim();
  if (configured?.startsWith('sk-or-v1-')) return configured;
  // Recognize an OpenRouter key stored under the Anthropic variable name.
  const alternate = process.env.ANTHROPIC_API_KEY?.trim();
  return alternate?.startsWith('sk-or-v1-') ? alternate : null;
}

function anthropicKey() {
  const configured = process.env.ANTHROPIC_API_KEY?.trim();
  return configured?.startsWith('sk-ant-api') ? configured : null;
}

export function providerStatus() {
  const audioReady = Boolean(openRouterKey());
  return { providerReady: audioReady || Boolean(anthropicKey()), audioReady };
}

export async function requestRouter(payload, signal) {
  const key = openRouterKey();
  if (!key) throw new ClientError(503, 'Generated audio needs OpenRouter. You can use a Cantonese voice on your device.');
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 429) throw new ClientError(429, 'The coach is busy. Please try again in a moment.');
    if ([401, 402, 403].includes(response.status)) {
      throw new ClientError(503, 'The host needs to check the OpenRouter key or credit balance.');
    }
    throw new ClientError(502, 'The voice or language provider is temporarily unavailable.');
  }
  return response;
}

async function requestAnthropic(key, system, messages, maxTokens, signal) {
  const model = process.env.ANTHROPIC_TEXT_MODEL || 'claude-sonnet-5-5';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal, redirect: 'error',
    headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + key, 'anthropic-version': '2026-10-21',
    },
    body: JSON.stringify({
      model, system, messages, max_tokens: maxTokens,
      ...(model === 'claude-sonnet-5-5' ? { output_config: { effort: 'low' } } : {}),
    }),
  });
  const answer = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 429) throw new ClientError(429, 'The coach is busy. Please try again in a moment.');
    if (response.status === 402 || /credit balance|insufficient (credits|funds)/i.test(answer?.error?.message ?? '')) {
      throw new ClientError(503, 'The host needs to add Claude API credits.');
    }
    if ([401, 403].includes(response.status)) throw new ClientError(503, 'The host needs to check the Claude API key and its permissions.');
    if (response.status === 404) throw new ClientError(503, 'The configured Claude model is unavailable.');
    throw new ClientError(502, 'The language provider could not finish the request.');
  }
  const content = answer?.content?.filter(block => block.type === 'text').map(block => block.text).join('');
  return { content, source: 'anthropic', cost: null };
}

export async function requestTranslation(system, messages, maxTokens, signal) {
  if (openRouterKey()) {
    const model = process.env.OPENROUTER_TEXT_MODEL || 'anthropic/claude-sonnet-5.5';
    const response = await requestRouter({
      model, max_tokens: maxTokens,
      ...(model === 'anthropic/claude-sonnet-5.5' ? { reasoning: { effort: 'low' } } : {}),
      messages: [{ role: 'system', content: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] }, ...messages],
    }, signal);
    const answer = await response.json();
    if (answer.error) throw new ClientError(502, 'The language provider could not finish the request.');
    return { content: answer.choices?.[0]?.message?.content, source: 'openrouter', cost: Number(answer.usage?.cost) || 0 };
  }
  const key = anthropicKey();
  if (key) return requestAnthropic(key, system, messages, maxTokens, signal);
  throw new ClientError(503, 'The host needs to connect a translation provider.');
}
