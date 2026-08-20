import type { EnvVariable } from "../api/types";

export const SECRET_KEY = /\b(key|token|secret|password|passwd|api[_-]?key|auth|credential)\b/i;

export function isSensitiveKey(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function maskValue(_key: string, value: string): string {
  if (value.length === 0) return "…";
  const head = value.length <= 6 ? "" : value.slice(0, 2);
  const tail = value.length <= 6 ? "" : value.slice(-2);
  return (head + "••••" + tail) || "••••";
}

/** Expand {{ VAR }} templates against a known-var map. Unknown => ‹undefined› */
export function renderTemplate(value: string, vars: Map<string, string>): { ok: boolean; rendered: string } {
  let ok = true;
  const rendered = value.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_m, name: string) => {
    const v = vars.get(name.trim());
    if (v === undefined) {
      ok = false;
      return "‹" + name.trim() + "›";
    }
    return v;
  });
  return { ok, rendered };
}

export type Origin = "project" | "global" | "tool" | "inherited" | "other";

export function originOf(source: string | undefined, tool: string | undefined): Origin {
  if (tool) return "tool";
  if (!source) return "inherited";
  const s = source.toLowerCase();
  if (s.includes("mise.toml") || s.includes(".mise.toml") || s.includes(".tool-versions")) return "project";
  if (s.includes("config.toml") || s.includes("settings.toml") || s.includes(".config")) return "global";
  return "other";
}

export const ORIGIN_META: Record<Origin, { label: string; color: string }> = {
  project: { label: "项目配置", color: "var(--color-primary)" },
  global: { label: "全局配置", color: "var(--color-accent)" },
  tool: { label: "工具注入", color: "var(--color-info)" },
  inherited: { label: "Shell 继承", color: "var(--color-shell)" },
  other: { label: "其他", color: "var(--color-system)" },
};

export function groupByOrigin(vars: EnvVariable[]): { origin: Origin; vars: EnvVariable[] }[] {
  const order: Origin[] = ["project", "global", "tool", "inherited", "other"];
  const map = new Map<Origin, EnvVariable[]>();
  for (const v of vars) {
    const o = originOf(v.source, v.tool);
    if (!map.has(o)) map.set(o, []);
    map.get(o)!.push(v);
  }
  return order.filter((o) => map.has(o)).map((o) => ({ origin: o, vars: map.get(o)! }));
}

export function varsMap(vars: EnvVariable[]): Map<string, string> {
  return new Map(vars.map((v) => [v.key, v.value]));
}

export function prettyJSON(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
