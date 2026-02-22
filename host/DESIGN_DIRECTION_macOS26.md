# Design Direction: macOS 26 Liquid Glass Upgrade
**Author: Design Lead (Alan Dye perspective)**
**Date: 2026-02-22**
**Scope: AgentOrientedTUI / host GUI**

---

## 一句话定调

> 当前界面是"赛博朋克控制台"——我们要把它变成"住在玻璃里的智慧"。
> 内容永远是主角，界面要像空气一样存在。

---

## 我们在哪里（现状诊断）

读完代码，我看到一个已经很努力的设计，但方向错了。这是最坦诚的诊断：

### 结构性问题（最严重）

**1. 层级错误：所有东西都在同一层**

当前设计把 Sidebar、Header、ChatArea 都处理成了平等的 `glass-card`，加上相同权重的边框和阴影。macOS 26 的核心原则是**功能层（Liquid Glass）明确悬浮在内容层之上**。导航和控件应该"飘"在内容上方，内容从下方透过来。现在看起来一切都是壁纸上的贴纸。

**2. 侧边栏不够"漂浮"**

Sidebar 当前的 `glass-card rounded-xl` 是一个独立浮动的卡片，与 macOS 26 的 Sidebar 行为完全相反。Apple 要求：Sidebar 贴附窗口左边缘，没有左侧圆角，内容在侧边栏下方伸展（background extension effect），给人一种内容无限延伸到侧边栏背后的感觉。

**3. Toolbar 不是 Toolbar**

`WorkspaceHeader` 当前是一个全宽 `h-16` 的扁平条。macOS 26 的 Toolbar 是**分组的胶囊形控件岛屿**，浮在内容上方，各组之间有明显间距。"CHAT / TUI VIEW" 切换器做对了方向，但整体 Toolbar 应该完全重构。

---

### 视觉语言问题（次要，但影响第一印象）

**4. 配色方案：霓虹 vs 振动色**

|  | 当前 | macOS 26 |
|--|------|----------|
| Accent | `#3B82F6` Electric Blue + 发光 glow | 系统蓝，无 glow，通过 vibrancy 自适应 |
| 装饰色 | `#D946EF` 赛博朋克品红、`#00FF9D` 霓虹绿 | 仅系统 accent，无夸张饱和色 |
| 背景装饰 | Aurora 渐变 + 网格 + spotlight | 实际壁纸透过 Liquid Glass 渗透 |
| Semantic | `bg-danger shadow-[0_0_8px_var(--color-danger)]` 发光边框 | 状态色用填充，绝不发光 |

**5. 字体：未来感 vs 清晰感**

- `Orbitron` / `Exo 2` 是 sci-fi 字体，与 macOS 26 的 SF Pro 哲学背道而驰
- section headers 全部大写 `UPPERCASE tracking-[0.2em]`——macOS 26 已明确迁移到 Title Case
- 字号层级过于平均，缺乏呼吸感

**6. 运动语言：闪烁 vs 流动**

- Aurora 动画、spotlight animation、glow pulse 是 "game UI" 的词汇
- macOS 26 的 motion 是弹簧物理（spring physics）+ 形状流体变形（fluid morphing）
- 没有任何动画应该"持续循环"——只有响应交互才动

**7. 过度使用边框**

每个元素都有 `border border-[var(--color-border)]`。macOS 26 用**深度和模糊**建立层次，边框应该只在功能需要时出现（输入框、分割线），不作为装饰。

---

## 应该做什么（设计指令）

### 优先级 1 — 结构重建（必须做，没有商量余地）

#### A. 建立两层架构

```
┌─────────────────────────────────────────────┐
│  Layer 2: Liquid Glass Navigation Layer     │  ← Sidebar + Toolbar 在这层
│  (backdrop-filter: blur, 高透明度)           │
├─────────────────────────────────────────────┤
│  Layer 1: Content Layer                     │  ← ChatArea, Messages 在这层
│  (实际壁纸/背景从这里透出)                    │
└─────────────────────────────────────────────┘
```

