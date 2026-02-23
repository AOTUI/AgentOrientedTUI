# macOS 26 Liquid Glass: 全局设计规范与哲学
**Author: Alan Dye (VP of Human Interface Design, Apple)**
**Date: 2026-02-23**
**Target: AgentOrientedTUI / host GUI**

---

## 序言：寻找“必然性” (The Inevitability)

在设计 macOS 26 的 Liquid Glass 时，我们问自己的第一个问题不是“它应该长什么样”，而是“当内容成为绝对主角时，界面还剩下什么？”

答案是：**光、深度和秩序。**

全局的统一与和谐，不来自于你使用了多少种相同的颜色，而来自于**物理法则的统一**。在 host 的 GUI 中，我们必须建立一个严谨的 Z 轴空间。Liquid Glass 不是一种简单的 CSS `backdrop-filter`，它是一种“功能性材质”。它悬浮在内容之上，折射背景，汇聚光线。

以下是我对 host 界面重塑的详细指导。我们将通过不断的自我反思，剥离多余的装饰，直到界面呈现出一种“本该如此”的必然性。

---

## 1. 空间架构与材质哲学 (Spatial Architecture & Materials)

### 1.1 绝对的层级 (The Z-Axis)
整个应用只有三个物理层级，绝不能越界：
*   **Layer 0 (Environment):** 用户的桌面壁纸。这是所有光线和色彩的来源。
*   **Layer 1 (Content):** ChatArea、消息气泡、代码块。它们是实体，使用 **Standard Materials**（不透明或微透明，无强模糊）。
*   **Layer 2 (Navigation & Controls):** Sidebar、Toolbar、Floating Pills。它们是 **Liquid Glass**，悬浮在 Layer 1 之上，折射 Layer 0 和 Layer 1 的光线。

### 1.2 Liquid Glass 的光学参数
不要使用纯色。Liquid Glass 的美感来自于它对背景的“采样”和“提纯”。

*   **Liquid Glass Regular (用于 Sidebar / 大面积面板):**
    *   `backdrop-filter: blur(40px) saturate(150%) brightness(1.1)`
    *   `background: rgba(30, 30, 35, 0.65)` (Dark Mode) / `rgba(255, 255, 255, 0.65)` (Light Mode)
    *   **高光边缘 (Specular Highlight):** 顶部和左侧必须有一条极细的、几乎不可见的亮线，模拟玻璃切割边缘的反光。`box-shadow: inset 0.5px 0.5px 0px rgba(255, 255, 255, 0.15)`。
*   **Liquid Glass Clear (用于 Toolbar Pills / 悬浮小控件):**
    *   模糊度降低至 `blur(20px)`，透明度更高，让背后的文字在滚动时产生迷人的“透视”效果。

---

## 2. Sidebar 与 Pill 的几何学 (Geometry of Navigation)

Sidebar 不是一个随意的矩形，它是界面的骨架。

### 2.1 Sidebar 的形态
*   **位置与尺寸:** 宽度固定为 `260px`。它必须紧贴窗口左侧边缘。
*   **圆角 (Corner Radius):** 
    *   左侧贴边：`0px`。
    *   右侧悬浮：`16px`。
    *   *反思：为什么不是全圆角？因为 Sidebar 是窗口结构的延伸，全圆角会打破窗口的整体性，让它看起来像一个随时会飘走的错误弹窗。*
*   **分割线:** 右侧边缘不需要生硬的 `border`，而是使用一条 `rgba(255,255,255,0.08)` 的极细分割线。

### 2.2 选中状态 (The Selection Pill)
在 macOS 26 中，选中的高亮状态（Pill）必须遵循**同心圆原则 (Concentricity)**。

*   **形状与尺寸:** 
    *   高度：`32px`。
    *   内边距 (Padding)：左右各留 `8px` 的安全距离（不要贴满 Sidebar 边缘）。
    *   圆角：`8px`。*(计算公式：Sidebar 外圆角 16px - 边距 8px = Pill 圆角 8px。这保证了视觉上的绝对平行与和谐)*。
*   **材质 (Active State):** 
    *   不要使用高饱和的实色填充！
    *   使用 **Vibrant Fill**：`background: rgba(255, 255, 255, 0.1)` + `box-shadow: 0 1px 2px rgba(0,0,0,0.1)`。
    *   选中的文字和 Icon 使用系统强调色（System Blue）。
*   **交互反馈 (Hover & Active):**
    *   Hover: `rgba(255, 255, 255, 0.05)`，过渡时间 `150ms`，`ease-out`。
    *   Active (点击瞬间): `scale(0.97)`，使用 Spring 动画（弹簧物理），让界面感觉有质量、有触感。

---

## 3. 图标设计：SF Symbols 的精神 (Iconography)

图标是界面的标点符号。我们不需要花哨的、多色的 SVG，我们需要的是**排版级别的图标**。

### 3.1 设计原则
*   **线条一致性 (Stroke Weight):** 所有图标必须基于统一的网格绘制，线条粗细严格保持在 `1.5pt`（Regular weight）。绝不允许出现粗细不一的图标混用。
*   **圆角与端点 (Caps & Joins):** 线条的端点必须是圆角（Round Cap），转角必须是圆角（Round Join），这与 Liquid Glass 的柔和感相呼应。
*   **几何纯粹性:** 剥离所有不必要的细节。一个“设置”图标就是一个完美的齿轮，不需要内部的阴影或高光。

