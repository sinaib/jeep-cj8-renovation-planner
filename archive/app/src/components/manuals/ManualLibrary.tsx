import { useState } from 'react';
import { motion } from 'framer-motion';
import { MANUALS } from '../../data/manuals';
import type { ManualId } from '../../types';

export function ManualLibrary() {
  const [activeManual, setActiveManual] = useState<ManualId | null>(null);

  if (activeManual) {
    const manual = MANUALS.find((m) => m.id === activeManual)!;
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'var(--surface)',
        }}>
          <button
            onClick={() => setActiveManual(null)}
            style={{ color: 'var(--text-muted)', fontSize: 13 }}
          >
            ← Back
          </button>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{manual.title}</span>
          <a
            href={`/manuals/${manual.filename}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: 'auto', padding: '5px 12px',
              background: 'var(--olive-dim)', border: '1px solid var(--olive)',
              borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text)',
            }}
          >
            Open in new tab ↗
          </a>
        </div>
        <iframe
          src={`/manuals/${manual.filename}`}
          style={{ flex: 1, border: 'none', background: '#222' }}
          title={manual.title}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Technical Manuals</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Your CJ8 1989 reference library. Click any manual to open it.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MANUALS.map((manual) => (
          <motion.button
            key={manual.id}
            onClick={() => setActiveManual(manual.id)}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.99 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px', borderRadius: 'var(--radius-lg)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--olive)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 44, height: 56, borderRadius: 4,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>
              📄
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{manual.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{manual.description}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 11,
                  background: 'var(--surface-2)', color: 'var(--text-dim)',
                  border: '1px solid var(--border)',
                }}>
                  {manual.language === 'he' ? '🇮🇱 Hebrew' : '🇬🇧 English'}
                </span>
                {manual.pageCount > 0 && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 20, fontSize: 11,
                    background: 'var(--surface-2)', color: 'var(--text-dim)',
                    border: '1px solid var(--border)',
                  }}>
                    {manual.pageCount} pages
                  </span>
                )}
              </div>
            </div>
            <span style={{ color: 'var(--text-dim)', fontSize: 18 }}>→</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
