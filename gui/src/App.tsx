import { Route, Routes } from "react-router-dom";
import Layout from "./components/shell/Layout";
import { useThemeEffect } from "./theme/useTheme";
import Dashboard from "./pages/Dashboard";
import EnvExplorer from "./pages/EnvExplorer";
import Doctor from "./pages/Doctor";
import Tools from "./pages/Tools";
import Tasks from "./pages/Tasks";
import Config from "./pages/Config";
import Settings from "./pages/Settings";
import Connect from "./pages/Connect";

export default function App() {
  useThemeEffect();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="/env" element={<EnvExplorer />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/config" element={<Config />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
