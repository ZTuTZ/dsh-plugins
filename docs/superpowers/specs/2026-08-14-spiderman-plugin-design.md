# DSH 蜘蛛侠宠物 + 皮肤插件设计文档

日期：2026-08-14

## 1. 背景与目标

为 DeepSeek Harness（dsh）Web UI 开发自用插件，包含两个独立插件包：

- **dsh-spider-pet**：蜘蛛侠卡通形象宠物（常驻右下角、多帧图集动画、互动与亲密度）
- **dsh-skin-spiderman**：红蓝主调蜘蛛侠皮肤（含鼠标跟随流体效果、真人/战衣身份揭示切换）

功能参考 dsh-web-ui 全家桶的 `dsh-pet` 与 `dsh-skins`，但素材与视觉走"蜘蛛侠"主题。
第一版目标：当前 npm 发布的 dsh 0.1.0-rc.6 上即可安装运行；架构为 2.0 扩展预留路径。

约束：只基于官方 NPM SDK（`@deepseek-ai/*`）开发，不改 dsh 源码；插件可热插拔，
卸载后所有副作用全部还原。

## 2. 仓库结构

在 `/Users/aadmin/tool/deepseek-plugin` 建立 pnpm workspace：

```text
deepseek-plugin/
├── packages/
│   ├── dsh-spider-pet/        # 宠物插件（host 半区 + browser 半区）
│   └── dsh-skin-spiderman/    # 皮肤插件（纯 browser 半区）
├── shared/
│   └── tsdown.client.ts       # 共享 client bundle 构建预设（自 dsh-web-ui 移植）
├── pnpm-workspace.yaml
├── package.json
└── docs/superpowers/specs/
```

包命名与清单：

| 包目录 | npm 包名 | 插件行 id |
|---|---|---|
| `packages/dsh-spider-pet` | `@deepseek-ai/dsh-spider-pet` | `spider-pet` |
| `packages/dsh-skin-spiderman` | `@deepseek-ai/dsh-client-ui-skin-spiderman` | `ui-skin-spiderman` |

每个包具备：`cordis.patch.yml`（`- insert` 插件行）、`package.json` 的
`dsh.bundle.patch` 清单；browser 半区声明 `dsh.client`（`inject` + `platform: "web"`）。
安装方式：`dsh plugin --profile web add link:<仓库>/packages/<包名>`。

## 3. 宠物插件 dsh-spider-pet

### 3.1 host 半区（src/index.ts）

- 注册设置命名空间：`installSettingsSection(ctx, settingsNamespace('spider-pet'), Config, ...)`，
  schema 字段：`enabled`、`visible`、`size`、`right`、`bottom`、`name`；
- 注册 system-prompt section（`ctx.systemPrompt.section`），告知 agent 宠物插件存在
  及其互动能力；受 `announceToAgent` 配置控制；
- 不承载业务状态（第一版状态在浏览器侧）。

### 3.2 browser 半区（src/client/index.ts）

#### 挂载

右下角浮动容器通过 DOM 级注入：

- 在 `document.body` 追加宠物根容器，`MutationObserver` 监听 React 重渲染导致的
  节点丢失并自愈重插（参考 dsh-web-ui 侧边栏注入策略）；
- 不依赖官方 slot，当前 rc.6 即可运行；
- 拖拽移动更新 `right`/`bottom`，持久化到 localStorage。

#### 动画引擎

- 素材：`spritesheet.png/webp` + `pet.json`（帧表：每状态帧数、帧尺寸、行号）；
- 渲染：CSS `background-position` 逐帧切换或 canvas 绘制；帧率由状态决定；
- 状态映射（第一版核心状态）：

| 状态 | 触发条件 | 动画 |
|---|---|---|
| idle | 无活动 | 呼吸待机浮动 |
| waiting | 会话等待模型响应 | 低头左右晃动 |
| thinking | 模型思考/工具执行 | 托腮思考晃动 |
| jumping | 回合/任务完成 | 跳跃庆祝 |
| pet | 用户摸头 | 摸头反馈（气泡） |
| failed | 回合失败 | 趴下沮丧 |

- 2.0 扩展：帧表 JSON 驱动，新增姿态只加帧不改代码。

#### 互动与状态账本

- 点击摸头：亲密度 +1，10s 冷却，气泡反馈；
- 悬浮面板：喂小鱼干（+5，30s 冷却）、改名（1-20 字符）、隐藏/召唤、调整大小；
- 亲密度等级：幼蛛 → 伙伴 → 挚友 → 羁绊（100 封顶）；
- 持久化：localStorage 键 `dsh.spiderPet.v1`；
- 状态账本实现为框架无关纯 TS 模块（`ledger.ts` / `state.ts`），vitest 单测。

#### 设置卡片

