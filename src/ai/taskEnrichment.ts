import Anthropic from '@anthropic-ai/sdk';
import type { Task, TaskBriefing } from '../types';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const cache = new Map<string, TaskBriefing>();

export async function getTaskBriefing(task: Task): Promise<TaskBriefing> {
  if (cache.has(task.id)) return cache.get(task.id)!;

  const prompt = `You are a Jeep CJ8 1989 specialist mechanic. Provide a technical briefing for this specific renovation task:

Task: ${task.name}
System: ${task.systemId}
Priority: ${task.priority}
${task.notes ? `Notes: ${task.notes}` : ''}

Respond with a JSON object matching this exact structure (no markdown, just raw JSON):
{
  "overview": "What this job involves on a 1989 CJ8 specifically",
  "toolsNeeded": ["tool1", "tool2"],
  "commonMistakes": ["mistake1", "mistake2"],
  "estimatedTime": "e.g. 2-3 hours",
  "difficulty": 1-5,
  "proTips": ["tip specific to CJ8 1989"],
  "partSuggestions": [{"name": "Part name", "partNumber": "optional", "estimatedCostILS": 0}],
  "safetyWarnings": ["warning if any"]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const briefing: TaskBriefing = JSON.parse(jsonMatch[0]);
    cache.set(task.id, briefing);
    return briefing;
  } catch {
    // Return a minimal fallback
    const fallback: TaskBriefing = {
      overview: `This task involves work on the ${task.systemId} system of the CJ8.`,
      toolsNeeded: ['Basic hand tools', 'Torque wrench'],
      commonMistakes: [],
      estimatedTime: 'Varies',
      difficulty: 3,
      proTips: ['Consult the CJ8 manual before starting'],
      partSuggestions: [],
      safetyWarnings: [],
    };
    return fallback;
  }
}
