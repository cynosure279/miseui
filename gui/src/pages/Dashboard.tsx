import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import { Section, Card, StatusPill, Spinner, EmptyState } from "../components/ui/primitives";

export default function Dashboard() {
  const { baseUrl, token, cwd } = useSettings();
  const api = apiFrom({ baseUrl, token });
  const health = useQuery({ queryKey: ["health", baseUrl, token], queryFn: () => api.health() });
  const env = useQuery({ queryKey: ["env", cwd], queryFn: () => api.env(cwd) });
  const tools = useQuery({ queryKey: ["tools", cwd], queryFn: () => api.tools(cwd) });
  const doctor = useQuery({ queryKey: ["doctor", cwd], queryFn: () => api.doctor(cwd) });

  if (health.isError) {
    return (
      <EmptyState
        title="无法连接中间件"
        hint={"请确认 miseui-server 已启动，或前往「连接」调整地址。" + (health.error ? " (" + health.error.message + ")" : "")}
      />
    );
  }
  if (health.isLoading) return <Spinner label="正在连接中间件…" />;

  const envCount = env.data?.vars?.length ?? 0;
  const toolCount = Array.isArray(tools.data?.tools) ? (tools.data.tools as unknown[]).length : 0;
  const problems = (doctor.data?.data as Record<string, unknown> | undefined)?.problems;
  const problemsCount = Array.isArray(problems) ? problems.length : 0;

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
        {[
          { label: "服务状态", value: health.data?.status ?? "?", sub: "miseui-server " + (health.data?.version ?? ""), tone: health.data?.status === "ok" ? "ok" as const : ("error" as const) },
          { label: "mise 版本", value: health.data?.mise ?? "—", sub: "公开 CLI 驱动", tone: "info" as const },
          { label: "环境变量", value: String(envCount), sub: "解析结果数量", tone: "ok" as const },
          { label: "已配置工具", value: String(toolCount), sub: "mise ls", tone: "info" as const },
          { label: "诊断问题", value: String(problemsCount), sub: "mise doctor", tone: problemsCount > 0 ? ("warn" as const) : ("ok" as const) },
          { label: "工作目录", value: cwd || "（默认）", sub: "cwd 参数", tone: "info" as const },
        ].map((s) => (
          <Card key={s.label} className="flex" style={{ flexDirection: "column", padding: "var(--space-4)", gap: "var(--space-2)" }}>
            <div className="flex justify-between items-center">
              <span className="muted" style={{ fontSize: "var(--font-size-sm)" }}>{s.label}</span>
              <StatusPill level={s.tone} text={s.label === "服务状态" ? (health.data?.mise ? "在线" : "离线") : s.tone} />
            </div>
            <div className="mono" style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, wordBreak: "break-all" }}>{s.value}</div>
            <div className="muted" style={{ fontSize: "var(--font-size-xs) " }}>{s.sub}</div>
          </Card>
        ))}
      </div>
      <Section title="快捷操作" desc="常用入口">
        <div className="flex gap-3" style={{ flexWrap: "wrap" }}>
          <Link className="btn btn-primary" to="/env">打开环境变量瀑布</Link>
          <Link className="btn" to="/doctor">查看健康中心</Link>
          <Link className="btn" to="/tasks">运行任务</Link>
          <Link className="btn" to="/connect">管理连接</Link>
        </div>
      </Section>
    </div>
  );
}
