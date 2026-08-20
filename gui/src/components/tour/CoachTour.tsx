import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { TourStep } from "./steps";

function waitFor(sel: string, timeout = 4000): Promise<Element | null> {
  return new Promise((resolve) => {
    const found = document.querySelector(sel);
    if (found) return resolve(found);
    const start = Date.now();
    const iv = window.setInterval(() => {
      const el = document.querySelector(sel);
      if (el) {
        window.clearInterval(iv);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        window.clearInterval(iv);
        resolve(null);
      }
    }, 120);
  });
}


export function CoachTour({ steps, onClose }: { steps: TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const boxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const step = steps[index] ?? steps[steps.length - 1];
  const last = index === steps.length - 1;
  const isCenter = step.placement === "center" || !step.selector;

  const measure = () => {
    const el = step.selector ? document.querySelector(step.selector) : null;
    if (el) {
      const r = el.getBoundingClientRect();
      boxRef.current = { x: r.x, y: r.y, w: r.width, h: r.height };
    }
    setBox(boxRef.current);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChecked(false);
      setBox(null);
      boxRef.current = null;
      // navigate to the step's page first
      if (step.page && location.pathname !== step.page) {
        navigate(step.page);
        await new Promise((r) => setTimeout(r, 350));
      }
      if (!step.selector) {
        setChecked(true);
        return;
      }
      const el = await waitFor(step.selector, 4500);
      if (cancelled) return;
      if (el) {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
        await new Promise((r) => setTimeout(r, 380));
        const r = el.getBoundingClientRect();
        boxRef.current = { x: r.x, y: r.y, w: r.width, h: r.height };
        setBox(boxRef.current);
      }
      setChecked(true);
    })();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const next = () => (last ? onClose() : setIndex((i) => i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));

  if (!checked) return null;

  const tooltipStyle: React.CSSProperties = isCenter
    ? { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
    : (() => {
        if (box) {
          const below = box.y + box.h + 280 < window.innerHeight;
          return {
            position: "fixed" as const,
            left: Math.max(12, Math.min(box.x + box.w / 2 - 190, window.innerWidth - 392)),
            top: below ? box.y + box.h + 14 : Math.max(12, box.y - 12 - 210),
            width: 380,
          };
        }
        return { position: "fixed" as const, left: 24, right: 24, bottom: 24 };
      })();

  return (
    <>
      {/* dimmed backdrop */}
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9000,
          background: "rgba(0,0,0,0.0001)",
          pointerEvents: "none",
        }}
      />
      {/* spotlight */}
      {box ? (
        <div
          style={{
            position: "fixed", left: box.x, top: box.y, width: box.w, height: box.h,
            borderRadius: 14, zIndex: 9001,
            boxShadow: "0 0 0 9999px rgba(7,10,14,0.62)",
            outline: "2px solid var(--color-primary)",
            pointerEvents: "none",
            transition: "all 240ms var(--motion-spring)",
          }}
        />
      ) : null}
      {/* tooltip / intro card */}
      <div
        role="dialog"
        aria-label={step.title}
        style={{
          ...tooltipStyle,
          zIndex: 9002,
          background: (isCenter ? "#1a1d24" : "var(--color-surface)"),
          color: isCenter ? "#e8eaed" : "var(--color-text)",
          border: "1px solid " + (isCenter ? "#2a2d36" : "var(--color-border-strong)"),
          borderRadius: 16,
          padding: "20px 22px",
          boxShadow: "var(--shadow-3)",
          maxWidth: 420,
          cursor: "default",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>MiseUI</span>
          <span style={{ fontSize: "var(--font-size-sm)", color: isCenter ? "#9ca3af" : "var(--color-text-secondary)", fontWeight: 500 }}>
            {step.title}
          </span>
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: isCenter ? "#c9cdd6" : "var(--color-text-secondary)", whiteSpace: "pre-wrap" }}>
          {step.body}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 5, flex: 1 }}>
            {steps.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === index ? 18 : 6, height: 6, borderRadius: 3,
                  background: i === index ? "var(--color-primary)" : "var(--color-border-strong)",
                  transition: "all 200ms ease",
                }}
              />
            ))}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: isCenter ? "#9ca3af" : undefined }}
            onClick={() => {
              localStorage.setItem("miseui.tour.done", "1");
              onClose();
            }}
          >
            跳过
          </button>
          {index > 0 ? (
            <button className="btn btn-sm" onClick={prev}>上一步</button>
          ) : null}
          {last ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { localStorage.setItem("miseui.tour.done", "1"); onClose(); }}
            >完成</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={next}>下一步 →</button>
          )}
        </div>
      </div>
    </>
  );
}
