# dsh 蜘蛛侠皮肤 v0.1.1 装饰增强（方案 A + B）设计说明

日期：2026-08-15

## 目标

在保留现有「对话区流体擦除」效果不动的前提下，消除皮肤“只换了颜色”的素感：补齐全站 chrome 细节，并为左侧工作区叠加克制的蜘蛛侠元素。

## 范围（方案 A：全站 chrome 细节）

1. **滚动条**：覆盖官方滚动条令牌（`--dsw-alias-scrollbar-bg-l1/l2`、`--dsw-alias-scrollbar-hover-l1/l2`），侧栏及其它列表的滚动条变为红蓝渐变滑块；同时样式化 body 级 webkit 滚动条。
2. **选区 / 聚焦环 / 链接**：文本选区为红色 + 白字；键盘聚焦环为品牌红 2px；链接蓝/红跟随主题。
3. **左侧工作区**：在 `[class*="sidebarCol"]` 上叠加顶部红、底部蓝的径向氛围光与两条极淡的斜向蛛网纹理；「新建会话」按钮（`[class*="_newSession"]`）改为红蓝渐变描边与底纹（折叠 rail 态保持原样）。
4. **输入区氛围**：`[data-composer-seat]` 增加一条极淡的红色向上光晕（仅 box-shadow，不改布局）。
5. **全站蛛网装饰层**：由 `apply()` 注入一个 `pointer-events: none` 的固定层（`.web`），内含全屏极淡蛛网纹理与左下角蜘蛛标水印（`.webMark`，8% 透明度、带红晕投影），开关关闭时随皮肤一并移除。

## 范围（方案 B：工作区场景化）

1. **侧栏战衣底纹**：`[class*="sidebarCol"]` 的底色之上由 `apply()` 以行内 background-image 铺设战衣红色纹理 + 深色遮罩 + 红蓝氛围光（纹理为 data URL，不新增网络请求），CSS 只保留颜色兜底。
2. **会话列表玻璃卡片**：`[role="treeitem"]` 行半透明玻璃底 + 极淡描边（用 inset box-shadow 实现，不改变布局尺寸）；选中行 `[aria-selected="true"]` 红蓝渐变底 + 红色描边光晕；hover 带红色微光。不使用重型 `backdrop-filter`（规避官方皮肤警告的弹层困住问题）。
3. **新建会话按钮**：在方案 A 基础上改为玻璃质感（半透明红底、红蓝渐变、内高光 + 轻投影）。
4. **注入装饰元素**：侧栏会话列表上方注入漫画风 kicker「SPIDER-MAN / WORKSPACE」+ 蜘蛛徽标；侧栏底部注入「Peter Parker · 在线」状态条（绿点）。两者随皮肤开关移除，侧栏折叠为 rail 时自动隐藏。

## 范围（设置弹框样式优化）

1. **弹层面板氛围**：`VOzbGW_panel`（设置壳层类，0.1.0-rc.6 稳定）外圈加红蓝描边光晕，顶部加一条红→蓝渐变细线；`VOzbGW_mask` 背景换成带红色调的电影感遮罩。
2. **左侧 tab 列表**：`VOzbGW_navCell` 悬停红蓝渐变；选中项 `VOzbGW_active` 加深红蓝渐变 + 左侧品牌红边缘条（与侧栏选中会话同一语言）。
3. **插件清单**：`pbvGtq_tab[data-active]` 激活子页签文字与下划线改为品牌红；`YyYd_a_card` 卡片改为红蓝渐变底、悬停红色描边与微光，展开态 `cardOpen` 加红蓝双描边。
4. **蜘蛛侠卡片预览**：`[data-dsh-spider-pet-settings]`（桌宠设置卡已有的稳定标记）改为紧凑横排，并由皮肤 JS 注入一枚蜘蛛标小预览（复用 `SPIDER_MARK_URL`，不重复打包素材；设置弹框懒加载，用 MutationObserver 等待）。

## 实现要点

- 所有新规则 scope 在 `body[data-dsh-spiderman]` 下，遵循主题插件“只写自己引入的内容、dispose 时全部回收”的纪律。
- 组件钩子沿用已有约定：`[class*="sidebarCol"]` / `[class*="centerCol"]`（与现有 fluid 效果同一套布局类后缀）、`[class*="_newSession"]`、`[data-composer-seat]`。
- 蜘蛛标素材以 data URL 内联在 `src/assets/mark.ts`（320px 透明 PNG，约 24KB），不引入外部请求。
- 装饰层不接收指针事件、不做动画，避免性能与交互干扰；窄屏（≤760px）隐藏水印。

## 明确不做（后续可加）

- 品牌文字改造（方案 B 第 5 项，需改官方 DOM，不做）与「对话/工作区/设置」胶囊导航（需要真实路由逻辑，留给 2.0）。
- 设置弹框的大背景图 / 毛玻璃装饰（portal 到 body 的高密度功能界面，官方皮肤警告 blur 会困住内部弹层）。
- 任何对话区流体效果改动。

## 追加：漫威英雄架构（v0.2 阶段一 + 二）

### 目标

把皮肤与桌宠从“单英雄写死”升级为**运行时 + 英雄内容数据**，让后续英雄（钢铁侠、美国队长…）只填内容即可接入，并支持设置里独立组合皮肤与桌宠。

### 协议（两个插件各自持有一份等价常量，客户端纯度门禁禁止跨包导入）

- `dsh.marvel.v1` = `{ skin, pet }` 选择存储；默认均为 `spiderman`
- `dsh:marvel-skin-change` / `dsh:marvel-pet-change` 切换事件；跨标签页用 storage 事件同步
- 总开关沿用 `dsh.spiderApp.v1` + `dsh:spider-app-toggle`，行为不变

### 桌宠侧（@deepseek-ai/dsh-marvel-pet）

- `core/content.ts`：`HeroPetContent`（id/label/name/spriteUrl/meta/table）
- `heroes/spiderman.ts`：蜘蛛侠内容（原精灵图与帧表迁入）；`HERO_PETS` 注册表，未知 id 回退蜘蛛侠
- `PetController` 构造函数接收英雄名（默认文案不再写死 Peter Parker）
- 设置 tab 升级为「漫威」控制中心（`MarvelSettingsTab`）：总开关 + 桌宠选择 + 皮肤选择；切换时写存储、广播事件
- 桌宠热切换：监听 pet 事件/存储，替换精灵图、帧表与名字，位置与大小保留

### 皮肤侧（@deepseek-ai/dsh-marvel-skin）

- `core/theme.ts`：`HeroSkinContent`（id/label/kicker/statusName/markUrl/textureUrl/figures）
- `themes/spiderman.ts`：蜘蛛侠主题内容；`HERO_SKINS` 注册表，未知 id 回退蜘蛛侠
- 全部 CSS 作用域由 `body[data-dsh-spiderman]` 改为 `body[data-dsh-marvel-skin="spiderman"]`，并新增 `--hero-*` 变量块；新英雄 = 新作用域块 + 主题内容
- 侧栏 kicker/状态名、徽标、纹理、流体图层均从主题内容读取；皮肤切换时整体卸载重挂

### 后续阶段

- 阶段三：钢铁侠（战甲着装背景交互 + Q 版桌宠 + 设置项）验证完整内容流程
- 阶段四：美国队长；素材按需加载

## 验证

- `pnpm build`（tsc + tsdown）通过。
- `pnpm test`（vitest）3 项通过。
- 产物 `lib/client.js` 包含新令牌、新选择器规则与蜘蛛标 data URL。
