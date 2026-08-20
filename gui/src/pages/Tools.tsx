import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import { Button, Card, Chip, EmptyState, Section, Select, Spinner } from "../components/ui/primitives";
import { errMsg } from "../api/types";

interface ToolItem {
  name?: string;
  version?: string;
  requested_version?: string;
  source?: string;
  installed?: boolean;
}

export default function Tools() {
  const { baseUrl, token, cwd } = useSettings();
  const api = apiFrom({ baseUrl, token });
  const qc = useQueryClient();
  const tools = useQuery({ queryKey: ["tools", cwd, baseUrl], queryFn: () => api.tools(cwd) });

  const [installing, setInstalling] = useState<ToolItem | null>(null);
  const [using, setUsing] = useState<ToolItem | null>(null);
  const [versionSel, setVersionSel] = useState("");
  const [lastOut, setLastOut] = useState("");

  const install = useMutation({
    mutationFn: () => api.toolInstall({ tool: installing?.name ?? "", version: undefined, cwd }),
    onSuccess: (r) => { setLastOut(r.output); qc.invalidateQueries({ queryKey: ["tools"] }); setInstalling(null); },
    onError: (e) => setLastOut(errMsg(e)),
  });
  const useVer = useMutation({
    mutationFn: () => api.toolUse({ tool: using?.name ?? "", version: versionSel || (using?.requested_version ?? "") , cwd }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tools"] }); qc.invalidateQueries({ queryKey: ["env"] }); setUsing(null); setLastOut("已应用 " + using?.name + "@" + (versionSel || using?.requested_version)); },
    onError: (e) => setLastOut(errMsg(e)),
  });

  const versions = useQuery({
    queryKey: ["lsremote", using?.name, baseUrl],
    queryFn: () => api.toolVersions(using?.name ?? ""),
    enabled: !!using,
  });

  if (tools.isError) return <Card style={{ padding: "var(--space-5)" }}>加载失败：{tools.error.message}</Card>;
  if (tools.isLoading) return <Spinner label="加载工具列表…" />;

  const rawTools: unknown = tools.data?.tools;
  const list: ToolItem[] = Array.isArray(rawTools) ? (rawTools as ToolItem[]) : [];

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Section title="工具" desc={"mise ls · " + list.length + " 项"} actions={<Button size="sm" onClick={() => tools.refetch()}>刷新</Button>}>
        {list.length === 0 ? <EmptyState title="暂无工具" hint="在项目 mise.toml 中声明工具，或点击安装。" /> : (
          <table className="mui-table">
            <thead><tr><th>工具</th><th>版本</th><th>请求</th><th>来源</th><th>状态</th><th /></tr></thead>
            <tbody>
              {list.map((t, i) => (
                <tr key={t.name ?? i}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td className="mono">{t.version ?? "—"}</td>
                  <td className="mono muted">{t.requested_version ?? "—"}</td>
                  <td className="mono muted" style={{ maxWidth: 260 }}><span className="ellipsis">{t.source ?? "—"}</span></td>
                  <td>{t.installed ? <Chip tone="ok">已安装</Chip> : <Chip tone="warn">未安装</Chip>}</td>
                  <td>
                    <div className="flex gap-2">
                      <Button data-tour="tools-install" size="sm" onClick={() => setInstalling(t)}>安装</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setUsing(t); setVersionSel(t.requested_version ?? ""); }}>切换版本</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {installing && (
        <Card style={{ padding: "var(--space-5)" }}>
          <h3 style={{ marginBottom: "var(--space-3)" }}>安装 {installing.name}</h3>
          <div className="flex gap-3 items-center">
            <Button variant="primary" disabled={install.isPending} onClick={() => install.mutate()}>
              {install.isPending ? "安装中…" : "运行 mise install"}
            </Button>
            <Button onClick={() => setInstalling(null)}>取消</Button>
          </div>
          {lastOut ? <Card style={{ marginTop: "var(--space-3)", padding: "var(--space-3)" }} className="mono" ><pre style={{ margin: 0, fontSize: "var(--font-size-sm)" }}>{lastOut}</pre></Card> : null}
        </Card>
      )}

      {using && (
        <Card style={{ padding: "var(--space-5)" }}>
          <h3 style={{ marginBottom: "var(--space-3)" }}>切换 {using.name} 版本</h3>
          <div className="flex gap-3 items-center">
            <Select value={versionSel} onChange={(e) => setVersionSel(e.target.value)} style={{ maxWidth: 280 }}>
              {(!versions.data ? [] : versions.data.versions).map((v) => <option key={v} value={v}>{v}</option>)}
              {versions.isLoading && <option>加载远程版本…</option>}
            </Select>
            <Button variant="primary" disabled={!versionSel || useVer.isPending} onClick={() => useVer.mutate()}>应用 mise use</Button>
            <Button onClick={() => setUsing(null)}>取消</Button>
          </div>
          {lastOut ? <div className="muted mono mt-3">{lastOut}</div> : null}
        </Card>
      )}
    </div>
  );
}
