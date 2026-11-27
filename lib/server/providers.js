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

function openAIKey() {
  return process.env.OPEN_AI_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
}

export function providerStatus() {
  const audioReady = Boolean(openRouterKey());
  return { providerReady: audioReady || Boolean(openAIKey() || anthropicKey()), audioReady };
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

async function requestOpenAI(key, system, messages, maxTokens, signal) {
  if (!/^sk-(?!ant-|or-)\S+$/.test(key)) throw new ClientError(503, 'The host needs to set an OpenAI API key.');
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-6-luna';
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', signal, redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model, instructions: system, input: messages, max_output_tokens: maxTokens, store: false,
      ...(model === 'gpt-6-luna' ? { reasoning: { effort: 'low' } } : {}),
    }),
  });
  const answer = await response.json().catch(() => null);
  if (!response.ok || answer?.error) {
    const { code, param, type } = answer?.error || {};
    const safeLabel = value => typeof value === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(value) ? value : undefined;
    console.warn('OpenAI request failed', {
      status: response.status, code: safeLabel(code), param: safeLabel(param), type: safeLabel(type),
      requestLimit: safeLabel(response.headers.get('x-ratelimit-limit-requests')),
      tokenLimit: safeLabel(response.headers.get('x-ratelimit-limit-tokens')),
      retryAfter: safeLabel(response.headers.get('retry-after')),
    });
    if (response.status === 402 || code === 'insufficient_quota' || type === 'insufficient_quota') {
      throw new ClientError(503, 'The host needs to check OpenAI API credits or their project budget.');
    }
    if (response.status === 429) throw new ClientError(429, 'The coach is busy. Please try again in a moment.');
    if ([401, 403].includes(response.status)) throw new ClientError(503, 'The host needs to check the OpenAI API key and its permissions.');
    if (response.status === 404) throw new ClientError(503, 'The configured OpenAI model is unavailable.');
    throw new ClientError(502, 'The language provider could not finish the request.');
  }
  const blocks = answer?.status === 'completed' ? answer.output?.flatMap(item => item.type === 'message' ? item.content : []) : [];
  const content = blocks?.filter(block => block.type === 'output_text').map(block => block.text).join('');
  return { content, source: 'openai', cost: null };
}

export async function requestTranslation(system, messages, maxTokens, signal) {
  const preferredKey = openAIKey();
  if (preferredKey) return requestOpenAI(preferredKey, system, messages, maxTokens, signal);
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
