import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "mise" | "glass-dark" | "hc" | "material-you";
export type ThemeMode = "light" | "dark";

interface ThemeState {
  themeId: ThemeId;
  mode: ThemeMode;
  reduceMotion: boolean;
  seed: string;
  setThemeId: (id: ThemeId) => void;
  setMode: (m: ThemeMode) => void;
  toggleMode: () => void;
  setReduceMotion: (v: boolean) => void;
  setSeed: (c: string) => void;
}

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;
const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: "mise",
      mode: prefersDark() ? "dark" : "light",
      reduceMotion: prefersReduced(),
      seed: "#00a352",
      setThemeId: (themeId) => set({ themeId }),
      setMode: (mode) => set({ mode }),
      toggleMode: () => set((s) => ({ mode: s.mode === "dark" ? "light" : "dark" })),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setSeed: (seed) => set({ seed }),
    }),
    { name: "miseui-theme", partialize: (s) => ({ themeId: s.themeId, mode: s.mode, reduceMotion: s.reduceMotion, seed: s.seed }) }
  )
);

export function useThemeEffect() {
  const { themeId, mode, reduceMotion, seed } = useThemeStore();
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.themeId = themeId;
    root.dataset.reduceMotion = reduceMotion ? "on" : "off";
    root.style.setProperty("--muy-seed", seed);
  }, [themeId, mode, reduceMotion, seed]);
}
