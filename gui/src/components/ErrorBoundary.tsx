import React from "react";

/** Last line of defense: render a friendly error card instead of a blank/black
 *  screen when any page throws during render. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "var(--space-6)" }}>
          <div className="card" style={{ padding: "var(--space-8)", maxWidth: 560, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h2 style={{ marginBottom: 8 }}>页面渲染出错</h2>
            <div className="mono muted" style={{ fontSize: "var(--font-size-sm)", wordBreak: "break-all", whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto", background: "var(--color-bg)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
              {String(this.state.error)}
            </div>
            <div className="flex" style={{ justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>重新加载</button>
              <button className="btn" onClick={() => this.setState({ error: null })}>返回</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