### 3.2 状态表达 (Filled vs. Outlined)
*   **未选中 (Inactive):** 使用线框（Outlined）版本。颜色使用 `Secondary Label` (`rgba(255,255,255,0.55)`)。
*   **选中 (Active):** 使用实心（Filled）版本。颜色的改变加上形态的改变（从线框到实心），能给用户最明确的视觉确认。颜色使用 `System Blue`。

### 3.3 尺寸与对齐
*   图标的视觉中心必须与文字的 Cap Height（大写字母高度）绝对对齐。
*   Sidebar 中的图标尺寸统一为 `16x16`，包含在 `24x24` 的点击区域内。

---

## 4. 字体排印：隐形的秩序 (Typography)

字体是 UI 的声音。在 host 中，之前的 `Orbitron` 和 `Exo 2` 声音太大了，它们在尖叫。macOS 26 的声音是平静、清晰、克制的。

### 4.1 字体栈 (The Font Stack)
彻底放弃自定义 Web Fonts。拥抱系统原生字体，这是获得极致清晰度和性能的唯一途径。
```css
--font-system: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
--font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif;
--font-mono: "SF Mono", "JetBrains Mono", monospace;
```

### 4.2 动态视觉字号 (Optical Sizing)
*   **20px 及以上 (Headers):** 使用 `SF Pro Display`。字间距 (Tracking) 必须微调收紧（例如 `-0.01em` 到 `-0.02em`），让大字看起来更紧凑、精致。
*   **19px 及以下 (Body, UI Controls):** 使用 `SF Pro Text`。字间距保持默认或微调放宽，确保小字号下的极致可读性。

### 4.3 严格的字号阶梯 (The Typographic Scale)
不要随意使用 `14px`、`15px`。遵循 Apple 的规范：
*   **Title 3 (大标题):** `20px`, Semibold, Tracking `-0.02em`。用于空状态提示或大模块标题。
*   **Headline (主标题):** `17px`, Semibold, Tracking `-0.01em`。
*   **Body (正文):** `13px`, Regular。用于 ChatArea 的对话内容。*(注意：macOS 的标准正文是 13px，而不是 Web 常用的 14px 或 16px，这让界面显得更专业、更像一个原生 App)*。
*   **Callout (控件文字):** `13px`, Medium。用于按钮、Pill 内部的文字。
*   **Footnote (次级信息):** `12px`, Regular, 颜色 `Secondary Label`。用于时间戳。
*   **Caption (微型标签):** `11px`, Bold, Tracking `0.02em`。仅用于极小的状态标签（如 "THINKING"），必须使用大写 (UPPERCASE)。

---

## 5. 反思与进化 (Reflection & Refinement)

在制定上述规范时，我进行了以下反思，以确保全局的和谐：

*   **反思 1：关于 Toolbar 的形态。**
    *   *初稿想法：* 让 Toolbar 成为横跨顶部的一整条 Liquid Glass。
    *   *自我否定：* 不对。如果 Sidebar 已经占据了左侧，顶部再来一条全宽的 Toolbar，界面就被“框”死了，显得笨重。
    *   *最终决定：* Toolbar 必须被打破！变成几个独立的 **Floating Pills**（悬浮胶囊）。左边一个胶囊放菜单，中间一个胶囊放视图切换，右边一个胶囊放状态。它们悬浮在内容之上，内容可以从它们之间的缝隙流过。这才是真正的 Liquid Glass 精神——轻盈、通透。

*   **反思 2：关于颜色的使用。**
    *   *初稿想法：* 保留之前的霓虹绿和赛博朋克粉，作为点缀。
    *   *自我否定：* 破坏了和谐。Liquid Glass 的背景已经是五颜六色的（因为它折射壁纸），如果 UI 控件本身再五颜六色，视觉上会极度混乱（脏）。
    *   *最终决定：* 实行**单色强调 (Monochromatic Accent)** 原则。整个应用只有一种强调色（System Blue）。所有的状态（Success, Warning）必须降低饱和度，或者仅以极小的圆点（Dot）形式出现，绝不能大面积渲染。

*   **反思 3：关于边框 (Borders)。**
    *   *初稿想法：* 给所有卡片加上 `1px solid rgba(255,255,255,0.1)` 的边框。
    *   *自我否定：* 边框是用来区分层级的，如果到处都是边框，层级就消失了。
    *   *最终决定：* 移除 80% 的边框。依靠 **阴影 (Shadows)** 和 **材质差异 (Material Contrast)** 来区分元素。只有在 Liquid Glass 的边缘，才使用极细的内发光边框来模拟玻璃的物理折射。

---

## 结语

设计不是做加法，而是做减法。
当你按照这份规范重构 host 时，你会发现很多 CSS 代码会被删除。你会删掉那些复杂的渐变、多余的阴影、奇怪的字体。

当一切多余之物被剥离，剩下的就是纯粹的结构、光影和排版。那时，host 就不再是一个“网页套壳”，而是一个真正属于 macOS 26 时代的、仿佛在玻璃中呼吸的智能体。

去执行吧。让每一个像素都有其存在的绝对理由。