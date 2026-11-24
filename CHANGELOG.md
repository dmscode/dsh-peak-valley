# 更新日志

## 0.1.3 — 2026-11-24

### 变更
- **新对话页的彩带改挂到输入框下沿**。0.1.1 / 0.1.2 想让它包住宿主画的那一行「项目 / 模式」，但那一行的容器高、chip 实际高、上下余量都由宿主决定，量出来的值怎么调都会有 1~17px 的偏差（先是凭空多一条细带，后来 chips 挤在上沿、上下空白不等）。
- 现在首屏用 `order: 3` 把彩带排到卡片之后，再用负 `margin-top` 把自己的上沿塞进卡片下沿：卡片底部两个圆角露出带状底色，与会话视图是同一种观感，只是上下翻转。
- 厚度、字号、圆角两处共用同一套变量（`--pv-band` / `--pv-tuck` / `--dsw-radius-panel`），首屏可见高度不会再比会话视图粗一截。

### 移除
- 删掉全部首屏测量：`heroRowOf`、`stackGapOf`、`HERO_PAD`、`--pv-hero-lift`、`--pv-hero-row`、`--pv-pad`、`--pv-hero-radius`，以及 `ResizeObserver` 与 `window.resize` 监听。
- 运行时只认宿主的 `data-content-phase` 一个输入；打字期间不再改写任何 DOM 属性，闪烁的隐患（测量 → 改布局 → 再测量）从根上没有了。

## 0.1.2 — 2026-11-24

### 修复
- **首屏状态带太高**。两层原因：0.1.1 让 hero 高度复用了 `--pv-band`（会话视图里自己那行文字用的细带高度），凭空多出一条细带；随后按「行容器的行高」去画，而宿主给那一行留的上下余量比 chips 本身高十几像素（实测容器 41px、chips 24px），于是 chips 挤在带上沿，下面空一大截。
- 改成只认 chips 自己占的那一段：`height = 藏深 + --pv-pad × 2 + chips 高`，可见高度 = `--pv-pad × 2 + chips 高`（默认 5px，chips 上下等距）。首屏带高从 96px 收到 34px（按实测 24px 高的 chips 算）。
- chips 高度取那一行里所有 `[aria-haspopup]` 的并集，量不到才退回行容器高。
- 抬升量改由 `行容器高 + 栈间距 + --pv-pad − chips 在容器里的上偏移` 算，不再用「条顶 → 行顶」反推（那个量随条自身高度变，会自我咬合）；栈间距先读继承来的 `--dsh-composer-stack-gap`，读不到再看父级的 `gap`。
- 右侧文字改用 `align-items:center` 与 chips 同一中线，不再靠运行时算 padding。
- 量到那一行时才动 DOM；量不到就不动（先撤后量会让条塌回细带，相位没变时不该有布局变化）。
- 上沿圆角改回与输入卡片同一个 `--dsw-radius-panel`（0.1.1 因为条太薄，把圆角按行高收成了 `行高 × .55`）。
- chips 上下的纯色从 5px 收到 4px，且不再取整 —— 上下各 4px 只要一边被 `Math.round` 错开 1px，肉眼就能看出不对称。

### 调整
- **会话视图的带薄了一截**：`--pv-band` 从 `1em + 14px` 收到 `1em + 8px`（16px 基准 → 26px 降到 20px），文字由「上移 5px 贴卡片上沿」改成在可见带里上下各 2px 居中，`--pv-lift` 这个变量随之取消。

## 0.1.1 — 2026-11-24

### 修复
- **打字时状态带高度闪烁**。旧实现有两个叠加的抖动源：一是 `MutationObserver` 盯着 composer 整棵子树，编辑器每敲一下改 DOM 就去重量一次（节流后仍约 2.5 次/秒）；二是 weight 完会先撤掉 `data-hero` 再写回，而旧 CSS 的 hero 高度比「基础高 + 抬升」少 32px，每撤一次 composer 总高就变 32px —— 首屏是 `justify-content:center` 的垂直居中布局，总高一变整块就上下跳 16px。
- 观察器改成只监听宿主相位标记 `data-content-phase` / `data-conversation-session` 的属性变化，宽度仍由 `ResizeObserver` 负责；防抖 80ms 并保留最后一帧。
- `useLayoutEffect` 开头加「相位 / 宽度 / 会话 / 已施加行高」组成的键，键不变直接返回，一个 DOM 属性都不写；键变了才撤上一次的抬升。
- hero 高度改成 `基础高 + 圆角深度 + 抬升量`，并配等量负 `margin-top`，于是**施加和撤掉 `data-hero` 时 margin box 的占位完全相同**（都是 20px），总高度不再随 toggl 变化 —— 闪烁从根上去掉。
- 顺带修掉：会话视图里消息卡片上的芯片会把状态带抬起来（现在只在 `data-content-phase="hero"` 时抬升）。
- 视觉变化：首屏输入卡比 0.1.0 低 10px，色带相应高 10px。0.1.0 用 hero 高度硬压出来的 64px 换来了负占位（卡片被上提 10px），改成等占位后卡片回到它本来的位置。

