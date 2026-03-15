import { useRenovationStore } from '../store/useRenovationStore';
import { useResolvedPhases, useResolvedTasks } from '../hooks/usePlanData';
import { AGENT_TOOL_DEFINITIONS } from '../ai/agentTools';
import { car } from '../data/car';

interface ProjectOverviewPageProps {
  onClose: () => void;
}

export function ProjectOverviewPage({ onClose }: ProjectOverviewPageProps) {
  const phases = useResolvedPhases();
  const tasks = useResolvedTasks();
  const storeOnlyTaskCount = Object.keys(useRenovationStore((s) => s.storeOnlyTasks)).length;
  const decisions = useRenovationStore((s) => s.decisions);

  const allTasks = Object.values(tasks);

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: 'var(--bg)',
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
          style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 16, padding: '2px 6px' }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--amber)' }}>PROJECT OVERVIEW</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Architecture and live data reference</div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 48px', maxWidth: 700 }}>

        {/* Architecture diagram */}
        <Section title="Architecture">
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '12px 14px',
            overflowX: 'auto',
            lineHeight: 1.6,
          }}>
{`plan.ts ──(ESM import, Vite HMR)──► React components (live)
car.ts  ──(ESM import)────────────► contextSelector

useRenovationStore (delta only, persisted):
  taskStatuses     — what the user changed
  taskNotes        — notes added in-app
  taskActualCosts  — costs recorded
  taskSteps/Guides — enrichment overrides
  taskExtraParts   — parts added in-app
  storeOnlyTasks   — tasks added via advisor
  decisions        — runtime decisions
  agentHistory     — conversation history
  fileIndex        — photo metadata

usePlanData hook (merge point):
  useResolvedTasks()  → planTasks + delta
  useResolvedPhases() → planPhases + storeOnlyTaskIds
  useTaskDependencies() → planDeps + storeOnly deps`}
          </pre>
        </Section>

        {/* Live phase list */}
        <Section title={`Phases (${phases.length} total, live from plan.ts)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {phases.map((p) => {
              const phaseTasks = p.taskIds.map((id) => tasks[id]).filter(Boolean);
              const done = phaseTasks.filter((t) => t.status === 'done').length;
              return (
                <div key={p.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${p.color ?? 'var(--border)'}`,
                  borderRadius: '0 6px 6px 0',
                  fontSize: 12,
                }}>
                  <span><code style={{ color: 'var(--text-dim)', fontSize: 10 }}>{p.id}</code> {p.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {done}/{phaseTasks.length}
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Data files */}
        <Section title="Data files">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>File</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>Owner</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-dim)', fontWeight: 600 }}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['plan.ts', 'Claude Code', 'Phases, tasks, dependencies, steps, parts'],
                ['car.ts', 'Claude Code', 'Car profile, system conditions, history'],
                ['decisions.ts', 'Claude Code', 'Strategic build decisions (keep AMC 258, DIY, etc.)'],
                ['discoveries.ts', 'Claude Code', 'Research findings and notable discoveries'],
                ['store (localStorage)', 'In-app', 'Runtime delta: statuses, notes, costs, agent history'],
              ].map(([file, owner, purpose]) => (
                <tr key={file} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{file}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-dim)' }}>{owner}</td>
                  <td style={{ padding: '6px 8px', color: 'var(--text-muted)' }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Car profile */}
        <Section title="Car profile (from car.ts)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            {Object.entries(car.vehicle).map(([key, value]) => (
              <div key={key} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-dim)', width: 120, flexShrink: 0 }}>{key}:</span>
                <span style={{ color: 'var(--text-muted)' }}>{String(value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--text-dim)', width: 120, flexShrink: 0 }}>status:</span>
              <span style={{ color: 'var(--text-muted)' }}>{car.overallStatus}</span>
            </div>
          </div>
        </Section>

        {/* Stats */}
        <Section title="Live stats">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'Total tasks', value: allTasks.length },
              { label: 'Plan tasks', value: allTasks.length - storeOnlyTaskCount },
              { label: 'Advisor-added', value: storeOnlyTaskCount },
              { label: 'Completed', value: allTasks.filter((t) => t.status === 'done').length },
              { label: 'Active', value: allTasks.filter((t) => t.status === 'active').length },
              { label: 'Runtime decisions', value: decisions.length },
            ].map(({ label, value }) => (
              <div key={label} style={{
                padding: '8px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>{value}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>{label}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Advisor tools */}
        <Section title={`Advisor tools (${AGENT_TOOL_DEFINITIONS.length} available)`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {AGENT_TOOL_DEFINITIONS.map((tool) => (
              <div key={tool.name} style={{
                display: 'flex',
                gap: 10,
                padding: '6px 8px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 5,
                fontSize: 12,
              }}>
                <code style={{ color: 'var(--amber)', fontSize: 11, width: 160, flexShrink: 0 }}>{tool.name}</code>
                <span style={{ color: 'var(--text-dim)', lineHeight: 1.4 }}>
                  {tool.description.split('.')[0]}.
                </span>
              </div>
            ))}
          </div>
        </Section>

        {/* Workflow note */}
        <Section title="Claude Code ↔ in-app integration">
          <p>Tasks added via the advisor go to <code>storeOnlyTasks</code>. At the start of each Claude Code session, integrate them:</p>
          <pre style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '10px 12px',
          }}>
{`# Find in-app added tasks:
Object.values(storeOnlyTasks)
  .filter(t => t.addedBy === 'agent')
  .map(t => ({ id: t.id, name: t.name, phaseId: t.phaseId }))

# Then in plan.ts: integrate good ones, skip noise`}
          </pre>
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
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
