import { NextUpCard } from '../components/dashboard/NextUpCard';
import { JourneyMap } from '../components/dashboard/JourneyMap';
import { useRenovationStore } from '../store/useRenovationStore';

export function HomeView() {
  const totalCost = useRenovationStore((s) => s.getTotalCostEstimated());
  const spentCost = useRenovationStore((s) => s.getTotalCostSpent());

  return (
    <div style={{ padding: '24px 24px 80px', maxWidth: 640, margin: '0 auto' }}>
      {/* Next up */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
          NEXT UP
        </div>
        <NextUpCard />
      </div>

      {/* Cost summary */}
      {totalCost > 0 && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 28,
        }}>
          <div style={{
            flex: 1, padding: '12px 14px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>
              TOTAL ESTIMATED
            </div>
            <div style={{ fontWeight: 600, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
              ₪{totalCost.toLocaleString()}
            </div>
          </div>
          {spentCost > 0 && (
            <div style={{
              flex: 1, padding: '12px 14px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '0.08em', marginBottom: 4 }}>
                SPENT SO FAR
              </div>
              <div style={{ fontWeight: 600, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
                ₪{spentCost.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Journey map */}
      <div>
        <div style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 16 }}>
          JOURNEY MAP
        </div>
        <JourneyMap />
      </div>
    </div>
  );
}