**具体实现方向：**
- App 背景：使用真实壁纸图片或动态网格（不是平铺颜色），这是 Liquid Glass 效果的前提
- Sidebar：`position: fixed` 或 `absolute left-0`，无左侧圆角（`border-radius: 0 16px 16px 0`），右侧有一条半透明分割线代替独立卡片边框
- ChatArea：内容区域在侧边栏下方延伸（或使用 `background-extension-effect` 的 CSS 模拟）
- Toolbar：从 header 条变成**居中浮动的胶囊控件条**，absolute 定位悬浮在内容上方

#### B. Sidebar 背景延伸效果

当 Sidebar 打开时，内容区域的背景（而非内容本身）应该被镜像模糊延伸到侧边栏背后，制造深度感。CSS 实现：侧边栏背后用 `backdrop-filter: blur(40px) saturate(180%)` + 内容区域背景颜色的镜像延伸。

#### C. Toolbar 控件岛屿化

将 WorkspaceHeader 分解为三个独立的浮动组：
1. **左侧组**：菜单按钮 + 项目名称（胶囊形 Liquid Glass pill）
2. **中心组**：Chat/TUI 分段控件（现有逻辑保留，但样式为独立浮动胶囊）
3. **右侧组**：Agent 状态 + 控制按钮（胶囊形 pill）

各组之间有足够间距，不连在一起。每个胶囊内的控件用固定间距分隔时不加额外背景，同属一组时共享一个 Liquid Glass pill 背景。

---

### 优先级 2 — 材质系统重定义

#### 定义三种材质层级

```css
/* 最外层：应用窗口背景 */
--mat-base: 深色时 rgba(20, 20, 22, 1)，支持实际壁纸叠加

/* 导航/控件层：Liquid Glass Regular */
--mat-lg-regular:
  background: rgba(30, 30, 35, 0.72)
  backdrop-filter: blur(40px) saturate(180%) brightness(1.1)
  border: 1px solid rgba(255,255,255,0.10) top + left
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.15)  ← 高光边缘
             + 0 8px 32px rgba(0,0,0,0.30)

/* 内容层中的卡片：Standard Material（非 Liquid Glass！）*/
--mat-content-card:
  background: rgba(255,255,255,0.04)
  border: 1px solid rgba(255,255,255,0.06)
  不加 backdrop-filter（内容层里不用 Liquid Glass）
```

**Liquid Glass 的视觉特征（Web 实现）：**
- **折射感**：顶部/左侧有更亮的 `inset` 高光，底部/右侧略暗
- **镜面反射**：`::before` 伪元素做一个从白色到透明的线性渐变，覆盖在顶部 1/3
- **环境自适应**：dark mode 偏暗，light mode 偏亮白；用 `color-mix()` 实现

#### 彻底废弃的效果

| 废弃 | 原因 |
|------|------|
| `shadow-[0_0_8px_var(--color-primary-glow)]` 外发光 | 霓虹风格，macOS 26 无此效果 |
| `.aurora-bg` animation | 持续循环动画，Apple 明确限制 |
| `.fui-grid-bg` 网格背景 | Sci-fi 美学，与 Liquid Glass 不兼容 |
| `--color-secondary: #D946EF` 品红强调色 | 多色竞争，macOS 26 单一系统 accent |
| `--color-accent: #00FF9D` 霓虹绿 | 同上 |
| Orbitron / Exo 2 字体 | 不是 SF Pro |

---

### 优先级 3 — 配色语言重建

#### 核心调色板（Dark Mode）

```
背景层级：
  Base:     #141416  ← 略带蓝黑
  Surface:  #1C1C1F  ← 卡片底色
  Elevated: #252528

文字层级（振动色，不是固定值）：
  Primary:   rgba(255,255,255,0.92)
  Secondary: rgba(255,255,255,0.55)
  Tertiary:  rgba(255,255,255,0.28)

唯一 Accent（系统蓝）：
  #0A84FF  ← macOS 系统蓝（Dark Mode）
  #007AFF  ← macOS 系统蓝（Light Mode）
  
语义色（饱和度降低，去掉发光）：
  Success: #30D158  ← macOS 绿
  Warning: #FF9F0A  ← macOS 黄
  Danger:  #FF453A  ← macOS 红
```

