import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import { Button, Card, Code, Section, Spinner, StatusPill, Chip } from "../components/ui/primitives";
import { prettyJSON } from "../lib/env";

type Sev = "ok" | "warn" | "error" | "info";

function severityOf(v: unknown): Sev {
  if (typeof v !== "object" || v === null) return "info";
  const o = v as Record<string, unknown>;
  const level = typeof o.level === "string" ? o.level.toLowerCase() : "";
  const msg = typeof o.message === "string" ? o.message.toLowerCase() : "";
  if (level.includes("error") || msg.includes("error") || msg.includes("missing") || msg.includes("not installed")) return "error";
  if (level.includes("warn") || msg.includes("warning") || msg.includes("outdated") || msg.includes("should")) return "warn";
  return "info";
}

const GROUP_LABELS: Record<string, string> = {
  version: "版本", os: "操作系统", shell: "Shell", settings: "设置",
  config_files: "配置文件", env_files: ".env 文件", plugins: "插件", tools: "工具",
  warnings: "警告", problems: "问题", checks: "检查项",
};

/** render a scalar-ish value as text (objects -> named fields joined) */
function scalar(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const fields = [o.name, o.version, o.path, o.title, o.message, o.description, o.value];
    const joined = fields.filter((x) => typeof x === "string" && x).join(" · ");
    if (joined) return joined;
  }
  return Array.isArray(v) ? v.map((x) => scalar(x)).join(", ") : (v === null ? "—" : JSON.stringify(v));
}

/** array item -> human line (never raw JSON dump) */
function itemView(item: unknown): { title: string; sub: string; sev: Sev } {
  if (typeof item === "string") return { title: item, sub: "", sev: "info" };
  if (typeof item === "number" || typeof item === "boolean")
    return { title: String(item), sub: "", sev: "info" };
  const o = (item ?? {}) as Record<string, unknown>;
  const title =
    (([o.name, o.title, o.message, o.path, o.source, o.key].filter((x): x is string => typeof x === "string" && x.length > 0)[0]) as string | undefined) ?? "条目";
  const parts: string[] = [];
  if (typeof o.version === "string" && o.version) parts.push("v" + o.version);
  if (typeof o.requested_version === "string" && o.requested_version) parts.push("请求 " + o.requested_version);
  if (typeof o.source === "string" && o.source) parts.push(o.source);
  if (typeof o.bullet === "string" && o.bullet) parts.push(o.bullet);
  if (o.installed !== undefined) parts.push(o.installed ? "已安装" : "未安装");
  return { title: title, sub: parts.join(" · "), sev: severityOf(item) };
}

/** object value (os/shell/settings) -> sorted scalar kv rows */
function kvRows(v: unknown): [string, string][] | null {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  return Object.entries(o)
    .filter(([k]) => !String(k).startsWith("_"))
    .map(([k, val]) => [k, scalar(val)] as [string, string]);
}

