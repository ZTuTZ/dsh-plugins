# dsh 蜘蛛侠皮肤 v0.1.1 轻量装饰（方案 A）设计说明

日期：2026-08-15

## 目标

在保留现有「对话区流体擦除」效果不动的前提下，消除皮肤“只换了颜色”的素感：补齐全站 chrome 细节，并为左侧工作区叠加克制的蜘蛛侠元素。

## 范围（方案 A）

1. **滚动条**：覆盖官方滚动条令牌（`--dsw-alias-scrollbar-bg-l1/l2`、`--dsw-alias-scrollbar-hover-l1/l2`），侧栏及其它列表的滚动条变为红蓝渐变滑块；同时样式化 body 级 webkit 滚动条。
2. **选区 / 聚焦环 / 链接**：文本选区为红色 + 白字；键盘聚焦环为品牌红 2px；链接蓝/红跟随主题。
3. **左侧工作区**：在 `[class*="sidebarCol"]` 上叠加顶部红、底部蓝的径向氛围光与两条极淡的斜向蛛网纹理；「新建会话」按钮（`[class*="_newSession"]`）改为红蓝渐变描边与底纹（折叠 rail 态保持原样）。
4. **输入区氛围**：`[data-composer-seat]` 增加一条极淡的红色向上光晕（仅 box-shadow，不改布局）。
5. **全站蛛网装饰层**：由 `apply()` 注入一个 `pointer-events: none` 的固定层（`.web`），内含全屏极淡蛛网纹理与左下角蜘蛛标水印（`.webMark`，8% 透明度、带红晕投影），开关关闭时随皮肤一并移除。

## 实现要点

- 所有新规则 scope 在 `body[data-dsh-spiderman]` 下，遵循主题插件“只写自己引入的内容、dispose 时全部回收”的纪律。
- 组件钩子沿用已有约定：`[class*="sidebarCol"]` / `[class*="centerCol"]`（与现有 fluid 效果同一套布局类后缀）、`[class*="_newSession"]`、`[data-composer-seat]`。
- 蜘蛛标素材以 data URL 内联在 `src/assets/mark.ts`（320px 透明 PNG，约 24KB），不引入外部请求。
- 装饰层不接收指针事件、不做动画，避免性能与交互干扰；窄屏（≤760px）隐藏水印。

## 明确不做（后续可加）

- 方案 B 的场景化工作区（战衣纹理底 + 毛玻璃面板 + 品牌导航）——本期只做 A，B 可叠加在 A 之上。
- 设置页插件卡片的小预览图（属于 pet 插件设置 UI，非皮肤样式范围）。
- 任何对话区流体效果改动。

## 验证

- `pnpm build`（tsc + tsdown）通过。
- `pnpm test`（vitest）3 项通过。
- 产物 `lib/client.js` 包含新令牌、新选择器规则与蜘蛛标 data URL。
