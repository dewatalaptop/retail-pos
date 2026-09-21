import { Component, type ErrorInfo, type ReactNode } from "react";

// window.BugReporter comes from /bug-reporter.js (see index.html). Typed loosely on
// purpose: the script is optional in local dev and must never be a hard dependency.
declare global {
  interface Window {
    BugReporter?: {
      captureException: (err: unknown, context?: Record<string, string | number | boolean>, kind?: string) => boolean;
      openDialog: (opts?: { title?: string; hint?: string }) => void;
    };
  }
}

// React swallows render errors: without a boundary the whole screen goes blank and
// window.onerror never sees a useful stack. This reports the error AND shows the
// person something they can act on instead of a white page.
export class BugBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    window.BugReporter?.captureException(error, { componentStack: (info.componentStack ?? "").slice(0, 300) }, "crash");
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ padding: 24, maxWidth: 420, margin: "12vh auto", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>Ada yang tidak beres</h1>
        <p style={{ color: "#555", fontSize: 14 }}>
          Masalahnya sudah dilaporkan otomatis ke tim pengembang. Muat ulang halaman untuk melanjutkan.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: "10px 18px", borderRadius: 10, border: 0, background: "#16a05c", color: "#fff", fontWeight: 600, cursor: "pointer" }}
        >
          Muat ulang
        </button>
      </div>
    );
  }
}
