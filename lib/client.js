window.__ModuleLoader__.load({
	id: "dsh-peak-valley",
	factory: (require) => {
		const react = require("react");
		const h = react.createElement;

		//#region 2026 年法定节假日
		// 只收录"放假"的日子。补班上班的周末（01-04 / 02-14 / 02-28 / 05-09 / 09-20 / 10-10）
		// 故意不进来：DeepSeek 的峰谷只认"周末 / 法定节假日 + 错峰时段"，从不看国务院的
		// 补班表，所以调休表对判定毫无影响，补班的周末依旧是谷。
		const HOLIDAYS = new Set([
			"2026-01-01", "2026-01-02", "2026-01-03",
			"2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",
			"2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",
			"2026-04-04", "2026-04-05", "2026-04-06",
			"2026-05-01", "2026-05-02", "2026-05-03", "2026-05-04", "2026-05-05",
			"2026-06-19", "2026-06-20", "2026-06-21",
			"2026-09-25", "2026-09-26", "2026-09-27",
			"2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05",
			"2026-10-06", "2026-10-07"
		]);
		const KNOWN_YEARS = new Set([2026]);
		//#endregion

		//#region 时区与相位判定
		// 北京时间恒为 UTC+8 且无夏令时：直接给时间戳加偏移再读 UTC 字段，比每次建一个
		// Intl.DateTimeFormat 便宜，也不会受运行环境的 locale / timeZone 影响。
		const CN_OFFSET = 8 * 3600 * 1000;
		const MINUTE = 60 * 1000;
		const DAY = 24 * 60 * MINUTE;
		// 一段峰/谷最长可能连续十几天（春节 9 天假叠上前后的周末），扫描上限略大于它。
		const MAX_RUN = 14 * DAY;
		const DEFAULT_PEAKS = [[9 * 60, 12 * 60], [14 * 60, 18 * 60]];

		function pad2(n) {
			return n < 10 ? "0" + n : "" + n;
		}

		function cnParts(ms) {
			const t = new Date(ms + CN_OFFSET);
			return {
				y: t.getUTCFullYear(),
				m: t.getUTCMonth() + 1,
				d: t.getUTCDate(),
				dow: t.getUTCDay(),
				h: t.getUTCHours(),
				mi: t.getUTCMinutes()
			};
		}

		function isoDay(p) {
			return p.y + "-" + pad2(p.m) + "-" + pad2(p.d);
		}

		function isRestDay(p) {
			return p.dow === 0 || p.dow === 6 || HOLIDAYS.has(isoDay(p));
		}

		// 峰只存在于工作日的两个时段（官方口径：周一至周五 9:00–12:00、14:00–18:00，
		// 不含法定节假日）。午休、夜间、周末、节假日全天都是谷 —— 谷是峰窗口的补集，
		// 不是另有一段独立的「错峰时段」，所以这里存的是峰而不是谷。
		function inPeak(minutes, peaks) {
			for (const range of peaks) {
				if (minutes >= range[0] && minutes < range[1]) return true;
			}
			return false;
		}

		function phaseAt(ms, peaks) {
			const p = cnParts(ms);
			if (isRestDay(p)) return "valley";
			return inPeak(p.h * 60 + p.mi, peaks) ? "peak" : "valley";
		}

		// 相位只会在整分钟边界翻转，按分钟回溯/前探就能拿到精确的区间端点；
		// 把结果缓存到区间结束为止，之后每次刷新只做一次包含判断。
		let cachedRun = null;

		function runFor(now, peaks, signature) {
			const hit = cachedRun;
			// 峰窗口一改就要立刻重算，否则缓存会一直用到本段结束
			if (hit !== null && hit.signature === signature && now >= hit.start && now < hit.end) return hit;
			const base = Math.floor(now / MINUTE) * MINUTE;
			const phase = phaseAt(base, peaks);
			let start = base;
			while (start - MINUTE > now - MAX_RUN && phaseAt(start - MINUTE, peaks) === phase) start -= MINUTE;
			let end = base;
			while (end + MINUTE < now + MAX_RUN && phaseAt(end + MINUTE, peaks) === phase) end += MINUTE;
			const run = { phase, start, end: end + MINUTE, signature };
			cachedRun = run;
			return run;
		}

		function remainText(ms) {
			const total = Math.max(0, Math.round(ms / MINUTE));
			const d = Math.floor(total / 1440);
			const hr = Math.floor((total % 1440) / 60);
			const mi = total % 60;
			if (d > 0) return hr > 0 ? d + "天" + hr + "小时" : d + "天";
			if (hr > 0) return hr + "小时" + mi + "分";
			return mi + "分";
		}

		function parseHM(text) {
			const m = /^(\d{1,2}):(\d{2})$/.exec(String(text === undefined || text === null ? "" : text).trim());
			if (m === null) return null;
			const hr = Number(m[1]);
			const mi = Number(m[2]);
			if (hr > 23 || mi > 59) return null;
			return hr * 60 + mi;
		}

		// 设置里存的是 "HH:MM" 文本对，这里转成分钟区间；任一行非法就跳过，
		// 全非法时退回官方默认，避免手滑输错把状态条打成永远谷。
		function peaksOf(settings) {
			const list = Array.isArray(settings.peakWindows) ? settings.peakWindows : [];
			const peaks = [];
			for (const row of list) {
				if (!Array.isArray(row) || row.length < 2) continue;
				const start = parseHM(row[0]);
				const end = parseHM(row[1]);
				if (start === null || end === null || start >= end) continue;
				peaks.push([start, end]);
			}
			return peaks.length > 0 ? peaks : DEFAULT_PEAKS;
		}
		//#endregion

		//#region 主题
		// 每个主题只给谷/峰各一个浅色底，深浅关系与文字色在 CSS 里用 color-mix 派生，
		// 这样加主题只要加两个色号，也不会出现某个主题文字看不清。
		const THEMES = [
			{ id: "matcha", name: "抹茶", valley: "#c3e6cf", peak: "#f9cdc5" },
			{ id: "sakura", name: "樱花", valley: "#d8e8d6", peak: "#f9ccd9" },
			{ id: "soda", name: "苏打", valley: "#c9dff0", peak: "#f8cbc4" },
			{ id: "butter", name: "奶油", valley: "#dcecc2", peak: "#fbd3b4" },
			{ id: "lilac", name: "丁香", valley: "#d7e6e0", peak: "#f2cde1" },
			{ id: "mist", name: "雾蓝", valley: "#cfe4ea", peak: "#f6c8c8" }
		];
		const DEFAULTS = {
			theme: "matcha",
			peakWindows: [["09:00", "12:00"], ["14:00", "18:00"]],
			customCss: ""
		};
		const STORE_KEY = "dsh-peak-valley:settings";
		//#endregion

		//#region 设置存储
		function readStored() {
			try {
				const raw = window.localStorage.getItem(STORE_KEY);
				if (raw === null) return { ...DEFAULTS };
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object") return { ...DEFAULTS };
				return { ...DEFAULTS, ...parsed };
			} catch (_) {
				return { ...DEFAULTS };
			}
		}

		function themeOf(id) {
			for (const theme of THEMES) if (theme.id === id) return theme;
			return THEMES[0];
		}

		function applyThemeVars(themeId) {
			const theme = themeOf(themeId);
			const root = document.documentElement;
			root.style.setProperty("--pv-c-valley", theme.valley);
			root.style.setProperty("--pv-c-peak", theme.peak);
		}

		// 自定义 CSS 单独一个 style 标签追加在基础样式之后，靠文档顺序生效；
		// 用户想覆盖哪条就写哪条，不需要 !important。
		function applyCustomCss(text) {
			let tag = document.querySelector("style[data-pv-custom]");
			if (tag === null) {
				tag = document.createElement("style");
				tag.dataset.pvCustom = "";
				document.head.appendChild(tag);
			}
			tag.textContent = typeof text === "string" ? text : "";
		}

		const settingsStore = (() => {
			let value = readStored();
			const listeners = new Set();
			const commit = () => {
				try {
					window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
				} catch (_) {
					// 隐私模式 / 存储被禁用：内存里照样生效，只是刷新后回到默认。
				}
				applyThemeVars(value.theme);
				applyCustomCss(value.customCss);
				for (const fn of listeners) fn();
			};
			return {
				get() {
					return value;
				},
				subscribe(fn) {
					listeners.add(fn);
					return () => {
						listeners.delete(fn);
					};
				},
				set(patch) {
					value = { ...value, ...patch };
					commit();
				},
				reset() {
					value = { ...DEFAULTS };
					commit();
				}
			};
		})();

		function useSettings() {
			return react.useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get);
		}
		//#endregion

		//#region 模型探测
		// 会话还没挂到 scope 上时 directoryFor 会抛错，而 slot 的 inject 结果按会话缓存，
		// 一旦在最初几帧里失败就会永久拿不到模型信息。所以这里只做「取不到就返回 null」，
		// 由组件自己轮询等待，避免缓存的失败被固化下来。
		function resolveModelStore(ctx, sessionId) {
			try {
				const directories = ctx.get("modelDirectories");
				if (directories === void 0 || sessionId === void 0 || sessionId === null) return null;
				const directory = directories.directoryFor(sessionId);
				const store = directory === void 0 || directory === null ? void 0 : directory.store;
				if (store === void 0 || store === null) return null;
				const snapshot = store.getSnapshot();
				// current 为空说明目录还没拉过：主动补一次，不阻塞渲染
				if (snapshot === void 0 || snapshot === null || snapshot.current === null || snapshot.current === void 0) {
					Promise.resolve(directory.load()).catch(() => {});
				}
				return store;
			} catch (_) {
				return null;
			}
		}

		function readCurrent(store) {
			try {
				const snapshot = store.getSnapshot();
				return snapshot === void 0 || snapshot === null ? null : snapshot.current;
			} catch (_) {
				return null;
			}
		}

		function useModelSelection(store) {
			const [current, setCurrent] = react.useState(() => (store === void 0 ? null : readCurrent(store)));
			react.useEffect(() => {
				if (store === void 0 || store === null) {
					setCurrent(null);
					return;
				}
				const sync = () => setCurrent(readCurrent(store));
				sync();
				let unsubscribe = null;
				try {
					unsubscribe = store.subscribe(sync);
				} catch (_) {}
				return () => {
					if (typeof unsubscribe === "function") {
						try {
							unsubscribe();
						} catch (_) {}
					}
				};
			}, [store]);
			return current;
		}

		// provider 与 model 都看：走网关的 DeepSeek 模型（如 qiniu 提供的）provider 不叫
		// deepseek，但模型名里带 deepseek，同样应该出峰谷条。
		function isDeepSeek(selection) {
			if (selection === void 0 || selection === null) return false;
			return /deepseek/i.test(String(selection.provider || "")) || /deepseek/i.test(String(selection.model || ""));
		}

		function useTicker(ms) {
			const [now, setNow] = react.useState(() => Date.now());
			react.useEffect(() => {
				const id = window.setInterval(() => setNow(Date.now()), ms);
				return () => window.clearInterval(id);
			}, [ms]);
			return now;
		}
		//#endregion

		//#region 状态条
		// 心跳 10 秒：剩余时长只显示到分钟，百分比的变化肉眼也跟不上更快的心跳。
		const TICK_MS = 10000;

		const RETRY_MS = 500;
		const RETRY_MAX = 40;
		function PeakValleyBar(props) {			const settings = useSettings();
			const [store, setStore] = react.useState(() => resolveModelStore(props.ctx, props.sessionId));
			react.useEffect(() => {
				// 注入时目录可能还不存在（会话刚创建），持续等二十秒；拿到后立刻退订。
				if (store !== null) return;
				let tries = 0;
				const timer = window.setInterval(() => {
					const found = resolveModelStore(props.ctx, props.sessionId);
					if (found !== null) setStore(found);
					else if (++tries >= RETRY_MAX) window.clearInterval(timer);
				}, RETRY_MS);
				return () => window.clearInterval(timer);
			}, [store, props.ctx, props.sessionId]);
			const selection = useModelSelection(store);
			const now = useTicker(TICK_MS);
			const barRef = react.useRef(null);
			// 形态只由宿主的相位标记（data-content-phase：hero / active / settling）决定，
			// 宽度、高度、圆角全部交给 CSS 跟随宿主变量 —— 这里不测量任何几何，
			// 也就不存在「测量 → 改布局 → 再测量」的回路：打字时一个 DOM 属性都不会动。
			const [, reflow] = react.useReducer((n) => n + 1, 0);
			react.useEffect(() => {
				const bar = barRef.current;
				if (bar === null) return;
				const holder = bar.closest("[data-content-phase]");
				const observer = new MutationObserver(reflow);
				if (holder !== null) observer.observe(holder, { attributes: true, attributeFilter: ["data-content-phase", "data-conversation-session"] });
				return () => observer.disconnect();
			}, []);
			// 首屏与会话两种形态只在 CSS 里翻个面：首屏 order 把彩带排到卡片之后、挂在输入框下沿，
			// 会话视图挂在卡片上方。每次渲染只读一次 closest + getAttribute，量不到就当作会话视图。
			const [hero, setHero] = react.useState(false);
			react.useLayoutEffect(() => {
				const bar = barRef.current;
				if (bar === null) return;
				const holder = bar.closest("[data-content-phase]");
				const next = holder !== null && holder.getAttribute("data-content-phase") === "hero";
				setHero((prev) => (prev === next ? prev : next));
			});
			if (!isDeepSeek(selection)) return null;
			const peaks = peaksOf(settings);
			const run = runFor(now, peaks, JSON.stringify(peaks));
			const span = Math.max(run.end - run.start, 1);
			const percent = Math.min(100, Math.max(0, ((run.end - now) / span) * 100));
			// 峰/谷写在右侧和剩余时长并排：颜色已经足够区分，标签不再给背景色。
			return h("div", {
				className: "pv-bar",
				ref: barRef,
				"data-phase": run.phase,
				"data-hero": hero ? "true" : null,
				role: "status",
				style: { "--pv-pct": percent.toFixed(2) + "%" }
			}, h("div", { className: "pv-row" },
				h("span", { className: "pv-gap" }),
				h("span", { className: "pv-side" },
					h("span", { className: "pv-phase" }, run.phase === "peak" ? "峰" : "谷"),
					h("span", { className: "pv-sep" }, "·"),
					h("span", { className: "pv-remain" }, "剩余 " + remainText(run.end - now))
				)
			));
		}
		//#endregion

		//#region 设置页
		const GUIDE = [
			[":root", "谷 / 峰主色，写这里会同时改状态条和输入框描边"],
			[".pv-bar", "状态条本体：--pv-band 可见高度、--pv-tuck 藏进卡片的深度（要不小于卡片圆角）"],
			[".pv-bar[data-hero]", "首屏那一条（彩带挂在输入框下沿）：想单独改就写这里，默认与会话视图同一套数值"],
			[".pv-bar[data-phase=\"peak\"]", "只改某一阶段（另一侧是 valley）"],
			["--pv-pct", "运行时写在 .pv-bar 上的剩余百分比（如 62.50%），可在样式里引用"],
			[".pv-phase / .pv-remain", "右侧的阶段字与剩余时长"]
		];
		const SAMPLE = ":root{ --pv-c-valley:#c8ecd8; --pv-c-peak:#ffb3ab }\n.pv-bar{ --pv-band:18px }\n.pv-remain{ font-weight:600 }";

		function SettingsSection() {
			const settings = useSettings();
			const [draft, setDraft] = react.useState(settings.customCss);
			react.useEffect(() => {
				setDraft(settings.customCss);
			}, [settings.customCss]);
			const theme = themeOf(settings.theme);
			const setPeak = (index, slot, value) => {
				const next = settings.peakWindows.map((row) => row.slice());
				next[index][slot] = value;
				settingsStore.set({ peakWindows: next });
			};
			const chips = THEMES.map((item) => h("button", {
				key: item.id,
				type: "button",
				className: "pv-chip",
				"data-on": String(item.id === settings.theme),
				onClick: () => settingsStore.set({ theme: item.id })
			},
				h("span", {
					className: "pv-dot",
					style: { "--pv-dot-a": item.valley, "--pv-dot-b": item.peak }
				}),
				item.name
			));
			return h("div", { className: "pv-set" },
				h("div", { className: "pv-block" },
					h("div", { className: "pv-h" }, "主题"),
					h("div", { className: "pv-hint" }, "谷为浅绿、峰为浅红，都是马卡龙色系；换主题只影响显示，不改判定。"),
					h("div", { className: "pv-chips" }, chips)
				),
				h("div", { className: "pv-block" },
					h("div", { className: "pv-h" }, "高峰时段"),
					h("div", { className: "pv-hint" }, "官方口径：北京时间周一至周五（不含法定节假日）9:00–12:00、14:00–18:00 为峰；其余时段（含午休、夜间）、周末与法定节假日全天都是谷。"),
					settings.peakWindows.map((row, index) => h("div", { className: "pv-times", key: index },
						h("input", {
							type: "time",
							className: "pv-input",
							value: row[0],
							onChange: (e) => setPeak(index, 0, e.target.value)
						}),
						h("span", { className: "pv-hint" }, "至"),
						h("input", {
							type: "time",
							className: "pv-input",
							value: row[1],
							onChange: (e) => setPeak(index, 1, e.target.value)
						})
					)),
					KNOWN_YEARS.has(new Date().getFullYear())
						? null
						: h("div", { className: "pv-hint" }, "注意：内置节假日数据只有 2026 年，其它年份只按周末判定。")
				),
				h("div", { className: "pv-block" },
					h("div", { className: "pv-h" }, "自定义 CSS"),
					h("div", { className: "pv-hint" }, "追加在基础样式之后，可直接覆盖下面的钩子；换机器 / 换主题都不影响这段。"),
					h("textarea", {
						className: "pv-css",
						value: draft,
						spellCheck: false,
						placeholder: SAMPLE,
						onChange: (e) => setDraft(e.target.value)
					}),
					h("div", { className: "pv-actions" },
						h("button", {
							type: "button",
							className: "pv-btn pv-btn-primary",
							onClick: () => settingsStore.set({ customCss: draft })
						}, "应用"),
						h("button", {
							type: "button",
							className: "pv-btn",
							onClick: () => {
								setDraft("");
								settingsStore.set({ customCss: "" });
							}
						}, "清空"),
						h("button", {
							type: "button",
							className: "pv-btn",
							onClick: () => settingsStore.reset()
						}, "恢复默认")
					)
				),
				h("details", { className: "pv-guide" },
					h("summary", null, "自定义指导"),
					h("div", { className: "pv-guide-body" },
						h("div", { className: "pv-tip" }, "当前主题：" + theme.name + "（谷 " + theme.valley + " / 峰 " + theme.peak + "）"),
						h("div", { className: "pv-tip" }, "可用钩子："),
						h("ul", { className: "pv-list" }, GUIDE.map((row, index) => h("li", { key: index },
							h("code", { className: "pv-k" }, row[0]),
							" — " + row[1]
						))),
						h("div", { className: "pv-tip" }, "例子："),
						h("pre", { className: "pv-code" }, SAMPLE),
						h("div", { className: "pv-tip" }, "输入框的描边跟随主色：插件通过 data-composer-card 这个稳定属性改 --dsw-elevation-stroke-color，所以不必也不要去碰那些带哈希的类名。")
					)
				)
			);
		}
		//#endregion

		//#region 样式
		// 关键几何：状态条是输入卡片的兄弟节点，靠负 margin 把自己塞到卡片后面，
		// 于是卡片圆角「挖掉」的地方露出状态条的颜色 —— 视觉上就是彩色圆角矩形上叠着白色圆角卡片。
		// 会话视图里条在卡片上方（藏在卡片顶角后面），首屏里条在卡片下方（藏在卡片底角后面）。
		// --pv-tuck 必须 ≥ 卡片圆角半径，否则彩色肩部会断在直边上。
		const CSS = `
.pv-bar{
	/* 会话视图的可见高度：一行文字（1em × 1.3333 行高）上下各留 4px。
	   字号跟系统基准走（16px 基准 → 12px），基准字变大条也跟着长，不会把字压扁。 */
	--pv-band:calc(1em + 8px);
	/* 藏进卡片的深度绑定输入框圆角（半径 + 2px），卡片改半径时肩部不会断在直边上。 */
	--pv-tuck:calc(var(--dsw-radius-panel,28px) + 2px);
	box-sizing:border-box;
	position:relative;
	z-index:0;
	flex:none;
	display:flex;
	/* 内容盒 = 高度 − 藏深 = 只有 --pv-band 那一段，居中即文字在可见带里上下等距。 */
	align-items:center;
	width:calc(100% - 2 * var(--dsh-composer-side-clearance,16px));
	max-width:var(--dsh-composer-card-max-width,720px);
	height:calc(var(--pv-band) + var(--pv-tuck));
	padding:0 18px var(--pv-tuck);
	margin:0 auto calc(-1 * (var(--pv-tuck) + var(--dsh-composer-stack-gap,6px)));
	border-radius:var(--dsw-radius-panel,28px) var(--dsw-radius-panel,28px) 0 0;
	background:linear-gradient(to right,var(--pv-c) 0 var(--pv-pct,100%),color-mix(in srgb,var(--pv-c) 26%,var(--dsw-specific-input-major,#fff)) var(--pv-pct,100%) 100%);
	color:color-mix(in srgb,var(--pv-c) 55%,#1b1b1d);
	font-family:inherit;
	font-size:clamp(11px,.75em,13px);
	line-height:1.3333;
	user-select:none;
}
.pv-bar[data-phase="valley"]{--pv-c:var(--pv-c-valley,#c3e6cf)}
.pv-bar[data-phase="peak"]{--pv-c:var(--pv-c-peak,#f9cdc5)}
/* 首屏不跟宿主的行较劲：那一行是宿主画的，容器的上下余量和 chip 的实际高度都量不准
   （0.1.1 借了 --pv-band 凭空多一条细带，0.1.2 按容器画又让 chips 挤在上沿），
   所以首屏直接把彩带挂到整块输入框的下沿 —— order 把它排到卡片之后（宿主子项默认 order:0），
   负 margin-top 把自己的上沿塞进卡片下沿后面，卡片底部两个圆角露出带状底色。
   与会话视图同一种观感（彩带 + 卡片圆角肩部），只是上下翻转；厚度同样是 --pv-band，
   文字在露出来的那一截里上下各 4px。全程没有运行时测量，尺寸不随打字变化。 */
.pv-bar[data-hero]{
	order:3;
	height:calc(var(--pv-band) + var(--pv-tuck));
	/* 中间那个 4px 是输入框外层 .GRgSLq_root 自己的下内边距，夹在卡片下沿和本条上沿之间 */
	margin:calc(-1 * (var(--pv-tuck) + var(--dsh-composer-stack-gap,6px) + 4px)) auto 0;
	padding:var(--pv-tuck) 18px 0;
	align-items:center;
	border-radius:0 0 var(--dsw-radius-panel,28px) var(--dsw-radius-panel,28px);
}
.pv-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
.pv-side{flex:none;display:inline-flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.pv-phase{font-weight:600}
.pv-sep{opacity:.45}
.pv-gap{flex:1 1 auto;min-width:8px}
.pv-remain{flex:none;white-space:nowrap;font-weight:500;font-variant-numeric:tabular-nums}
[data-conversation-content]:has(.pv-bar[data-phase="valley"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pv-c-valley,#c3e6cf)}
[data-conversation-content]:has(.pv-bar[data-phase="peak"]) [data-composer-card]{--dsw-elevation-stroke-color:var(--pv-c-peak,#f9cdc5)}
.pv-set{display:flex;flex-direction:column;gap:18px;padding:4px 0 8px;font-size:13px}
.pv-block{display:flex;flex-direction:column;gap:8px}
.pv-h{font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pv-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.pv-chips{display:flex;flex-wrap:wrap;gap:8px}
.pv-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:var(--dsw-radius-md,12px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.pv-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}
.pv-chip[data-on="true"]{box-shadow:inset 0 0 0 1px var(--dsw-alias-state-business-primary);border-color:transparent}
.pv-dot{width:12px;height:12px;border-radius:4px;background:linear-gradient(135deg,var(--pv-dot-a) 0 50%,var(--pv-dot-b) 50% 100%)}
.pv-times{display:flex;align-items:center;gap:8px}
.pv-input{height:32px;padding:0 10px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}
.pv-css{box-sizing:border-box;width:100%;min-height:132px;resize:vertical;padding:10px 12px;border-radius:var(--dsw-radius-md,12px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px}
.pv-actions{display:flex;flex-wrap:wrap;gap:8px}
.pv-btn{height:30px;padding:0 12px;border-radius:var(--dsw-radius-sm,8px);border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.pv-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.pv-btn-primary{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff}
.pv-guide{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:12px}
.pv-guide>summary{cursor:pointer;font-size:13px;font-weight:600;line-height:20px;color:var(--dsw-alias-label-primary)}
.pv-guide-body{display:flex;flex-direction:column;gap:6px;padding-top:8px}
.pv-tip{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pv-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.pv-k{font-family:var(--ds-font-family-code,ui-monospace,monospace);color:var(--dsw-alias-label-primary)}
.pv-code{margin:0;padding:10px 12px;border-radius:var(--dsw-radius-sm,8px);background:var(--dsw-alias-bg-module-platform,#fff);color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;line-height:18px;white-space:pre-wrap;overflow-x:auto}
`;

		function injectCss(id, text) {
			const tagId = JSON.stringify(id);
			if (document.querySelector("style[data-plugin-css=" + tagId + "]") !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-peak-valley";
			tag.dataset.pluginCss = id;
			tag.textContent = text;
			document.head.appendChild(tag);
		}
		//#endregion

		function apply(ctx) {
			injectCss("dsh-peak-valley/base", CSS);
			applyThemeVars(settingsStore.get().theme);
			applyCustomCss(settingsStore.get().customCss);
			// order 越大越靠下：60 让状态条排在队列面板（20）之下、紧贴输入卡。
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "peak-valley",
				order: 60,
				inject: (sessionId) => ({ ctx, sessionId })
			}, PeakValleyBar), "peak-valley: composer dock");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "peak-valley",
				order: 46,
				// label 走 resolveSlotLabel：函数形式是宿主自带的写法（可随 locale 重算）
				label: () => "峰谷"
			}, SettingsSection), "peak-valley: settings section");
		}

		return { apply, inject: ["slots"] };
	}
});
