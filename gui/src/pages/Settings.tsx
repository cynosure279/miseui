import { useQuery } from "@tanstack/react-query";
import { useSettings } from "../state/settings";
import { useThemeStore } from "../theme/useTheme";
import { apiFrom } from "../api/client";
import { Chip, Select, Section, Toggle } from "../components/ui/primitives";
import { prettyJSON } from "../lib/env";

export default function Settings() {
  const s = useSettings();
  const theme = useThemeStore();
  const api = apiFrom({ baseUrl: s.baseUrl, token: s.token });
  const miseSettings = useQuery({ queryKey: ["settings", s.baseUrl], queryFn: () => api.settings() });

  const settingsData = miseSettings.data?.settings;
  const isObject = typeof settingsData === "object" && settingsData !== null && !miseSettings.data?.raw;

  return (
    <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
      <Section title="外观（小风格主题）" desc="主题注册表：每个主题覆盖一组设计令牌">
        <div className="flex" style={{ flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>主题</span>
            <Select data-tour="settings-theme" value={theme.themeId} onChange={(e) => theme.setThemeId(e.target.value as never)} style={{ maxWidth: 280 }}>
              <option value="mise">Mise 质感（默认）</option>
              <option value="glass-dark">玻璃液态（Glass）· 浅/深</option>
              <option value="hc">高对比（黑白·浅/深）</option>
              <option value="material-you">Material You 动态取色</option>
            </Select>
          </div>
          {theme.themeId === "material-you" && (
            <div className="flex items-center gap-3">
              <span className="muted" style={{ width: 120 }}>种子色</span>
              <input type="color" value={theme.seed} onChange={(e) => theme.setSeed(e.target.value)} style={{ width: 60, height: 34, border: "none", background: "none" }} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>明暗模式</span>
            <Toggle checked={theme.mode === "dark"} onChange={(v) => theme.setMode(v ? "dark" : "light")} label={theme.mode === "dark" ? "深色" : "浅色"} />
          </div>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>减少动画</span>
            <Toggle checked={theme.reduceMotion} onChange={theme.setReduceMotion} label="尊重无障碍偏好，关闭物理动画" />
          </div>
        </div>
      </Section>

      <Section title="中间件连接" desc="桌面版默认 http://127.0.0.1:18771；Web/远端填 server 地址与 token">
        <div className="flex" style={{ flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>Server URL</span>
            <input className="input mono" value={s.baseUrl} onChange={(e) => s.setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:18771" />
          </div>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>Token</span>
            <input className="input mono" type="password" value={s.token} onChange={(e) => s.setToken(e.target.value)} placeholder="留空 = 本机免鉴权" />
          </div>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>工作目录 cwd</span>
            <input data-tour="settings-cwd" className="input mono" value={s.cwd} onChange={(e) => s.setCwd(e.target.value)} placeholder="留空 = server 所在目录" />
          </div>
          <div className="flex items-center gap-3">
            <span className="muted" style={{ width: 120 }}>环境 env</span>
            <input className="input mono" value={s.envName} onChange={(e) => s.setEnvName(e.target.value)} placeholder="如 production，对应 [env.production]" />
            {s.envName ? <Chip tone="info">MISE_ENV={s.envName}</Chip> : null}
          </div>
        </div>
      </Section>

      <Section title="mise 设置" desc={"mise settings ls " + (miseSettings.isError ? "（加载失败）" : "")}>
        {miseSettings.isError ? <div className="muted">{miseSettings.error.message}</div> : null}
        {isObject && settingsData ? (
          <table className="mui-table">
            <thead><tr><th>键</th><th>值</th></tr></thead>
            <tbody>
              {Object.entries(settingsData as Record<string, unknown>).map(([k, v]) => (
                <tr key={k}>
                  <td className="mono">{k}</td>
                  <td className="mono">{prettyJSON(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !miseSettings.isLoading && !miseSettings.isError ? (
          <pre className="mono" style={{ fontSize: "var(--font-size-sm)", background: "var(--color-bg)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>{String(settingsData)}</pre>
        ) : null}
      </Section>
    </div>
  );
}
