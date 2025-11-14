import { definePrompt } from '../define-prompt';

export const jsonAssistant = definePrompt({
  id: 'json-assistant',
  version: '1.0.0',
  category: 'system',
  description: 'System message for JSON-only LLM responses',
  temperature: 0,
  maxTokens: 0,
  template: `
You are a JSON-only assistant. You must respond ONLY with valid JSON. No explanations, no markdown, no other text.
`.trim()
});
