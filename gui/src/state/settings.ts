import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  baseUrl: string;
  token: string;
  cwd: string;
  envName: string;
  setBaseUrl: (v: string) => void;
  setToken: (v: string) => void;
  setCwd: (v: string) => void;
  setEnvName: (v: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      baseUrl: "http://127.0.0.1:18771",
      token: "",
      cwd: "",
      envName: "",
      setBaseUrl: (baseUrl) => set({ baseUrl: baseUrl.replace(/\/$/, "") }),
      setToken: (token) => set({ token }),
      setCwd: (cwd) => set({ cwd }),
      setEnvName: (envName) => set({ envName }),
    }),
    { name: "miseui-settings", partialize: (s) => ({ baseUrl: s.baseUrl, token: s.token, cwd: s.cwd, envName: s.envName }) }
  )
);
