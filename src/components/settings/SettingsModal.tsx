import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRenovationStore } from '../../store/useRenovationStore';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const exportProgress = useRenovationStore((s) => s.exportProgress);
  const importProgress = useRenovationStore((s) => s.importProgress);
  const resetAll = useRenovationStore((s) => s.resetAll);
  const appState = useRenovationStore((s) => s.appState);
  const finishOnboarding = useRenovationStore((s) => s.finishOnboarding);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const json = exportProgress();
    const date = new Date().toISOString().split('T')[0];
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jeep-cj8-progress-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = ev.target?.result as string;
      importProgress(json);
      onClose();
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    if (window.confirm('Reset ALL progress? This cannot be undone.')) {
      resetAll();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 299,
            }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 300, background: 'var(--surface)',
              borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)',
              padding: 24, width: 360, boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16 }}>Settings</h3>
              <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Save progress */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                  PROGRESS
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={handleExport}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 'var(--radius)',
                      background: 'var(--olive-dim)', border: '1px solid var(--olive)',
                      color: 'var(--text)', fontSize: 12, fontWeight: 500,
                    }}
                  >
                    ↓ Save Progress
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 'var(--radius)',
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      color: 'var(--text)', fontSize: 12, fontWeight: 500,
                    }}
                  >
                    ↑ Load Progress
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>
                  Progress auto-saves to localStorage. Export for backup.
                </div>
              </div>

              {/* API key info */}
              <div style={{ padding: '12px', borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                  AI AGENT
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Set <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 3 }}>VITE_ANTHROPIC_API_KEY</code> in your <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 3 }}>.env.local</code> file to enable AI features.
                </div>
              </div>

              {/* Dev tools */}
              {appState === 'plan_built' && (
                <button
                  onClick={() => { finishOnboarding(); onClose(); }}
                  style={{
                    padding: '10px', borderRadius: 'var(--radius)',
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: 12,
                  }}
                >
                  Continue to in-progress view
                </button>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <button
                  onClick={handleReset}
                  style={{
                    width: '100%', padding: '10px', borderRadius: 'var(--radius)',
                    background: 'transparent', border: '1px solid var(--red)',
                    color: 'var(--red)', fontSize: 12,
                  }}
                >
                  Reset All Progress
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
