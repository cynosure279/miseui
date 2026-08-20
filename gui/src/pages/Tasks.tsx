import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useSettings } from "../state/settings";
import { apiFrom, streamWsUrl } from "../api/client";
import { Button, Card, Chip, EmptyState, Section, Spinner } from "../components/ui/primitives";

interface TaskItem { name?: string; description?: string; alias?: string[]; aliases?: string[]; source?: string; }

interface LogLine { stream: string; line: string; }

export default function Tasks() {
  const { baseUrl, token, cwd } = useSettings();
  const api = apiFrom({ baseUrl, token });
  const tasks = useQuery({ queryKey: ["tasks", cwd, baseUrl], queryFn: () => api.tasks(cwd) });

  const [running, setRunning] = useState<TaskItem | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [exit, setExit] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  function run(task: TaskItem) {
    if (busy) return;
    setRunning(task);
    setLogs([]);
    setExit(null);
    setBusy(true);
    const ws = new WebSocket(streamWsUrl(baseUrl, token));
    wsRef.current = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ cmd: "task:run", task: task.name, args: [], cwd: cwd || undefined }));
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data as string);
        if (m.type === "log") setLogs((prev) => [...prev.slice(-500), { stream: m.stream, line: m.line }]);
        else if (m.type === "exit") { setExit(m.code); setBusy(false); ws.close(); }
        else if (m.type === "pong") { /* noop */ }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => { setExit(-99); setBusy(false); };
    ws.onclose = () => { setBusy(false); };
  }

  function stop() {
    if (wsRef.current) { try { wsRef.current.close(); } catch { /* ignore */ } }
    setBusy(false);
    setRunning(null);
  }

  if (tasks.isError) return <Card style={{ padding: "var(--space-5)" }}>加载失败：{tasks.error.message}</Card>;
  if (tasks.isLoading) return <Spinner label="加载任务…" />;

  const rawTasks: unknown = tasks.data?.tasks;
  const list: TaskItem[] = Array.isArray(rawTasks) ? (rawTasks as TaskItem[]) : [];

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Section title="任务" desc={"mise tasks ls · " + list.length + " 项"} actions={<Button size="sm" onClick={() => tasks.refetch()}>刷新</Button>}>
        {list.length === 0 ? <EmptyState title="暂无任务" hint="在 mise.toml 的 [tasks] 中定义任务。" /> : (
          <table className="mui-table">
            <thead><tr><th>任务</th><th>描述</th><th /></tr></thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={t.name ?? i}>
                  <td style={{ fontWeight: 600 }} className="mono">{t.name}</td>
                  <td>{t.description || "—"}</td>
                  <td>{Array.isArray(t.aliases) ? t.aliases.map((a, j) => <Chip key={j} tone="info">{a}</Chip>) : Array.isArray(t.alias) ? t.alias.map((a, j) => <Chip key={j} tone="info">{a}</Chip>) : "—"}</td>
                  <td>
                    <Button data-tour="tasks-run" size="sm" variant="primary" disabled={busy} onClick={() => run(t)}>运行</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {running && (
        <Card style={{ padding: "var(--space-5)" }}>
          <div className="flex justify-between items-center" style={{ marginBottom: "var(--space-3)" }}>
            <h3 className="mono">mise run {running.name}</h3>
            <div className="flex gap-2 items-center">
              {exit !== null ? <Chip tone={exit === 0 ? "ok" : "error"}>退出码 {exit}</Chip> : <Chip tone="info">运行中…</Chip>}
              <Button size="sm" variant="ghost" disabled={!busy} onClick={stop}>停止</Button>
            </div>
          </div>
          <pre
            style={{
              background: "var(--color-bg)", color: "var(--color-text)", borderRadius: "var(--radius-md)",
              padding: "var(--space-4)", maxHeight: 420, overflow: "auto", fontSize: "var(--font-size-sm)",
              fontFamily: "var(--font-mono)", margin: 0,
            }}
          >
            {logs.map((l, i) => (
              <div key={i} style={{ color: l.stream === "err" ? "var(--color-error)" : undefined }}>{l.line}</div>
            ))}
          </pre>
        </Card>
      )}
    </div>
  );
}
