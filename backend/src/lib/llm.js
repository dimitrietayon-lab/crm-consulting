/**
 * lib/llm.js
 * Unified LLM caller — reads the active LlmConfig from DB and dispatches
 * to the correct provider. Used by all AI features in the system.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// ─── Provider implementations ─────────────────────────────────────────────────

async function callOpenAI(cfg, prompt, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'OpenAI Fehler')
  return data.choices[0].message.content
}

async function callAzureOpenAI(cfg, prompt, maxTokens) {
  const base     = (cfg.endpoint || '').replace(/\/$/, '')
  const version  = cfg.apiVersion || '2024-02-01'
  const url = `${base}/openai/deployments/${cfg.deploymentName}/chat/completions?api-version=${version}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Azure OpenAI Fehler')
  return data.choices[0].message.content
}

async function callClaude(cfg, prompt, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: cfg.model || 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Claude Fehler')
  return data.content[0].text
}

async function callGemini(cfg, prompt, maxTokens) {
  const model = cfg.model || 'gemini-2.0-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message || 'Gemini Fehler')
  return data.candidates[0].content.parts[0].text
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getActiveConfig() {
  return prisma.llmConfig.findFirst({ where: { isActive: true } })
}

async function callLlm(cfg, prompt, maxTokens = 1024) {
  switch (cfg.provider) {
    case 'openai':       return callOpenAI(cfg, prompt, maxTokens)
    case 'azure_openai': return callAzureOpenAI(cfg, prompt, maxTokens)
    case 'claude':       return callClaude(cfg, prompt, maxTokens)
    case 'gemini':       return callGemini(cfg, prompt, maxTokens)
    default: throw new Error(`Unbekannter Provider: ${cfg.provider}`)
  }
}

async function callActiveLlm(prompt, opts = {}) {
  const cfg = await getActiveConfig()
  if (!cfg) {
    throw new Error(
      'Keine aktive KI-Verbindung konfiguriert. Bitte unter Einstellungen → KI-Verbindung eine Verbindung aktivieren.'
    )
  }
  return callLlm(cfg, prompt, opts.maxTokens || 1024)
}

module.exports = { callActiveLlm, callLlm, getActiveConfig }