export default function Doctor() {
  const { baseUrl, token, cwd } = useSettings();
  const api = apiFrom({ baseUrl, token });
  const doctor = useQuery({ queryKey: ["doctor", cwd, baseUrl], queryFn: () => api.doctor(cwd) });
  const [showRaw, setShowRaw] = useState(false);

  if (doctor.isError) return <Card style={{ padding: "var(--space-5)" }}>doctor 失败：{doctor.error.message}</Card>;
  if (doctor.isLoading || !doctor.data) return <Spinner label="运行 mise doctor…" />;

  const data = (doctor.data.data ?? {}) as Record<string, unknown>;
  const body = prettyJSON(doctor.data.data);

  const problems = Array.isArray(data.problems) ? (data.problems as unknown[]) : [];
  const warnings = Array.isArray(data.warnings) ? (data.warnings as unknown[]) : [];
  const issueTone = (list: unknown[]): Sev => (list.length === 0 ? "ok" : list.some((i) => severityOf(i) === "error") ? "error" : "warn");

  const entries = Object.entries(data).filter(([k, v]) => !k.startsWith("_") && k !== "warnings" && k !== "problems" && Array.isArray(v));

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Card className="flex items-center justify-between" style={{ padding: "var(--space-5)" }}>
        <div className="flex items-center gap-4">
          <span style={{ fontSize: 48 }}>{problems.length > 0 ? "⚠️" : "✅"}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--font-size-lg)" }}>mise doctor</div>
            <div className="muted" style={{ fontSize: "var(--font-size-sm)" }}>
              版本 {scalar(data.version)} · 退出码 {doctor.data.exit_code}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <StatusPill level={issueTone(problems)} text={"问题 " + problems.length} />
          <StatusPill level={issueTone(warnings)} text={"警告 " + warnings.length} />
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((v) => !v)}>{showRaw ? "隐藏原始" : "原始 JSON"}</Button>
          <Button variant="primary" size="sm" onClick={() => navigator.clipboard.writeText(body)}>复制诊断报告</Button>
          <Button data-tour="doctor-refresh" size="sm" onClick={() => doctor.refetch()}>重新检测</Button>
        </div>
      </Card>

      {showRaw ? (
        <Card style={{ padding: "var(--space-5)" }}>
          <Code block>{body}</Code>
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)", alignItems: "stretch" }}>
            <ScalarCards data={data} />
            <ListCards entries={entries} />
          </div>

          <Section title={"问题与警告"} desc="依据严重级排序">
            {problems.length === 0 && warnings.length === 0 ? <div className="muted">健康，暂无问题。</div> : null}
            {[...problems.map((p) => ({ p, kind: "problem" as const })), ...warnings.map((w) => ({ p: w, kind: "warning" as const }))]
              .slice(0, 20)
              .map(({ p, kind }, i) => {
                const sev = severityOf(p);
                const view = itemView(p);
                const o = p as Record<string, unknown>;
                const fix = typeof o.cmd === "string" ? o.cmd : typeof o.fix === "string" ? o.fix : "";
                return (
                  <Card key={i} style={{ padding: "var(--space-3)", marginBottom: "var(--space-2)", borderLeft: "3px solid var(--color-" + sev + ")" }}>
                    <div className="flex items-center gap-2">
                      <StatusPill level={sev} text={kind === "problem" ? "问题" : "警告"} />
                      <span style={{ fontWeight: 500 }}>{view.title}</span>
                      {view.sub ? <span className="muted" style={{ fontSize: "var(--font-size-sm)" }}>{view.sub}</span> : null}
                    </div>
                    {fix ? <Code block>{fix}</Code> : null}
                  </Card>
                );
              })}
          </Section>
        </>
      )}
    </div>
  );
}

function ScalarCards({ data }: { data: Record<string, unknown> }) {
  const scalars = ["version", "os", "shell", "settings"];
  return (
    <>
      {scalars.map((key) => {
        const v = data[key];
        if (v === undefined) return null;
        const rows = kvRows(v);
        return (
          <Card key={key} style={{ padding: "var(--space-4)", minHeight: 120 }}>
            <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>{GROUP_LABELS[key] ?? key}</div>
            {rows && rows.length > 0 ? (
              <table className="mui-table kv-table">
                <tbody>
                  {rows.slice(0, 16).map(([k, val]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td className="mono">{val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : rows ? (
              <div className="muted" style={{ fontSize: "var(--font-size-sm)" }}>—（默认）</div>
            ) : (
              <div className="mono muted">{scalar(v)}</div>
            )}
          </Card>
        );
      })}
    </>
  );
}

function ListCards({ entries }: { entries: [string, unknown][] }) {
  return (
    <>
      {entries.map(([key, value]) => {
        const items = value as unknown[];
        return (
          <Card key={key} style={{ padding: "var(--space-4)", minHeight: 120 }}>
            <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-2)" }}>
              <span style={{ fontWeight: 600 }}>{GROUP_LABELS[key] ?? key}</span>
              <Chip tone={items.length === 0 ? "ok" : "info"}>{items.length} 项</Chip>
            </div>
            {items.length === 0 ? <div className="muted" style={{ fontSize: "var(--font-size-sm)" }}>（空）</div> : (
              <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--font-size-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 220, overflow: "auto" }}>
                {items.map((it, i) => {
                  const view = itemView(it);
                  return (
                    <li key={i} className="flex items-baseline gap-2">
                      <span className={"status-dot shrink-0 " + view.sev} style={{ alignSelf: "center" }} />
                      <span>{view.title}</span>
                      {view.sub ? <span className="muted mono ellipsis" style={{ fontSize: "var(--font-size-xs)" }}>{view.sub}</span> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </>
  );
}
