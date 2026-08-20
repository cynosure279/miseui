# MiseUI 视觉评审记录（mimo v2.5）

经 workflow 的 agent({ provider: "opencode-go", model: "mimo-v2.5" }) 通道对运行中的应用截图做美学评审与返工闭环。

## 第 1 轮（8 张页面截图）
发现：
1. Doctor 页直接渲染原始 JSON（真实 bug，需数据形状化）。
2. 表头对比度不足；4. 来源路径截断丢失文件名；6. 卡片等高问题；8. 信息表无分隔。
3. 设置页用原生 checkbox（应做质感 Toggle 开关）；4. PATH 可视化器溢出换行。
5. 表格空态空旷；7. 网格卡片高度参差。
同时肯定：语义色、导航激活态、分组左侧色条、整体色板克制。

## 第 1 轮修复
- Doctor 全量重写为结构化渲染（kv 卡片 + 列表见 + severity，杜绝 JSON dump）。
- 表头加深；来源 pill 尾部截断保留文件名（shortPath）；PATH 横向滚动 + chip 不换行；
- Toggle 做成胶囊滑块；k-v 信息表加行分隔；任务页隐藏空别名列。

## 第 2 轮（4 张修复后截图）
确认 4 项修复落地；指出剩余 6 项：Toggle 未生效（实为 vite 热更未起效，重启后生效）、
PATH chip 内部仍折行、中文路径断字、Doctor 空卡片塌陷、Env PATH 值换行、箭头太小。

## 第 3 轮（最终 4 张截图）
全部确认「已生效 ✅」：Toggle 滑块、PATH 单行+横向滚动+清晰箭头、Env 长值单行截断+pill 保留文件名、
Doctor 结构化无裸 JSON + 空卡片占位。
**质感评分 8.5/10**。下轮可做：PATH 溢出边缘淡出渐变遮罩。

## 做法沉淀
- 视觉通道：workflow agent(model=mimo-v2.5) 用 read_image 读运行中截图（Playwright 保存）。
- 结构化补充：browser_evaluate 断言设计令牌/组件 DOM 是否真的生效（如 Toggle 计数）。
- 教训：vite dev 进程对工具写入的文件可能不热更 → 修改后建议重启 dev 或硬刷新再评审。

## 玻璃液态主题进化（4 轮，mimo 评审）
- 问题：玻璃主题原只有半透明无 blur、无模式区分；浅色对比度差。
- 进化：按模式拆分浅/深玻璃令牌；新增极光层(4 光斑)+backdrop-blur/saturate+fresnel 高光+grain 噪点；浅色面板不透明 0.66、深色 0.5；侧栏独立更强的 blur 分层；浅色光斑提饱和。
- mimo 评分：深色 7/10、浅色 8.2/10（初版浅色 3.5 → 8.2）。
- 关键教训：本会话 vite 热更不可靠，改完需重启 dev；截图验证需用平均色把关（深色 avg<100），localStorage 只可靠注 themeId 不可靠注 mode（需 UI 点开关）。
