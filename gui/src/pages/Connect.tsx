import { useQuery } from "@tanstack/react-query";
import { useSettings } from "../state/settings";
import { apiFrom } from "../api/client";
import { Button, Card, Chip, Section } from "../components/ui/primitives";

export default function Connect() {
  const s = useSettings();
  const api = apiFrom({ baseUrl: s.baseUrl, token: s.token });
  const probe = useQuery({ queryKey: ["about", s.baseUrl, s.token], queryFn: () => api.about(), retry: 1, enabled: true });

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Section title="连接中间件" desc="MiseUI 通过 miseui-server 访问任意 mise（本机或远端）">
        <div className="flex" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 100 }}>Server URL</span>
            <input className="input mono" value={s.baseUrl} onChange={(e) => s.setBaseUrl(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 100 }}>Token</span>
            <input className="input mono" type="password" value={s.token} onChange={(e) => s.setToken(e.target.value)} placeholder="远端监听必须填写" />
          </div>
          <div className="flex gap-3 items-center">
            <Button data-tour="connect-test" variant="primary" onClick={() => probe.refetch()}>测试连接</Button>
            {probe.isLoading ? <span className="muted">连接中…</span> : null}
            {probe.isSuccess ? <Chip tone="ok">已连接 · {probe.data?.service ?? "miseui-server"} v{probe.data?.version ?? "?"}</Chip> : null}
            {probe.isError ? <Chip tone="error">连接失败：{probe.error.message}</Chip> : null}
          </div>
        </div>
      </Section>

      {(probe.isSuccess && probe.data) && (
        <Card style={{ padding: "var(--space-5)" }}>
          <table className="mui-table kv-table">
            <tbody>
              <tr><td>服务</td><td className="mono">{probe.data.service}</td></tr>
              <tr><td className="muted">服务版本</td><td className="mono">{probe.data.version}</td></tr>
              <tr><td className="muted">mise 二进制</td><td className="mono">{probe.data.mise_bin}</td></tr>
              <tr><td className="muted">mise 版本</td><td className="mono">{probe.data.mise_version ?? "—"}</td></tr>
              <tr><td className="muted">鉴权</td><td>{probe.data.auth ? <Chip tone="warn">token 保护已开启</Chip> : <Chip tone="ok">本机免鉴权</Chip>}</td></tr>
            </tbody>
          </table>
        </Card>
      )}

      <Section title="使用说明" desc="远程部署与安全">
        <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--font-size-sm)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <li>桌面默认自动使用本机 <span className="mono">127.0.0.1:18771</span>；也可把 URL 指向任何运行 miseui-server 的机器。</li>
          <li>非回环监听（<span className="mono">--host 0.0.0.0</span>）时 server 强制要求 <span className="mono">--token</span>，浏览器侧在「连接/设置」填入即可。</li>
          <li>公网建议走 SSH 隧道或反向代理加 TLS；token 只经请求头/WS 传递，永不写入日志。</li>
          <li>server 通过 <span className="mono">--mise-bin</span> 指定 mise（或测试夹具），不拼 shell，全部 argv 传递。</li>
        </ul>
      </Section>
    </div>
  );
}
