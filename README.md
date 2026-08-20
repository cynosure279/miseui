# MiseUI

A polished desktop + web GUI for [mise](https://mise.jdx.dev) — focused on **managing environment variables** (the "resolution waterfall"), with a health center (doctor), tools, tasks, configs and themes.

- **Textures**: premium "Material 3 inspired" visual language with a switchable theme registry (default Mise 质感 light/dark; Glass liquid; High-Contrast; Material You).
- **Only public CLI**: the middleware talks to mise exclusively through its public command line (never internal functions, never shell string building) and is fully mockable for offline CI.
- **Web + Desktop**: the same React app runs in the browser (connect to any remote middleware) and in the Tauri shell.

## Layout

```
miseui/
  gui/      Tauri + React 18 + TypeScript + Vite (bun) — the MiseUI app
  server/   miseui-server: configurable HTTP/WebSocket bridge to the mise CLI (Rust + axum, standalone crate)
  .github/workflows/   CI + Release (paths-filtered, additive)
```

## Quickstart

```bash
# middleware (bridge to mise)
cargo run --manifest-path server/Cargo.toml --release
#   --mise-bin mise --port 18771 --host 127.0.0.1  (configurable, see server/README.md)

# web app (dev)
cd gui && bun install && bun run dev     # http://localhost:5177

# desktop (Tauri)
cd gui && bunx tauri build               # deb/dmg/nsis bundles
```

Open the app → connect page → point at `http://127.0.0.1:18771` (or any remote middleware). Non-loopback listeners require `--token`.

## Design & docs

- `DESIGN.md` — requirements, decisions and architecture notes
- `gui/design/design-notes.md` — visual review log (mimo v2.5 rounds)
- `server/README.md` — middleware config, API table, security
- `gui/README.md` — frontend details, theme registry

## CI / Release

- `miseui-ci.yml` — runs only when `gui/**` / `server/**` change: server tests+clippy (OS matrix incl. fake-mise fixture), web typecheck+build, integration.
- `miseui-release.yml` — `miseui-v*` tags: version consistency check, desktop bundles + web + server Docker image, GitHub release assets.

## License

MIT
