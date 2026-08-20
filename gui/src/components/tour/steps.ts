export interface TourStep {
  page?: string;      // route to visit before highlighting (hash path, e.g. "/env")
  selector?: string;  // document.querySelector target to spotlight
  title: string;
  body: string;
  placement?: "center" | "top" | "bottom";
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "欢迎使用 MiseUI",
    body: "用 2 分钟走一遍核心功能：连接中间件 → 环境变量解析瀑布 → 结构化改值 → PATH/对比 → 健康中心 → 工具与任务 → 配置外部打开 → 主题。每步会点亮真实界面元素讲解，随时可跳过。之后可点左侧底部「🎓 使用引导」重开。",
    placement: "center",
  },
  {
    page: "/connect",
    selector: "[data-tour=connect-test]",
    title: "1/12 连接中间件",
    body: "MiseUI 通过 miseui-server 访问 mise（本机或远端都行）。这里填 Server URL——本机默认 http://127.0.0.1:18771（演示）或 18773（连接真实 mise）；远端监听要填 Token，然后点「测试连接」。",
    placement: "top",
  },
  {
    page: "/settings",
    selector: "[data-tour=settings-cwd]",
    title: "2/12 选定项目目录（cwd）与环境（env）",
    body: "工作目录 cwd = 你要用 mise 管理的项目路径（留空 = 中间件所在目录）。环境 env 对应 mise 的 [env.production] 这类环境专属配置——同一份代码切环境换变量。",
    placement: "top",
  },
  {
    page: "/env",
    selector: "[data-tour=env-cwd]",
    title: "3/12 环境变量 · 解析瀑布",
    body: "每一条是一个变量卡片。左侧色条=来源：绿=项目配置、蓝=全局配置、青=工具注入、灰=Shell 继承；右侧 pill 显示来源文件。这就是「解析瀑布」——清楚每个变量从哪来。",
    placement: "top",
  },
  {
    selector: "[data-tour=env-search]",
    title: "4/12 搜索与敏感值打码",
    body: "输入关键字实时过滤（也搜值/来源）。「打码敏感值」会把 KEY/TOKEN/SECRET/PASSWORD 类变量自动隐藏，防止截图或共享时泄露密钥。",
    placement: "top",
  },
  {
    selector: "[data-tour=env-add]",
    title: "5/12 结构化添加 / 修改变量值",
    body: "核心操作：填 KEY 和 VALUE，选「写入到」（项目 mise.toml / 全局 --global / 环境专属 -E），点「写入（mise set）」。GUI 调用 mise 公开命令 mise set 结构化写配置，绝不手改文本。每行点「编辑」改已有值、点「移除」删除。",
    placement: "top",
  },
  {
    selector: "[data-tour=env-pathbtn]",
    title: "6/12 PATH 可视化",
    body: "把 PATH 拆成一段段芯片：绿色=正常、红色⚠=目录不存在、≈=重复段、灰链=顺序。shim 段有 🛠 标记。长 PATH 可横向滚动。",
    placement: "bottom",
  },
  {
    selector: "[data-tour=env-diffbtn]",
    title: "7/12 环境对比",
    body: "对比两个上下文（如默认 vs staging）的变量差异，新增/删除/修改用颜色区分并显示两侧值与来源——快速定位「这个变量在哪个环境变了」。",
    placement: "bottom",
  },
  {
    page: "/doctor",
    selector: "[data-tour=doctor-refresh]",
    title: "8/12 健康中心（doctor）",
    body: "一键运行 mise doctor：每个检查项带状态（绿/黄/红）与修复提示（可复制命令），支持重新检测、一键复制完整诊断报告。环境问题一目了然。",
    placement: "top",
  },
  {
    page: "/tools",
    selector: "[data-tour=tools-install]",
    title: "9/12 工具管理",
    body: "列出项目声明的工具与版本；「安装」拉取缺失版本，「切换版本」用 mise use 应用指定版本——全走公开 CLI，并会联动环境变量的 PATH。",
    placement: "top",
  },
  {
    page: "/tasks",
    selector: "[data-tour=tasks-run]",
    title: "10/12 任务运行",
    body: "列出 mise.toml 里定义的 [tasks]。点「运行」用 WebSocket 实时流式看输出（stderr 标红），可随时停止，退出码明确显示。",
    placement: "top",
  },
  {
    page: "/config",
    selector: "[data-tour=config-extopen]",
    title: "11/12 配置与外部打开",
    body: "列出所有生效的配置文件并安全只读预览；「外部打开」直接调用系统默认编辑器编辑，「复制路径」拿全路径。注意：改配置建议用环境变量页的 mise set，而不是裸编辑。",
    placement: "top",
  },
  {
    page: "/settings",
    selector: "[data-tour=settings-theme]",
    title: "12/12 主题与偏好 · 完成 🎉",
    body: "默认「Mise 质感」亮/暗双态；可选玻璃拟态深色、高对比极简、Material You 动态取色；「减少动画」尊重无障碍偏好。教程结束——去试试改一个环境变量吧！",
    placement: "top",
  },
];
