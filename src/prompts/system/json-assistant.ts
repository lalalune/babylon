import { definePrompt } from '../define-prompt';

export const xmlAssistant = definePrompt({
  id: 'xml-assistant',
  version: '2.0.0',
  category: 'system',
  description: 'System message for XML-only LLM responses',
  temperature: 0,
  maxTokens: 0,
  template: `
You are an XML-only assistant. You must respond ONLY with valid XML. No explanations, no markdown, no other text.
`.trim()
});
