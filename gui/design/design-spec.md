# MiseUI — Design Direction + Token Spec

> Engineer-ready. Compact. No prose padding.

---

## 1. Design Principles

1. **Layered Depth** — Every surface exists at a deliberate elevation. Background → surface → card → overlay. Depth communicates hierarchy, not decoration.
2. **Restrained Materiality** — Surfaces feel tactile: subtle grain textures, soft backdrop-blur on overlays, gentle gradients on interactive elements. Never flat, never noisy.
3. **Semantic Precision** — Color means function. Green = healthy/active. Red = error/critical. Amber = warning. Blue = info. Every colored element maps to a system state; decorative color is forbidden.
4. **Spring Motion** — All transitions use physical spring curves. Motion communicates energy and responsiveness, not flashiness. Reduced-motion is always respected.
5. **Information Density with Breath** — 8pt grid. Dense data layouts (waterfall, PATH chips) use tight internal spacing but generous padding around container boundaries.

---

## 2. CSS Variable Token List

### Color — Light (Base)

| Token | Value | Usage |
|---|---|---|
| `--color-bg` | `#f5f5f0` | Page background, warm off-white |
| `--color-surface` | `#ffffff` | Card / panel surfaces |
| `--color-surface-alt` | `#fafaf6` | Secondary surface (nested cards) |
| `--color-elevation-1` | `rgba(0,0,0,0.04)` | Low shadow tint |
| `--color-elevation-2` | `rgba(0,0,0,0.08)` | Mid shadow tint |
| `--color-elevation-3` | `rgba(0,0,0,0.14)` | High shadow tint (modals) |
| `--color-primary` | `#00a352` | Mise signature green |
| `--color-primary-hover` | `#008f48` | Primary hover |
| `--color-primary-subtle` | `#e6f5ee` | Primary tinted bg |
| `--color-accent` | `#2563eb` | Links, focus rings |
| `--color-ok` | `#16a34a` | Success state |
| `--color-warn` | `#d97706` | Warning state |
| `--color-error` | `#dc2626` | Error state |
| `--color-info` | `#2563eb` | Info state |
| `--color-text` | `#1a1a1a` | Primary text |
| `--color-text-secondary` | `#6b7280` | Muted text |
| `--color-text-disabled` | `#9ca3af` | Disabled text |
| `--color-text-on-primary` | `#ffffff` | Text on green surfaces |
| `--color-text-on-ok` | `#ffffff` | Text on ok surfaces |
| `--color-text-on-error` | `#ffffff` | Text on error surfaces |
| `--color-border` | `#e5e7eb` | Default borders |
| `--color-border-strong` | `#d1d5db` | Emphasized borders |

### Color — Dark Overrides

| Token | Value |
|---|---|
| `--color-bg` | `#0f1115` |
| `--color-surface` | `#1a1d24` |
| `--color-surface-alt` | `#22252e` |
| `--color-elevation-1` | `rgba(255,255,255,0.05)` |
| `--color-elevation-2` | `rgba(255,255,255,0.09)` |
| `--color-elevation-3` | `rgba(255,255,255,0.15)` |
| `--color-primary` | `#00c964` |
| `--color-primary-hover` | `#00db6e` |
| `--color-primary-subtle` | `rgba(0,201,100,0.12)` |
| `--color-accent` | `#60a5fa` |
| `--color-ok` | `#22c55e` |
| `--color-warn` | `#f59e0b` |
| `--color-error` | `#ef4444` |
| `--color-info` | `#60a5fa` |
| `--color-text` | `#e8eaed` |
| `--color-text-secondary` | `#9ca3af` |
| `--color-text-disabled` | `#6b7280` |
| `--color-text-on-primary` | `#0a1a0f` |
| `--color-text-on-ok` | `#0a1a0f` |
| `--color-text-on-error` | `#ffffff` |
| `--color-border` | `#2a2d36` |
| `--color-border-strong` | `#3a3d46` |

### Radius

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `4px` | Chips, tags, badges |
| `--radius-md` | `8px` | Cards, inputs, buttons |
| `--radius-lg` | `12px` | Panels, modals |
| `--radius-xl` | `16px` | Hero cards, large containers |
| `--radius-full` | `9999px` | Pills, avatars |

### Spacing (8pt grid)

| Token | Value |
|---|---|
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `20px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-10` | `40px` |
| `--space-12` | `48px` |
| `--space-16` | `64px` |

### Typography

| Token | Value | Usage |
|---|---|---|
| `--font-sans` | `"Inter", "Noto Sans SC", system-ui, sans-serif` | Primary typeface |
| `--font-mono` | `"JetBrains Mono", "Fira Code", monospace` | Code, env var values |
| `--font-size-xs` | `11px` | Overline labels, badges |
| `--font-size-sm` | `13px` | Secondary text, captions |
| `--font-size-md` | `15px` | Body text |
| `--font-size-lg` | `18px` | Subheadings |
| `--font-size-xl` | `24px` | Page titles |
| `--font-size-2xl` | `32px` | Hero headings |
| `--font-weight-regular` | `400` | Body |
| `--font-weight-medium` | `500` | Emphasis, labels |
| `--font-weight-semibold` | `600` | Headings |
| `--font-weight-bold` | `700` | Hero text |
| `--line-height-tight` | `1.25` | Headings |
| `--line-height-normal` | `1.5` | Body |
| `--line-height-relaxed` | `1.75` | Long-form prose |

### Shadow Elevation

