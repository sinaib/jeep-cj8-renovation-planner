import React from 'react';

interface State { error: string | null; stack: string | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null, stack: null };

  static getDerivedStateFromError(error: Error): State {
    return { error: error.message, stack: error.stack ?? null };
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh', background: '#111214', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <div style={{
            maxWidth: 600, width: '100%',
            background: '#1A1C1E', border: '1px solid #C0392B',
            borderRadius: 12, padding: 24,
          }}>
            <div style={{ fontSize: 11, color: '#C0392B', letterSpacing: '0.1em', fontWeight: 600, marginBottom: 12 }}>
              ⚠ RENDER ERROR — APP CRASHED
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#F0EDE8', marginBottom: 16, lineHeight: 1.5 }}>
              {this.state.error}
            </div>
            {this.state.stack && (
              <pre style={{
                fontSize: 10, color: '#5A5F68', overflow: 'auto', maxHeight: 200,
                background: '#111214', padding: 12, borderRadius: 6, marginBottom: 16,
              }}>
                {this.state.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#D4832A', color: 'white', border: 'none',
                padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
