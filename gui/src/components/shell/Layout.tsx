import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "../../state/settings";
import { apiFrom } from "../../api/client";
import { useThemeStore } from "../../theme/useTheme";
import { StatusPill } from "../ui/primitives";
import { CoachTour } from "../tour/CoachTour";
import { TOUR_STEPS } from "../tour/steps";

const NAV = [
  { to: "/", label: "总览", icon: "◆" },
  { to: "/env", label: "环境变量", icon: "𝚨" },
  { to: "/doctor", label: "医生", icon: "✚" },
  { to: "/tools", label: "工具", icon: "⛭" },
  { to: "/tasks", label: "任务", icon: "▶" },
  { to: "/config", label: "配置", icon: "{" },
  { to: "/settings", label: "设置", icon: "⚙" },
  { to: "/connect", label: "连接", icon: "⇄" },
];

const TITLES: Record<string, string> = {
  "/": "总览",
  "/env": "环境变量 · 解析瀑布",
  "/doctor": "健康中心",
  "/tools": "工具管理",
  "/tasks": "任务运行",
  "/config": "配置文件",
  "/settings": "设置",
  "/connect": "连接 · 中间件",
};

export default function Layout() {
  const { baseUrl, token } = useSettings();
  const { mode, toggleMode } = useThemeStore();
  const location = useLocation();
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!localStorage.getItem("miseui.tour.done")) setTourOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);
  const title = TITLES[location.pathname] ?? "MiseUI";

  const health = useQuery({
    queryKey: ["health", baseUrl, token],
    queryFn: () => apiFrom({ baseUrl, token }).health(),
    refetchInterval: 15000,
    retry: 1,
  });

  const conn = health.isSuccess && health.data?.status === "ok";
  const connText = conn ? "已连接" : health.isError ? "连接失败" : "连接中…";
  const level = conn ? "ok" : health.isError ? "error" : "info";

  return (
    <div className="flex" style={{ height: "100vh" }}>
      <div className="aurora" aria-hidden="true">
        <span className="aurora-orb o1" />
        <span className="aurora-orb o2" />
        <span className="aurora-orb o3" />
        <span className="aurora-orb o4" />
      </div>
      <aside
        className="flex mui-aside"
        style={{
          width: 220,
          flexDirection: "column",
          padding: "var(--space-4) var(--space-3)",
          gap: "var(--space-2)",
        }}
      >
        <div className="flex items-center gap-2" style={{ padding: "var(--space-2) var(--space-3)", marginBottom: "var(--space-3)" }}>
          <span style={{ width: 12, height: 12, borderRadius: "var(--radius-full)", background: "var(--color-primary)", boxShadow: "0 0 0 4px var(--color-primary-subtle)" }} />
          <span style={{ fontWeight: 700, fontSize: "var(--font-size-lg)", letterSpacing: 0.3 }}>Mise<span style={{ color: "var(--color-primary)" }}>UI</span></span>
        </div>
        <nav className="flex" style={{ flexDirection: "column", gap: 2 }}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                "flex items-center gap-2" +
                (isActive ? " chip chip-primary" : " chip")
              }
              style={{ justifyContent: "flex-start", padding: "var(--space-2) var(--space-3)", textDecoration: "none", fontSize: "var(--font-size-md)" }}
            >
              <span style={{ width: 16, textAlign: "center" }}>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center justify-between" style={{ padding: "var(--space-2) var(--space-3)" }}>
          <StatusPill level={level} text={connText} />
          <button className="btn btn-ghost btn-sm" onClick={toggleMode} title="切换明暗">
            {mode === "dark" ? "🌙" : "☀️"}
          </button>
        </div>
        <div style={{ padding: "var(--space-1) var(--space-2)" }}>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={() => setTourOpen(true)}>
            🎓 使用引导
          </button>
        </div>
      </aside>
      <main className="flex-1" style={{ overflow: "auto", padding: "var(--space-6)" }}>
        <div className="stack-enter">
          <h1 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-4)" }}>{title}</h1>
          <Outlet />
        </div>
      </main>
      {tourOpen ? <CoachTour steps={TOUR_STEPS} onClose={() => setTourOpen(false)} /> : null}
    </div>
  );
}
