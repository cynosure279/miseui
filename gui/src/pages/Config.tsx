import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import { Button, Card, Code, EmptyState, Section, Spinner } from "../components/ui/primitives";
import { errMsg } from "../api/types";

interface ConfigItem { path?: string; source?: string; src?: string; }

export default function Config() {
  const { baseUrl, token, cwd } = useSettings();
  const api = apiFrom({ baseUrl, token });
  const cfg = useQuery({ queryKey: ["config", cwd, baseUrl], queryFn: () => api.configs(cwd) });
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [extMsg, setExtMsg] = useState("");

  async function externalOpen(path: string) {
    setExtMsg("");
    try {
      const r = await api.configOpen(path, cwd);
      setExtMsg("已用系统默认编辑器打开：" + (r.opened_via ?? ""));
    } catch (e) {
      setExtMsg("打开失败：" + errMsg(e));
    }
  }

  async function open(path: string) {
    setOpenFile(path);
    setErr("");
    setContent(null);
    try {
      const r = await api.configRaw(path, cwd);
      setContent(r.content);
    } catch (e) {
      setErr(errMsg(e));
    }
  }

  if (cfg.isError) return <Card style={{ padding: "var(--space-5)" }}>加载失败：{cfg.error.message}</Card>;
  if (cfg.isLoading) return <Spinner label="加载配置…" />;

  const files = (Array.isArray(cfg.data?.configs) ? cfg.data!.configs as unknown[] : []).map(
    (x) => (typeof x === "object" && x !== null ? (x as ConfigItem) : { path: String(x) })
  );

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Section title="配置文件" desc={"mise config ls -J · 只读查看；修改请用环境变量/设置页的写操作"} actions={<Button size="sm" onClick={() => cfg.refetch()}>刷新</Button>}>
        {extMsg ? <div style={{ fontSize: "var(--font-size-sm)", color: extMsg.startsWith("已") ? "var(--color-ok)" : "var(--color-error)", marginBottom: "var(--space-3)" }}>{extMsg}</div> : null}
        {files.length === 0 ? <EmptyState title="暂无配置文件" /> : (
          <table className="mui-table">
            <thead><tr><th>路径</th><th>来源</th><th /></tr></thead>
            <tbody>
              {files.map((f, i) => {
                const path = f.path ?? f.src ?? f.source ?? "";
                return (
                  <tr key={path || i}>
                    <td className="mono">{path}</td>
                    <td className="mono muted">{f.source ?? "—"}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button size="sm" variant={openFile === path ? "primary" : "ghost"} onClick={() => open(path)}>查看</Button>
                        <Button data-tour="config-extopen" size="sm" variant="ghost" onClick={() => externalOpen(path)}>外部打开</Button>
                        <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(path)}>复制路径</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {openFile && (
        <Section
          title={openFile}
          desc="只读预览（配置内容保护模式：仅允许读取 mise 声明过的文件）"
          actions={<Button size="sm" onClick={() => { if (content) navigator.clipboard.writeText(content); }}>复制</Button>}
        >
          {err ? <div style={{ color: "var(--color-error)" }}>{err}</div> : null}
          {content === null && !err ? <Spinner /> : null}
          {content !== null ? <Code block>{content}</Code> : null}
        </Section>
      )}
    </div>
  );
}