#### Light Mode 必须是一等公民

当前 Light Mode 是 Dark Mode 的被动备份。macOS 26 在 Light Mode 下 Liquid Glass 呈现**白色奶油感**（高度半透明白色 + 精细折射高光），完全不同于 Dark Mode 的深色版本。Light Mode 需要单独设计，不能只是反转颜色。

---

### 优先级 4 — 排版体系

#### 字体栈

```css
--font-system: -apple-system, "SF Pro Text", "Helvetica Neue", sans-serif;
--font-display: -apple-system, "SF Pro Display", "Helvetica Neue", sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", "Fira Code", monospace;
```

系统字体是 macOS 上唯一正确选择。`-apple-system` 在 macOS 上即 SF Pro，在其他平台回退到系统字体。这同时解决了字体加载性能问题。

#### 字号体系（8pt Grid）

```
--text-caption:  11px  ← 元数据、时间戳
--text-footnote: 12px  ← 次级说明
--text-body:     13px  ← 主要正文（macOS 默认）
--text-callout:  14px  ← 强调段落
--text-subhead:  15px  ← 小节标题
--text-headline: 17px  ← 主标题
--text-title2:   22px  ← 大标题
--text-large:    28px  ← 英雄标题
```

#### 大小写规范

- Section headers：Title Case（不是 ALL CAPS）
- Buttons：Title Case（"New Session"，不是 "NEW SESSION"）
- Status labels：可保留大写，但仅限 status badge 内部，tracking 从 `0.2em` 降到 `0.05em`

---

### 优先级 5 — 运动语言

#### Spring 物理 vs CSS ease

```css
/* 正确：弹簧物理感 */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);    /* 轻弹 */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);        /* 进入屏幕 */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);        /* 离开屏幕 */
--ease-standard: cubic-bezier(0.2, 0, 0, 1);          /* 标准过渡 */

/* 时长 */
--dur-micro:  100ms   ← 按钮按下反馈
--dur-fast:   200ms   ← hover 状态变化
--dur-normal: 350ms   ← 面板进入/退出
--dur-slow:   500ms   ← 大范围布局变化
```

#### 可接受的动画（仅响应交互）

- Sidebar 展开/收起：`transform: translateX` + `--ease-decelerate/accelerate`
- 按钮 active 状态：`scale(0.94)` + `--dur-micro` + `--ease-spring`
- 消息出现：`transform: translateY(8px) → 0` + fade in + `--ease-decelerate`
- Modal/Popover：Scale from source element + blur in

#### 明令禁止的动画

- 任何持续循环的发光/脉冲动画
- Spotlight animation（`animate-spotlight` 类）
- Aurora background 流动动画
- 纯装饰性的粒子或光晕

---

## 逐组件改造指令

### Sidebar

| 属性 | 当前 | 目标 |
|------|------|------|
| 形状 | 独立浮动圆角卡片 | 贴附左边缘，右侧单条边框 |
| 背景 | `glass-card`（均匀模糊） | Liquid Glass Regular（折射高光） |
| 圆角 | `rounded-xl` 全角 | `border-radius: 0 16px 16px 0`（右侧有角） |
| 宽度 | 固定 | 同样固定，但支持 compact 模式（只显示图标） |
| Session Header | `UPPERCASE tracking-[0.2em]`  | Title Case，`text-footnote`，secondary 色 |
| New Chat 按钮 | 强调色填充宽按钮 | Liquid Glass 胶囊，图标+文字，系统蓝文字色 |
| Session 列表项 | 垂直堆叠文字 | 单行，标题 truncate，状态圆点保留 |

### WorkspaceHeader → Floating Toolbar

当前 `h-16 flex items-center justify-between px-6` 的整条 Header 应拆解为：

```
┌──────────────────────────────────────────────────────┐
│  [≡ Project Name]   [Chat | TUI]   [● IDLE  ▶ ⏸ 🗑]  │
│   └─ pill A ─┘     └── pill B ──┘  └──── pill C ────┘ │
└──────────────────────────────────────────────────────┘
      ↑ position: absolute, top: 12px, left/right padding
      ↑ 每个 pill 是独立 Liquid Glass 胶囊
      ↑ 整体是透明容器，不是有背景色的条
```

