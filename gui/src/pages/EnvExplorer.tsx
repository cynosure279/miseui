import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import type { EnvVariable, PathEntry, DiffItem } from "../api/types";
import { Button, Card, Chip, EmptyState, Input, Section, Select, SourcePill, Spinner, Toggle, Toast } from "../components/ui/primitives";
import { ORIGIN_META, groupByOrigin, isSensitiveKey, maskValue, originOf, renderTemplate, varsMap } from "../lib/env";
import { errMsg } from "../api/types";
import type { ChangeEvent } from "react";

type Tab = "vars" | "path" | "diff";

export default function EnvExplorer() {
  const s = useSettings();
  const api = apiFrom({ baseUrl: s.baseUrl, token: s.token });
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("vars");
  const [search, setSearch] = useState("");
  const [maskSensitive, setMaskSensitive] = useState(true);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [target, setTarget] = useState<"project" | "global" | "env">("project");
  const [targetEnv, setTargetEnv] = useState("");
  const editingRef = { current: false };
  const [addKey, setAddKeyGlobal] = useState("");
  const [addVal, setAddValGlobal] = useState("");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const apiAddDisabled = addKey.trim() === "";

  // editing context bound to settings (cwd/env); switching tab keeps query cached
  const envQ = useQuery({
    queryKey: ["env", s.cwd, s.envName, s.baseUrl],
    queryFn: () => api.env(s.cwd, s.envName),
  });
  const pathQ = useQuery({
    queryKey: ["envpath", s.cwd, s.envName, s.baseUrl],
    queryFn: () => api.envPath(s.cwd, s.envName),
  });
  const diffQ = useQuery({
    queryKey: ["envdiff", s.cwd, s.envName, s.baseUrl],
    queryFn: () => api.envDiff({ cwd: s.cwd, env: s.envName }, { cwd: s.cwd, env: s.envName || "staging" }),
    enabled: false,
  });

  const setMut = useMutation({
    mutationFn: (body: { key: string; value: string }) =>
      api.envSet({ key: body.key, value: body.value, cwd: s.cwd, global: target === "global", env: target === "env" ? (targetEnv || undefined) : undefined }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["env"] });
      setAddMsg({ ok: true, text: "已写入 " + vars.key + "（mise set 成功）" });
      setToast("已写入 " + vars.key);
      setEditing(null);
      if (!editingRef) { setAddKeyGlobal(""); setAddValGlobal(""); }
    },
    onError: (e) => { const msg = "写入失败：" + errMsg(e); setAddMsg({ ok: false, text: msg }); setToast(msg); },
  });
  const unsetMut = useMutation({
    mutationFn: (key: string) => api.envUnset({ key, cwd: s.cwd }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["env"] }); setToast("已移除 "); },
    onError: (e) => setToast("移除失败：" + errMsg(e)),
  });

  const vars = envQ.data?.vars ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vars;
    return vars.filter((v) => v.key.toLowerCase().includes(q) || v.value.toLowerCase().includes(q) || (v.source ?? "").toLowerCase().includes(q));
  }, [vars, search]);

  const vm = useMemo(() => varsMap(vars), [vars]);
  const stats = useMemo(() => {
    const origins = new Map(vars.map((v) => [originOf(v.source, v.tool), 1]));
    return { total: vars.length, origins: origins.size };
  }, [vars]);

  function runDiff() {
    diffQ.refetch();
  }

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      {/* context bar */}
      <Card className="flex items-center" style={{ padding: "var(--space-4)", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <label className="muted" style={{ fontSize: "var(--font-size-sm)" }}>工作目录</label>
        <Input data-tour="env-cwd" className="mono" style={{ maxWidth: 320 }} value={s.cwd} onChange={(e) => s.setCwd(e.target.value)} placeholder="留空 = server 目录" />
        <label className="muted" style={{ fontSize: "var(--font-size-sm)" }}>环境</label>
        <Input style={{ maxWidth: 180 }} value={s.envName} onChange={(e) => s.setEnvName(e.target.value)} placeholder="如 production" />
        <Toggle checked={maskSensitive} onChange={setMaskSensitive} label="打码敏感值" />
        <div className="flex-1" />
        <Button size="sm" variant={tab === "vars" ? "primary" : "default"} onClick={() => setTab("vars")}>变量 · {stats.total}</Button>
        <Button data-tour="env-pathbtn" size="sm" variant={tab === "path" ? "primary" : "default"} onClick={() => setTab("path")}>PATH</Button>
        <Button data-tour="env-diffbtn" size="sm" variant={tab === "diff" ? "primary" : "default"} onClick={() => { setTab("diff"); runDiff(); }}>对比</Button>
        <Button size="sm" variant="ghost" onClick={() => envQ.refetch()}>刷新</Button>
      </Card>

      {envQ.isError ? <Card style={{ padding: "var(--space-4)" }} className="flex items-center gap-3"><Chip tone="error">加载失败</Chip><span>{envQ.error.message}</span></Card> : null}

      {tab === "vars" ? (
        <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="flex items-center gap-3">
            <Input data-tour="env-search" placeholder="搜索 key / 值 / 来源…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
            {envQ.isFetching ? <span className="muted">刷新中…</span> : null}
          </div>

          {groupByOrigin(filtered).length === 0 && !envQ.isPending ? (
            <EmptyState title="没有匹配的环境变量" hint="调整搜索，或添加一个变量。" />
          ) : null}

          {groupByOrigin(filtered).map((g) => (
            <div key={g.origin}>
              <div className="flex items-center gap-2" style={{ marginBottom: "var(--space-2)" }}>
                <span className="status-dot" style={{ background: ORIGIN_META[g.origin].color }} />
                <span style={{ fontWeight: 600 }}>{ORIGIN_META[g.origin].label}</span>
                <span className="muted" style={{ fontSize: "var(--font-size-sm)" }}>{g.vars.length} 个</span>
              </div>
              <div className="flex" style={{ flexDirection: "column", gap: "var(--space-2)" }}>
                {g.vars.map((v, i) => (
                  <EnvRow
                    key={v.key}
                    v={v}
                    index={i}
                    mask={maskSensitive && isSensitiveKey(v.key)}
                    vm={vm}
                    editing={editing === v.key}
                    editVal={editVal}
                    setEditVal={setEditVal}
                    startEdit={() => { setEditing(v.key); setEditVal(v.value); }}
                    saveEdit={() => { editingRef.current = true; if (v.value !== editVal) setMut.mutate({ key: v.key, value: editVal }); else { setEditing(null); } }}
                    cancelEdit={() => setEditing(null)}
                    onUnset={() => unsetMut.mutate(v.key)}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* structured add / set env var */}
          <Card data-tour="env-add" style={{ padding: "var(--space-5)" }}>
            <h3 style={{ marginBottom: "var(--space-2)" }}>新增 / 修改环境变量</h3>
            <div className="muted" style={{ fontSize: "var(--font-size-sm)", marginBottom: "var(--space-3)" }}>
              结构化写入 mise.toml：值支持 {"{{VAR}}"} 模板；目标可选项目 / 全局 / 环境专属。
            </div>
            <div className="flex" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 22%) 1fr", gap: "var(--space-3)", alignItems: "center" }}>
                <label className="muted" style={{ fontSize: "var(--font-size-sm)" }}>键 (KEY)</label>
                <Input placeholder="如 NODE_ENV" value={addKey} onChange={(e) => setAddKeyGlobal(e.target.value)} />
                <label className="muted" style={{ fontSize: "var(--font-size-sm)" }}>值 (VALUE)</label>
                <Input placeholder="如 production（也可 {{ USE_DB_URL }}）" value={addVal} onChange={(e) => setAddValGlobal(e.target.value)} />
              </div>
              <div className="flex gap-3 items-center" style={{ flexWrap: "wrap" }}>
                <label className="muted" style={{ fontSize: "var(--font-size-sm)" }}>写入到</label>
                <Select value={target} onChange={(e) => setTarget(e.target.value as typeof target)} style={{ maxWidth: 200 }}>
                  <option value="project">项目 mise.toml</option>
                  <option value="global">全局配置（--global）</option>
                  <option value="env">环境专属（-E &lt;env&gt;）</option>
                </Select>
                {target === "env" ? <Input placeholder="env 名，如 production" value={targetEnv} onChange={(e) => setTargetEnv(e.target.value)} style={{ maxWidth: 180 }} /> : null}
                <div className="flex-1" />
                <Button variant="primary" disabled={apiAddDisabled || setMut.isPending} onClick={() => { editingRef.current = false; setMut.mutate({ key: addKey, value: addVal }); }}>
                  {setMut.isPending ? "写入中…" : "写入（mise set）"}
                </Button>
              </div>
              {addMsg ? (
                <div style={{ color: addMsg.ok ? "var(--color-ok)" : "var(--color-error)", fontSize: "var(--font-size-sm)" }} role="status">
                  {addMsg.ok ? "✓ " : "⚠ "}{addMsg.text}
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "path" ? (
        <PathPanel entries={pathQ.data?.entries ?? []} loading={pathQ.isPending} error={pathQ.error?.message} />
      ) : null}

      {tab === "diff" ? (
        <DiffPanel
          items={(diffQ.data?.diff as DiffItem[] | undefined) ?? []}
          loading={diffQ.isPending || diffQ.isFetching}
          error={diffQ.error?.message}
          a={diffQ.data?.a}
          b={diffQ.data?.b}
        />
      ) : null}

      {toast ? <Toast message={toast} onClose={() => setToast("")} /> : null}
    </div>
  );

}

function EnvRow(props: {
  v: EnvVariable;
  index: number;
  mask: boolean;
  vm: Map<string, string>;
  editing: boolean;
  editVal: string;
  setEditVal: (v: string) => void;
  startEdit: () => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  onUnset: () => void;
}) {
  const { v, index, mask, vm, editing, editVal, setEditVal, startEdit, saveEdit, cancelEdit, onUnset } = props;
  const color = ORIGIN_META[originOf(v.source, v.tool)].color;
  const tpl = /\{\{/.test(v.value) && typeof v.value === "string";
  const rendered = tpl ? renderTemplate(v.value, vm) : null;

  return (
    <Card
      className="stack-enter"
      style={{ padding: "var(--space-3) var(--space-4)", borderLeft: "3px solid " + color, animationDelay: Math.min(index * 30, 400) + "ms" }}
    >
      <div className="flex items-center gap-3" style={{ flexWrap: "wrap" }}>
        <code style={{ fontWeight: 600, minWidth: 140 }}>{v.key}</code>
        {editing ? (
          <Input className="mono" autoFocus value={editVal} onChange={(e: ChangeEvent<HTMLInputElement>) => setEditVal(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        ) : (
          <code
            className="mono ellipsis"
            style={{ flex: 1, minWidth: 160, whiteSpace: "nowrap", color: mask ? "var(--color-text-secondary)" : undefined }}
            title={v.value}
          >
            {mask ? maskValue(v.key, v.value) : v.value}
          </code>
        )}
        {tpl && !editing ? <Chip tone={rendered?.ok ? "info" : "warn"} title={rendered?.rendered}>模板</Chip> : null}
        <SourcePill source={v.source} tool={v.tool} />
        {editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="primary" onClick={saveEdit}>保存</Button>
            <Button size="sm" onClick={cancelEdit}>取消</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={startEdit}>编辑</Button>
            <Button size="sm" variant="ghost" onClick={onUnset}>移除</Button>
          </div>
        )}
      </div>
      {tpl && rendered && (
        <div className="muted mono mt-2" style={{ fontSize: "var(--font-size-xs)", wordBreak: "break-all" }}>
          模板 → {rendered.rendered}
          {v.raw ? <span className="muted"> · 原文 {v.raw}</span> : null}
        </div>
      )}
    </Card>
  );
}

function PathPanel({ entries, loading, error }: { entries: PathEntry[]; loading: boolean; error?: string }) {
  if (loading) return <Spinner label="解析 PATH…" />;
  if (error) return <Card style={{ padding: "var(--space-4)" }}>{error}</Card>;
  if (entries.length === 0) return <EmptyState title="PATH 为空" />;
  const missing = entries.filter((e) => e.missing).length;
  const dups = entries.filter((e) => e.duplicate).length;
  const shims = entries.filter((e) => e.is_shim).length;
  return (
    <Section title="PATH 可视化器" desc={"共 " + entries.length + " 段 · 缺失 " + missing + " · 重复 " + dups + " · shims " + shims}>
      <div className="path-chain">
        {entries.map((e) => (
          <span key={e.index} className={"flex items-center gap-1"}>
            <span className={"path-chip" + (e.missing || e.duplicate ? " error" : "") + (e.is_shim ? " shim" : "")}
              title={(e.missing ? "缺失目录" : e.duplicate ? "重复" : e.is_shim ? "mise shims" : "") + " · " + e.path}>
              {e.is_shim ? "🛠 " : ""}{e.path}
            </span>
            {e.missing ? <span title="目录不存在" style={{ color: "var(--color-error)", fontSize: 10 }}>⚠</span> : null}
            {e.duplicate ? <span title="重复项" style={{ color: "var(--color-warn)", fontSize: 10 }}>≈</span> : null}
            {e.index < entries.length - 1 ? <span className="path-sep">→</span> : null}
          </span>
        ))}
      </div>
    </Section>
  );
}

function DiffPanel({
  items, loading, error, a, b,
}: { items: DiffItem[]; loading: boolean; error?: string; a?: { cwd?: string; env?: string }; b?: { cwd?: string; env?: string } }) {
  if (loading) return <Spinner label="计算差异…" />;
  if (error) return <Card style={{ padding: "var(--space-4)" }}>{error}</Card>;
  if (items.length === 0 && false) return <EmptyState title="两侧完全相同" />;
  return (
    <Section
      title="环境对比 Diff"
      desc={(!a && !b) ? "A = 当前上下文，B = 当前环境 staging（可在比较前切换 env）" : "A ≈ B 对比"}
      actions={<Button size="sm" variant="primary" onClick={() => location.reload()}>重算</Button>}
    >
      {items.length === 0 ? <div className="muted">两侧环境变量的值完全一致（或环境差异未在配置中体现）。</div> : null}
      <table className="mui-table">
        <thead><tr><th>变量</th><th>状态</th><th>A 值</th><th>B 值</th><th>来源</th></tr></thead>
        <tbody>
          {items.map((d, i) => (
            <tr key={d.key + i} style={{ background: d.state === "added" ? "var(--color-ok-subtle)" : d.state === "removed" ? "var(--color-error-subtle)" : "var(--color-warn-subtle)" }}>
              <td className="mono" style={{ fontWeight: 600 }}>{d.key}</td>
              <td><Chip tone={d.state === "added" ? "ok" : d.state === "removed" ? "error" : "warn"}>{d.state}</Chip></td>
              <td className="mono">{d.a_value ?? "—"}</td>
              <td className="mono">{d.b_value ?? "—"}</td>
              <td className="mono muted" style={{ maxWidth: 240 }}><span className="ellipsis">{(d.a_source ?? d.b_source) || "—"}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  );
}
