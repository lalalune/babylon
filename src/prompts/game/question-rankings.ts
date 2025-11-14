import { definePrompt } from '../define-prompt';

export const questionRankings = definePrompt({
  id: 'question-rankings',
  version: '1.0.0',
  category: 'game',
  description: 'Ranks questions by dramatic potential and entertainment value',
  temperature: 0.5,
  maxTokens: 2000,
  template: `
Rank these questions by dramatic potential and entertainment value (1 = best, {{questionCount}} = worst):

{{questionsList}}

Return JSON with ranks:
{
  "rankings": [
    { "questionId": 1, "rank": 3, "reasoning": "..." }
  ]
}
`.trim()
});
