import type { Task, Phase } from '../../types';

type ChipContext = 'plan' | 'task' | 'workNow' | 'journey';

interface PromptChipsProps {
  context: ChipContext;
  currentTask?: Task | null;
  currentPhase?: Phase | null;
  onSend: (prompt: string) => void;
}

function getChips(context: ChipContext, task?: Task | null, phase?: Phase | null): string[] {
  switch (context) {
    case 'task':
      return [
        task ? `What tools do I need for "${task.name}"?` : 'What tools will I need?',
        task ? `Find parts for "${task.name}" on jeepland.co.il` : 'Find parts on jeepland.co.il',
        task ? `How long will "${task.name}" take?` : 'How long will this take?',
        task ? `I just finished "${task.name}" — mark it done and tell me what to do next` : 'I just finished this — what\'s next?',
      ];
    case 'workNow':
      return [
        'What should I focus on today?',
        "What's blocking me right now?",
        'Which active tasks depend on something else?',
      ];
    case 'journey':
      return [
        'Summarize my progress so far',
        'What percentage of the restoration is complete?',
        'What are the biggest milestones I\'ve hit?',
      ];
    case 'plan':
    default:
      return [
        phase ? `Map out all tasks for "${phase.name}"` : 'What should I do next?',
        'Check what parts I still need to buy',
        'What are the most critical tasks right now?',
        'Build out my next empty phase',
      ];
  }
}

export function PromptChips({ context, currentTask, currentPhase, onSend }: PromptChipsProps) {
  const chips = getChips(context, currentTask, currentPhase);
  if (chips.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      padding: '6px 12px 4px',
      borderTop: '1px solid var(--border)',
    }}>
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSend(chip)}
          style={{
            padding: '4px 10px',
            borderRadius: 20,
            border: '1px solid var(--border)',
            background: 'var(--surface-2)',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = 'var(--amber)';
            (e.target as HTMLButtonElement).style.color = 'var(--amber)';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.target as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
