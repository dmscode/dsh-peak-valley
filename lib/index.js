/**
 * dsh-peak-valley — host half.
 *
 * 全部逻辑都在浏览器半边（峰谷判定 + 状态条 + 设置页），宿主这里没有命令、
 * 服务或会话钩子要注册，但 bundle 约定要求 `lib/index.js` 存在，故只留一个空 apply。
 */
function apply() {}
export { apply };