## 0.1.0 — 2026-10-27

首个版本。

### 功能
- 输入卡片正上方一条**峰谷状态带**：当前模型是 DeepSeek 时出现，谷为浅绿、峰为浅红，与输入卡同宽、同顶圆角，并用负 margin 把底边藏进卡片，卡片圆角处露出带状底色 —— 彩色圆角矩形上叠着白色圆角卡片。
- 带内深浅分界 = **本阶段剩余时长百分比**，右侧「峰 · 剩余 N天N小时」（与左侧项目/模式选择对称）。
- 输入卡描边跟随主色：只改 `--dsw-elevation-stroke-color`，不碰带哈希的类名。
- 判定按官方口径：北京时间周一至周五（不含法定节假日）9:00–12:00、14:00–18:00 为峰，其余（含午休、夜间、周末、法定节假日全天）为谷。内置 2026 年 33 天法定节假日；调休补班日不参与判定，补班的周末依旧是谷。
- 首屏里「项目 / 模式」那一行叠在带上：行高、抬升量、文字内边距运行时实测写入 CSS 变量，窗口缩放、侧栏开合、首屏↔会话切换都会重算。
- 六套马卡龙主题（抹茶 / 樱花 / 苏打 / 奶油 / 丁香 / 雾蓝）+ 自定义 CSS，设置页给钩子清单与示例；高峰时段可在设置里改。

### 结构
- 只有客户端半边：`lib/client.js` 以 `window.__ModuleLoader__.load(...)` 注册，`lib/index.js` 的 `apply()` 是空的 —— 它的存在只为让这个包成为插件列表里可开关的一行。
- 状态带注册在 `conversation.input.dock`（会话级 list 插槽，`order: 60`），排在官方队列面板之下、紧贴输入卡；设置页注册在 `settings.section`。
- 模型信息取自 `ctx.get("modelDirectories").directoryFor(sessionId).store`，provider 或模型名命中 `deepseek` 即生效（走网关的 DeepSeek 模型也能识别）。
- 设置存 `localStorage` 的 `dsh-peak-valley:settings`，不引入宿主配置。

### 已知限制
- 内置节假日只有 2026 年；其它年份只按周末判定，设置页会提示。
- 官方价格页改了时段（例如高峰时段调整），需要改代码里的默认峰窗口或改设置里的时段。
- 定位依赖 `conversation.input.dock` 与 `data-composer-card`；上游若改掉，最坏表现是状态带不再出现，不会误伤别的交互。

### 工程
- 品牌资产：`assets/icon.svg` 矢量源（与 dsh-rightbar-tab-gestures / dsh-cloudflare-media 同一套视觉语言：暖色底、深色描边），衍出 1024/512/256/128/64 PNG；`assets/cover-1600x900.png` 功能封面与 3200×1800 母版，均由 `assets/render.mjs` 渲染。
- `package.json` 声明 `"icon": "./assets/icon.svg"`（宿主 `iconOf()` 只认清单里的相对路径、≤256 KiB），否则插件列表只显示默认图标。
- `locale/zh.json`、`locale/en.json` 提供中英文标题与简介；`exports` 放行 `"./locale/*.json"`，否则 ESM 解析会因白名单抛 `ERR_PACKAGE_PATH_NOT_EXPORTED`。
- `.github/workflows/release.yml`：推送 `v*` tag 发布，正文由 `scripts/release-notes.mjs` 从本文件生成。
- 首包 0.1.0 由人工 `npm publish` 发出：npm 的 trusted publisher 只能绑到**已存在**的包上，OIDC 无法创建新包（tag 触发的第一次 CI 就是因此 E404）。registry 上的 `0.0.0-stage` 是创建包名时留下的占位版本，正常现象。绑好 trusted publisher 之后，后续 `v*` tag 全部走 CI，带 provenance。
