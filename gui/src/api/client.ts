import type { About, DiffResponse, DoctorResponse, EnvResponse, Health, PathResponse, WriteResult } from "./types";

export class Api {
  constructor(private base: string, private token: string) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers["x-miseui-token"] = this.token;
    const res = await fetch(this.base + path, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    if (!res.ok) {
      let msg = res.statusText || "HTTP " + res.status;
      try {
        const b = (await res.json()) as { message?: string };
        if (b?.message) msg = b.message;
      } catch {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json() as Promise<T>;
  }

  health = () => this.req<Health>("/api/v1/health");
  about = () => this.req<About>("/api/v1/about");

  env = (cwd = "", envName = "", redacted = false) => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    if (envName) p.set("env", envName);
    if (redacted) p.set("redacted", "true");
    const q = p.toString();
    return this.req<EnvResponse>("/api/v1/env" + (q ? "?" + q : ""));
  };

  envPath = (cwd = "", envName = "") => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    if (envName) p.set("env", envName);
    const q = p.toString();
    return this.req<PathResponse>("/api/v1/env/path" + (q ? "?" + q : ""));
  };

  envDiff = (a: { cwd?: string; env?: string }, b: { cwd?: string; env?: string }) => {
    const p = new URLSearchParams();
    if (a.cwd) p.set("a_cwd", a.cwd);
    if (a.env) p.set("a_env", a.env);
    if (b.cwd) p.set("b_cwd", b.cwd);
    if (b.env) p.set("b_env", b.env);
    const q = p.toString();
    return this.req<DiffResponse>("/api/v1/env/diff" + (q ? "?" + q : ""));
  };

  envSet = (body: { key: string; value: string; cwd?: string; file?: string; global?: boolean; env?: string }) =>
    this.req<WriteResult>("/api/v1/env/set", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  envUnset = (body: { key: string; cwd?: string; file?: string; global?: boolean }) =>
    this.req<WriteResult>("/api/v1/env/unset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  doctor = (cwd = "") => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    const q = p.toString();
    return this.req<DoctorResponse>("/api/v1/doctor" + (q ? "?" + q : ""));
  };

  configs = (cwd = "") => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    const q = p.toString();
    return this.req<{ ok: boolean; configs: unknown }>("/api/v1/config" + (q ? "?" + q : ""));
  };

  configOpen = (file: string, cwd = "") =>
    this.req<{ ok: boolean; file: string; opened_via?: string }>("/api/v1/config/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ file, cwd: cwd || undefined }),
    });

  configRaw = (file: string, cwd = "") =>
    this.req<{ ok: boolean; file: string; content: string }>(
      "/api/v1/config/raw?file=" + encodeURIComponent(file) + (cwd ? "&cwd=" + encodeURIComponent(cwd) : "")
    );

  tools = (cwd = "") => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    const q = p.toString();
    return this.req<{ ok: boolean; tools: unknown }>("/api/v1/tools" + (q ? "?" + q : ""));
  };

  toolVersions = (tool: string) =>
    this.req<{ tool: string; versions: string[] }>("/api/v1/tools/versions?tool=" + encodeURIComponent(tool));

  toolInstall = (body: { tool: string; version?: string; cwd?: string }) =>
    this.req<{ ok: boolean; exit_code: number; output: string }>("/api/v1/tools/install", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  toolUse = (body: { tool: string; version: string; cwd?: string; global?: boolean; env?: string }) =>
    this.req<WriteResult>("/api/v1/tools/use", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  tasks = (cwd = "") => {
    const p = new URLSearchParams();
    if (cwd) p.set("cwd", cwd);
    const q = p.toString();
    return this.req<{ ok: boolean; tasks: unknown }>("/api/v1/tasks" + (q ? "?" + q : ""));
  };

  settings = () => this.req<{ ok: boolean; settings: unknown; raw?: boolean }>("/api/v1/settings");

  settingsSet = (body: { key: string; value?: string; unset?: boolean }) =>
    this.req<WriteResult>("/api/v1/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  plugins = () => this.req<{ ok: boolean; plugins: unknown }>("/api/v1/plugins");
}

export function apiFrom(settings: { baseUrl: string; token: string }): Api {
  return new Api(settings.baseUrl, settings.token);
}

/** WebSocket URL of the stream endpoint on the configured middleware. */
export function streamWsUrl(baseUrl: string, token = ""): string {
  const withWs = baseUrl.replace(/^http/, "ws");
  const sep = withWs.endsWith("/") ? "" : "/";
  const u = withWs + sep + "api/v1/stream";
  return token ? u + "?token=" + encodeURIComponent(token) : u;
}