- 注册 `web-ui.plugin.item` 子槽卡片（与 dsh-web-ui 设置中心同构），
  未安装 dsh-web-ui-settings 时退化为不可见，不影响其他功能。

## 4. 皮肤插件 dsh-skin-spiderman

纯 browser 半区插件，遵守皮肤契约：

- `body[data-dsh-spiderman]` 作用域样式；`apply()` 写入、dispose 全收回
  （body 属性、注入元素、favicon、title）；
- CSS 主题变量集中管理红蓝主调：深红（#b91f2b / #d92b3a）、宝蓝（#24448f /
  #3b6fd4）、白色点缀、蛛网纹理背景；
- 覆盖官方 UI 组件：侧边栏、输入框、卡片、按钮、选中态、滚动条。

### 4.1 流体交互层

- 注入轻量 canvas 背景层：蛛丝粒子 / 流光粒子跟随鼠标移动产生拖尾与涟漪；
- 性能自适应：DPR 上限 2、粒子数按可视面积缩放、低帧率自动降粒子数、
  `prefers-reduced-motion` 时退化为静态纹理；
- canvas 初始化失败 → 降级为 CSS 静态蛛网背景，不影响皮肤其余部分。

### 4.2 身份揭示（真人 / 战衣切换）

- 注入一个皮肤专属元素（挂在侧边栏底部），展示"真人 Peter"与"蜘蛛战衣"
  两张图；
- 鼠标在该元素上移动时，两张图按指针位置 reveal 切换（类似蜘蛛侠网站
  cover 身份揭示）；
- 素材：复用蜘蛛侠网站的 `home-cover-peter.jpg` / `home-cover-suit.jpg`
  （随插件打包），切换动效用 CSS mask/clip-path 实现，无额外库。

### 4.3 互斥与还原

- 启用皮肤时设置 body 属性；与其他皮肤互斥由 home 层 `cordis.patch.yml`
  disabled 管理（与 dsh-web-ui 皮肤互斥机制一致）；
- 卸载（dispose）恢复 body 属性、删除注入 DOM、移除 favicon，标题仅在
  仍是皮肤标题时还原。

## 5. 素材管线

1. **宠物帧**：以已确认的透明形象（`素材/spidey/spidey-v1-white-eyes.png`）
   为图生图参考，用中转站 `doubao-seedream-5-0-260128`（chat/completions 端点）
   逐姿态生成（idle / waiting / thinking / jumping / pet / failed）；
   每帧要求纯色绿背景 → 本地 `remove_chroma_key.py` 抠透明 → 统一裁切到
   256×256 单元 → 拼接 spritesheet（PNG/WebP）+ 写 `pet.json` 帧表；
2. **皮肤素材**：从蜘蛛侠网站 `public/` 复制 peter/suit 两图与
   `spider-mark.png`，切到插件所需比例；
3. 素材入仓，构建时打进 bundle（CSS Modules 内联 + assets 随包分发）。

## 6. 错误处理与容错

- 浏览器侧 DOM 注入/挂载失败只记日志，不拖垮 GUI；
- canvas 初始化失败自动降级静态背景；
- 素材缺失时宠物显示文字占位并告警，不崩溃；
- 所有注册均返回 disposer，卸载可逆。

## 7. 测试

- vitest：亲密度账本（冷却、上限、等级）、状态机映射、帧表解析、
  皮肤 apply/dispose 对称性（注入项全部收回）；
- SDK 包走 `server.deps.inline: [/@deepseek-ai\//]`；
- 测试基建参考 dsh-web-ui（`vitest.setup.ts` 的 `__ModuleLoader__` stub）。

## 8. 兼容性

- 目标环境：npm `@deepseek-ai/dsh` 0.1.0-rc.6 的 web profile；
- 不依赖官方未发布 slot；宠物用 DOM 注入，皮肤用 body 属性 + DOM；
- 类型来源：官方 NPM SDK devDependencies（`@deepseek-ai/cordis`、
  `@deepseek-ai/dsh-client-runtime` 等），不依赖任何 dsh 源码 checkout。

## 9. 2.0 扩展点

- 宠物：host 侧持久化/API 升级（localStorage → 服务 + 路由，平滑迁移）；
  新动画状态只加帧表；多形象换 spritesheet；
- 皮肤：战衣系列变体（黑红 / 共生体 / 纳米战衣）作为新皮肤包快速派生，
  复用 CSS 变量体系与皮肤中心互斥；
- 聚合：可仿 dsh-web-ui 出 `dsh-spiderman-all` 聚合包一键装齐。

## 10. 范围（第一版不做）

- 不做皮肤中心 / 多皮肤互斥 UI（沿用 dsh-web-ui 机制，由用户手动 patch）；
- 不做宠物 host API 与跨设备同步；
- 不做 9 状态完整图集（先 6 状态，帧数少而精）；
- 不发布 npm，仅仓库 link 安装。
