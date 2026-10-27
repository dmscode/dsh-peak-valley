# 更新日志

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
