import { Component, type ReactNode } from 'react';

// Without this, an unexpected error would leave a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="message-page" role="alert">
        <h1>Something went wrong</h1>
        <p className="muted">
          The page could not be shown. Your saved work is not affected. Reloading usually fixes it.
        </p>
        <div className="dialog-actions">
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </main>
    );
  }
}
