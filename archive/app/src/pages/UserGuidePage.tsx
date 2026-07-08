import { useResolvedPhases, useResolvedTasks } from '../hooks/usePlanData';

interface UserGuidePageProps {
  onClose: () => void;
}

export function UserGuidePage({ onClose }: UserGuidePageProps) {
  const phases = useResolvedPhases();
  const tasks = useResolvedTasks();
  const allTasks = Object.values(tasks);
  const doneTasks = allTasks.filter((t) => t.status === 'done').length;

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: 'var(--bg)',
      fontFamily: 'var(--font-body, sans-serif)',
      color: 'var(--text)',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-dim)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '2px 6px',
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)' }}>USER GUIDE</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>How to use the CJ8 Planner</div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 48px', maxWidth: 680 }}>

        {/* Live stats */}
        <div style={{
          display: 'flex',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Phases', value: phases.length },
            { label: 'Tasks', value: allTasks.length },
            { label: 'Done', value: doneTasks },
            { label: 'Remaining', value: allTasks.length - doneTasks },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                {value}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <Section title="How the plan works">
          <p>Your restoration plan lives in <code>plan.ts</code> — a structured file that Claude Code maintains. It contains all {phases.length} phases and {allTasks.length} tasks for the CJ8 Scrambler rebuild.</p>
          <p>When you open a Claude Code session and make changes to the plan (adding tasks, reordering phases, updating notes), those changes appear in this app within ~1 second via Vite's hot module replacement. No sync button, no reload needed.</p>
        </Section>

        <Section title="The three views">
          <ul>
            <li><strong>PLAN</strong> — all phases collapsed/expanded. Browse by phase, see progress bars, click any task for full detail.</li>
            <li><strong>WORK NOW</strong> — flat sorted list of everything not yet done, ordered by priority. Blocked tasks are shown dimmed. Start/complete directly from this view.</li>
            <li><strong>JOURNEY</strong> — a chronological log of completed tasks with photos. Shows key decisions made along the way.</li>
          </ul>
        </Section>

        <Section title="Using the advisor">
          <p>The advisor panel on the right is your in-app AI. It knows your full plan, your car's profile, and the build decisions already made.</p>
          <p><strong>What it's great for:</strong></p>
          <ul>
            <li>Technical questions: "What torque spec for the AMC 258 head bolts?"</li>
            <li>Status updates: "I finished the brake line inspection today"</li>
            <li>Part research: "Find a master cylinder on Jeepland" (searches jeepland.co.il live)</li>
            <li>Add notes to tasks: "Note on the engine: I found oil in cylinder 3"</li>
            <li>Get step-by-step guides: "Walk me through the carburetor rebuild"</li>
          </ul>
          <p><strong>What needs a Claude Code session:</strong> reordering phases, adding many tasks at once, large structural changes to the plan.</p>
        </Section>

        <Section title="Adding tasks via the advisor">
          <p>Tell the advisor: "Add a task to phase 3 for checking the transfer case output seals." It will create the task and auto-generate steps/parts in the background (appears within ~15 seconds).</p>
          <p>Tasks added this way live in the store until the next Claude Code session integrates them into <code>plan.ts</code>. Nothing is lost — they're persisted to disk.</p>
        </Section>

        <Section title="Task detail view">
          <p>Click any task to open it. You'll see:</p>
          <ul>
            <li><strong>Status</strong> — change between Todo / Active / Done / Skipped</li>
            <li><strong>Parts list</strong> — with checkboxes to mark parts as purchased</li>
            <li><strong>Steps guide</strong> — generated by the advisor or enrichment; click "Regenerate" to refresh</li>
            <li><strong>Notes</strong> — append notes (date-stamped automatically)</li>
            <li><strong>Photos</strong> — upload photos, get AI analysis of what's in the image</li>
          </ul>
        </Section>

        <Section title="Photos and the journey log">
          <p>Upload photos from the task detail view. The advisor can analyze what it sees and save observations to the task record. Completed tasks with photos appear in the JOURNEY tab.</p>
        </Section>

      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--amber)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 12,
        borderBottom: '1px solid var(--border)',
        paddingBottom: 8,
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: 13,
        color: 'var(--text-muted)',
        lineHeight: 1.7,
      }}>
        {children}
      </div>
    </div>
  );
}
