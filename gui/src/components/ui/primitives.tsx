import React from "react";

export function Card({ className = "", children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className={"card " + className} style={style}>{children}</div>;
}

type BtnVariant = "default" | "primary" | "ghost" | "danger";
type BtnSize = "sm" | "md" | "lg";

export function Button({
  variant = "default",
  size = "md",
  className = "",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize }) {
  const cls = ["btn", "btn-" + variant, size !== "md" ? "btn-" + size : "", className].join(" ");
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input" {...props} />;
}

type ChipTone = "default" | "primary" | "ok" | "warn" | "error" | "info" | "shell";
export function Chip({ tone = "default", children, title }: { tone?: ChipTone; children: React.ReactNode; title?: string }) {
  return (
    <span className={"chip chip-" + tone} title={title}>
      {children}
    </span>
  );
}

function shortPath(p: string, maxLen = 40): string {
  if (p.length <= maxLen) return p;
  const parts = p.split(/[/\\]+/).filter(Boolean);
  const tail = parts.slice(-2).join("/");
  return "…/" + tail;
}

export function SourcePill({ source, tool }: { source?: string; tool?: string }) {
  if (tool) {
    return (
      <span className="source-pill" title={"by tool " + tool + (source ? " @ " + source : "")}>
        ⚙ {tool}
        {source ? <span className="muted ellipsis"> · {shortPath(source, 24)}</span> : null}
      </span>
    );
  }
  if (!source) {
    return <span className="chip chip-shell" title="inherited from shell / not set by mise">↳ shell</span>;
  }
  return (
    <span className="source-pill mono-source" title={source}>
      📄 {shortPath(source)}
    </span>
  );
}

export function StatusPill({ level, text }: { level: "ok" | "warn" | "error" | "info"; text: string }) {
  return (
    <span className={"chip chip-" + level}>
      <span className={"status-dot " + level} />
      {text}
    </span>
  );
}

export function Spinner({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="empty-state">
      <div className="pulse" style={{ marginBottom: 8 }}>◌</div>
      <div>{label}</div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 28, marginBottom: 8 }}>🗂</div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      {hint ? <div className="muted" style={{ fontSize: "var(--font-size-sm)" }}>{hint}</div> : null}
    </div>
  );
}

export function Section({
  title,
  desc,
  actions,
  children,
  className = "",
}: {
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className} style={{ padding: "var(--space-5)" }}>
      <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-4)" }}>
        <div>
          <h2 style={{ fontSize: "var(--font-size-lg)" }}>{title}</h2>
          {desc ? <div className="muted" style={{ fontSize: "var(--font-size-sm)" }}>{desc}</div> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      {children}
    </Card>
  );
}

export function Code({ children, block }: { children: React.ReactNode; block?: boolean }) {
  if (block) {
    return (
      <pre style={{ background: "var(--color-surface-alt)", padding: "var(--space-3)", borderRadius: "var(--radius-md)", overflow: "auto", fontSize: "var(--font-size-sm)", margin: 0 }}>
        {children}
      </pre>
    );
  }
  return <code>{children}</code>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="mui-toggle flex items-center gap-2" style={{ cursor: "pointer" }}>
      <span className={"mui-toggle-track" + (checked ? " on" : "")} aria-hidden="true">
        <span className="mui-toggle-knob" />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label ? <span style={{ fontSize: "var(--font-size-sm)" }}>{label}</span> : null}
    </label>
  );
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="toast" role="status">
      <span className="status-dot ok" />
      <span>{message}</span>
      <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
    </div>
  );
}