### ChatArea

| 属性 | 当前 | 目标 |
|------|------|------|
| 背景 | 无（继承 app 背景） | 保持透明，让 app 壁纸透过 |
| 消息气泡-用户 | 蓝色填充 | 系统蓝半透明（Liquid Glass Clear 变体） |
| 消息气泡-助手 | dark surface 卡片 | Standard Material 卡片（无 backdrop-filter） |
| 工具调用区 | 带 neon 颜色的折叠面板 | 简洁折叠，状态色用点而非发光 |
| 输入框 | `lg-input` | 全圆角大输入框，Liquid Glass 材质，focus 时蓝色圈 |
| 发送按钮 | 独立按钮 | 嵌入输入框右侧，圆形，有内容时高亮 |

### ConnectionScreen / ProjectSelector

这两个屏幕是首次印象。应该：
- 居中对话框，`max-width: 480px`，Liquid Glass Regular 材质
- 背景：真实的 macOS 壁纸模糊（毛玻璃效果凸显 Liquid Glass 之美）
- 无 FUI 网格、无 aurora、无 neon glow
- 简洁的 SF Pro Display 标题 + 系统颜色

### Toast / Modal

- Toast：右上角浮动，Liquid Glass Clear 变体（因为是浮在内容上方的小提示）
- DeleteConfirmModal：大圆角 sheet（`border-radius: 20px`），Liquid Glass Regular

---

## 实施路线图（给工程师）

### Phase 1 — Token 层（2–3天）

重写 `theme.css`：
1. 清理所有 neon 颜色 token
2. 建立新的 `--mat-*` 材质变量
3. 建立正确的 LG 高光/折射变量
4. 字体栈换为 `-apple-system`
5. 字号 token 按 Apple 8pt grid

产出：新的 `theme.css`，不破坏现有组件但 token 值已更新

### Phase 2 — 材质类重建（3–4天）

重写 `index.css` 中的 `.lg*` 工具类：
1. 实现真正的折射高光效果（`::before` 渐变伪元素）
2. 废弃 `.glass-card`（改为 `.mat-content`）
3. 实现 `.mat-lg-regular`、`.mat-lg-clear`
4. 删除 `.aurora-bg`、`.fui-grid-bg`、`.animate-spotlight`

### Phase 3 — 布局重构（3–4天）

`App.tsx` 中的布局逻辑：
1. Sidebar 从浮动卡片改为边缘贴附元素
2. WorkspaceHeader 从全宽条改为三岛屿工具栏
3. 背景延伸效果实现（CSS only）

### Phase 4 — 组件逐一升级（持续进行）

按使用频率优先级：
1. Sidebar 条目 & New Chat 按钮
2. ChatArea 气泡 & 输入框
3. WorkspaceHeader 胶囊控件
4. ProjectSelector & ConnectionScreen
5. Settings Panel
6. Toast & Modal

---

## 验收标准

以下是我作为设计负责人的验收检查项，缺一不可：

- [ ] 打开应用，第一眼看到的是**内容**，不是界面本身
- [ ] Sidebar 悬浮时，看起来像是玻璃"盖"在内容上，而不是一个独立漂浮的面板
- [ ] Toolbar 中的控件是**胶囊小岛**，不是一整条横幅
- [ ] 切换 Light/Dark Mode 时，**两个模式都很美**，不是暗色的"白板版"
- [ ] 关闭所有动画装饰后（`prefers-reduced-motion`），界面同样完整可用
- [ ] 没有任何元素在用户**没有操作时**自行移动或发光
- [ ] 字体全部来自 `-apple-system`，不加载任何外部字体
- [ ] 在真实壁纸背景（如 macOS 26 默认壁纸）下截图，Liquid Glass 效果视觉上令人满意

---

## 一条底线

macOS 26 Liquid Glass 的精神不是"更好看的磨砂玻璃"，而是**让界面退到内容背后**。每当工程师问"这里该不该加 blur / 加 glow / 加 gradient"——答案几乎永远是：不。

让内容发光，而不是界面。
