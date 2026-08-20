export interface Health {
  status: string;
  service: string;
  version: string;
  mise: string | null;
  auth: boolean;
}
export interface About {
  service: string;
  version: string;
  mise_bin: string;
  mise_version: string | null;
  auth: boolean;
}
export interface EnvVariable {
  key: string;
  value: string;
  source?: string;
  tool?: string;
  raw?: string;
}
export interface EnvResponse { ok: boolean; cwd: string; env_name: string | null; vars: EnvVariable[]; }
export interface PathEntry { index: number; path: string; missing: boolean; duplicate: boolean; is_shim: boolean; }
export interface PathResponse { ok: boolean; cwd: string; env_name: string | null; entries: PathEntry[]; }
export interface DiffItem {
  key: string;
  state: "added" | "removed" | "changed";
  a_value: string | null;
  b_value: string | null;
  a_source: string | null;
  b_source: string | null;
}
export interface DiffResponse {
  ok: boolean;
  a: { cwd?: string; env?: string };
  b: { cwd?: string; env?: string };
  diff: DiffItem[];
}
export interface WriteResult { ok: boolean; exit_code: number; output?: string; stderr?: string; message?: string; }
export interface DoctorResponse { exit_code: number; data: Record<string, unknown>; }

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function sourceOrigin(source: string | undefined): "project" | "global" | "tool" | "inherited" | "other" {
  if (!source) return "inherited";
  const s = source.toLowerCase();
  if (s.includes("mise.toml") || s.includes(".tool-versions") || s.includes(".mise.toml")) return "project";
  if (s.includes("config.toml") || s.includes("settings.toml") || s.includes(".config/")) return "global";
  if (s.includes("tool_versions") || s.includes("plugin")) return "tool";
  return "other";
}
