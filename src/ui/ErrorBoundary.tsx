import { Component, type ReactNode } from 'react';

/** Last-resort error screen. The song is autosaved, so a reload is safe. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[app] crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        style={{
          height: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <h2>Something went wrong.</h2>
          <p className="muted">Your song is saved. Reloading usually fixes it.</p>
          <button
            className="primary"
            onClick={() => location.reload()}
            data-tip="Reload|Restart the app. Your song is safe."
          >
            Reload
          </button>
          <p className="small muted" style={{ marginTop: 18 }}>
            {this.state.error.message}
          </p>
        </div>
      </div>
    );
  }
}
