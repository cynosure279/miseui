# MiseUI — Graphical User Interface for mise

质感设计（Material Design 3 灵感）的 mise 桌面 + Web GUI。核心场景：**环境变量管理**。

## 页面

- 环境变量 · 解析瀑布：每个变量显示来源归属链（项目/全局/工具注入/shell 继承）、模板预览、PATH 可视化器、环境对比 Diff、秘密打码、编辑闭环（mise set/unset）。
- 健康中心（doctor）：mise doctor --json 结构化呈现 + 复制诊断报告 + 重新检测。
- 工具 / 任务（WS 流式日志）/ 配置（安全只读）/ 设置（主题 + 连接）/ 连接（远端 server）。

## 技术栈

React 18 + TypeScript + Vite（bun）；手写 CSS 令牌系统（主题注册表，默认「Mise 质感」亮/暗双态）；Framer Motion 动画（尊重 prefers-reduced-motion）；TanStack Query + zustand。

## 开发

    bun install
    bun run dev          # http://localhost:5177
    bun run typecheck
    bun run build        # Web 静态产物 dist/

## 主题（小风格）

主题注册表：mise（默认·质感）、glass-dark（玻璃拟态深色）、hc（高对比极简）、material-you（动态取色）。CSS 变量 + data-theme / data-theme-id 全量热替换；全局「减少动画」开关。