| Token | Value | Usage |
|---|---|---|
| `--shadow-0` | `none` | Flat / resting |
| `--shadow-1` | `0 1px 2px var(--color-elevation-1), 0 1px 3px var(--color-elevation-1)` | Cards at rest |
| `--shadow-2` | `0 2px 6px var(--color-elevation-1), 0 4px 12px var(--color-elevation-2)` | Cards hover |
| `--shadow-3` | `0 4px 12px var(--color-elevation-2), 0 8px 24px var(--color-elevation-3)` | Dropdowns, popovers |
| `--shadow-4` | `0 8px 24px var(--color-elevation-3), 0 16px 48px var(--color-elevation-3)` | Modals, overlays |

### Motion

| Token | Value | Usage |
|---|---|---|
| `--motion-duration-instant` | `80ms` | Hover, focus ring |
| `--motion-duration-fast` | `150ms` | Button press, toggle |
| `--motion-duration-normal` | `250ms` | Panel expand, card transition |
| `--motion-duration-slow` | `400ms` | Page transitions, waterfall cascade |
| `--motion-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Spring overshoot |
| `--motion-ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Deceleration |
| `--motion-ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | Symmetric easing |

### Glass / Material

| Token | Value | Usage |
|---|---|---|
| `--glass-blur` | `16px` | Standard backdrop blur |
| `--glass-blur-heavy` | `32px` | Modal overlays |
| `--glass-bg-light` | `rgba(255,255,255,0.72)` | Light glass fill |
| `--glass-bg-dark` | `rgba(26,29,36,0.78)` | Dark glass fill |
| `--glass-border-light` | `rgba(255,255,255,0.35)` | Light glass edge |
| `--glass-border-dark` | `rgba(255,255,255,0.12)` | Dark glass edge |
| `--glass-grain` | `url("data:image/svg+xml,...")` | 200×200 feTurbulence SVG, opacity 0.03 |

> **Grain**: encode a 200×200 feTurbulence SVG as data URI. Apply as `::after` with `opacity: 0.03` and `mix-blend-mode: overlay`.

---

## 3. Theme Architecture

### Registry

```ts
type ThemeMode = "light" | "dark";
type ThemeId = "mise" | "glass-dark" | "hc" | "material-you";

interface Theme {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  tokens: Partial<Record<string, string>>;
}
```

### Implementation

1. **Base layer**: all `--color-*` vars on `[:root]` (light) and `[data-theme="dark"]` (dark).
2. **Extras**: set `data-theme="dark|light"` + `data-theme-id="glass-dark"` on `<html>`. Override only unique tokens via `[data-theme-id="glass-dark"] { --color-bg: ... }`.
3. **Toggle**: `useTheme()` hook → `localStorage.getItem("miseui-theme")` → sets both data attributes. `prefers-color-scheme` default on first load.
4. **Brand**: single anchor `--color-primary: #00a352` (light) / `#00c964` (dark). Hover, active, subtle derived by opacity. No hue ramp. `--color-accent: #2563eb` for links only.

### Extra Theme Overrides

| Theme | What It Overrides |
|---|---|
| **Glass Dark** | `--color-bg` (translucent), glass vars, shadows→0, glass borders |
| **High-Contrast** | `--color-bg: #000`, `--color-text: #fff`, borders 2px, shadows 0, `--color-primary: #00ff7f` |
| **Material You** | Runtime OKLCH interpolation from user seed color via `color-mix()` |

---

## 4. Visual Signatures

### Env Waterfall

1. **Provenance Strata** — Each var is a horizontal card. 3px left-edge color bar: green=mise.toml, gray=shell, amber=system. Staggered entrance (40ms delay per card).
2. **Diff Highlight** — Overridden values show original struck-through in `--color-text-disabled`, new value slides up. Subtle `--color-primary-subtle` pulse once.
3. **Source Pill** — `--radius-full` badge top-right of each card: "mise.toml → tool-versions → env", `--font-size-xs` + chevron.
4. **PATH Visualizer** — Horizontal row of segmented chips (`--radius-sm`). `--color-primary-subtle` bg, `--color-primary` text. Click expands popover with contained binaries.
5. **Cascade Timeline** — Thin vertical line on left margin. Circles at each source junction mark merge points.

### Doctor Health Center

1. **Status Cards** — Large left icon (✓/⚠/✗) in ok/warn/error + matching tint bg. Responsive grid.
2. **Pulse Animation** — Failed check icons: CSS pulse `scale(1→1.08→1)`, 2s loop. Gentle, not alarming.
3. **Fix CTA** — Bottom action bar on failing cards. "Auto Fix" solid primary + "Ignore" ghost. Slides up on hover/focus.

---

## 5. Motion Spec + Reduce-Motion

### Standard Curves

| Action | Duration | Easing |
|---|---|---|
| Button press/hover | `--motion-duration-instant` | `ease-out` |
| Card expand/collapse | `--motion-duration-normal` | `--motion-spring` |
| Waterfall entrance | `--motion-duration-slow` per card, 40ms stagger | `--motion-ease-out` |
| Page transition | `--motion-duration-slow` | `--motion-ease-in-out` |
| Toast slide-in | `--motion-duration-fast` | `--motion-ease-out` |
| Modal overlay fade | `--motion-duration-normal` | `ease` |

### Reduce-Motion Switch

```ts
const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
document.documentElement.dataset.reduceMotion = reduced ? "on" : "off";
```

When `data-reduce-motion="on"`:
- All `animation-duration` → `0ms`
- All `transition-duration` → `0ms`
- Cascade stagger removed
- Pulse disabled
- Waterfall cards appear instantly

**One global switch. No per-animation toggle.**

---

*AI-assisted — Tool: dsh; model: deepseek/deepseek-chat; version: unavailable.*
