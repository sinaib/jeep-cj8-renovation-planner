import Anthropic from '@anthropic-ai/sdk';
import type { Task, TaskBriefing } from '../types';
import { useRenovationStore } from '../store/useRenovationStore';

const client = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

const cache = new Map<string, TaskBriefing>();

export async function getTaskBriefing(task: Task): Promise<TaskBriefing> {
  // If task already has persisted steps from a previous enrichment, build a briefing from them
  if (task.steps && task.steps.length > 0) {
    const persisted: TaskBriefing = {
      overview: task.guide ?? `This task involves work on the ${task.systemId} system of the CJ8.`,
      steps: task.steps,
      toolsNeeded: [],
      commonMistakes: [],
      estimatedTime: 'Varies',
      difficulty: 3,
      proTips: [],
      partSuggestions: task.parts.map((p) => ({ name: p.name, estimatedCostILS: p.estimatedCostILS })),
      safetyWarnings: [],
    };
    cache.set(task.id, persisted);
    return persisted;
  }

  if (cache.has(task.id)) return cache.get(task.id)!;

  const prompt = `You are a Jeep CJ8 1989 specialist mechanic. Give a practical, hands-on technical guide for this renovation task:

Task: ${task.name}
System: ${task.systemId}
Priority: ${task.priority}
${task.notes ? `Notes: ${task.notes}` : ''}
${task.agentRationale ? `Why this task was flagged: ${task.agentRationale}` : ''}

Respond with a JSON object matching this exact structure (no markdown, just raw JSON):
{
  "overview": "1-2 sentence summary of what this job involves on a 1989 CJ8 specifically",
  "steps": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "toolsNeeded": ["tool1", "tool2"],
  "commonMistakes": ["mistake specific to this job"],
  "estimatedTime": "e.g. 2-3 hours",
  "difficulty": 3,
  "proTips": ["CJ8-specific tip"],
  "partSuggestions": [{"name": "Part name", "partNumber": "optional", "estimatedCostILS": 0}],
  "safetyWarnings": ["warning if any"]
}

Make the steps concrete and actionable — someone doing this job for the first time on a CJ8 should be able to follow them.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const briefing: TaskBriefing = JSON.parse(jsonMatch[0]);
    cache.set(task.id, briefing);

    // Persist steps + overview into the task store so they survive reload
    useRenovationStore.getState().updateTask(task.id, {
      steps: briefing.steps,
      guide: briefing.overview,
    });

    return briefing;
  } catch {
    const fallback: TaskBriefing = {
      overview: `This task involves work on the ${task.systemId} system of the CJ8.`,
      steps: ['Consult the CJ8 manual for this procedure', 'Gather required tools before starting'],
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
