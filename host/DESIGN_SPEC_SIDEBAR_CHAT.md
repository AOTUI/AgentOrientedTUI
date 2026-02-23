# macOS 26 Liquid Glass: Sidebar & Chat Hub Refinement
**Author: Alan Dye (Design Lead)**
**Date: 2026-02-22**
**Scope: Sidebar Sessions, Header Islands, Chat Input Hub**

---

## 设计哲学：让控制退隐，让对话浮现

在审视了你提出的优化方向后，我非常赞同你对“输入框过宽”和“Session 控制区位置不当”的直觉。在 macOS 26 的设计语境中，我们追求的是 **"Contextual Relevance"（情境相关性）**。

Agent 的状态（思考、执行、暂停）本质上是“对话”的一部分，把它放在顶部的 Header 是割裂的；把它和输入框（用户的发声点）结合在一起，构成一个统一的 **Chat Hub（对话中枢）**，这才是符合直觉的顶级 UX。

同时，关于 Header 浮岛与 macOS 交通灯（Traffic Lights）的冲突，你的观察非常敏锐。Apple 的设计从不与系统级控件打架，我们会用优雅的 Safe Area 和动态 Margin 来化解。

以下是精确到像素的视觉与交互重构方案。

---

## 1. Sidebar: Session 卡片改造 (The Memory Layer)

侧边栏是用户的记忆抽屉，它需要安静、清晰，且在需要时提供强大的上下文操作。

### 视觉与排版规范
*   **高度与间距**：每个 Session 卡片高度固定为 `44px`，内部左右 Padding `12px`。
*   **信息层级**：
    *   **Title**：`SF Pro Text`，`13px`，`Medium`，颜色 `var(--color-text-primary)`。单行截断（Truncate）。
    *   **Time Ago**：`SF Pro Text`，`11px`，`Regular`，颜色 `var(--color-text-tertiary)`（极低对比度，不抢视觉）。
    *   **Status Dot**：`6px` 圆点，仅在 Active/Thinking/Executing 时显示，Idle 时隐藏以减少视觉噪音。

### 交互与 "More" 菜单 (Ellipsis)
*   **Hover 态**：默认状态下隐藏操作按钮。当鼠标 Hover 到卡片时，右侧浮现竖向的三点图标（`IconEllipsisVertical`），颜色为 `var(--color-text-secondary)`。
*   **Menu Popover（上下文菜单）**：
    *   **材质**：`Liquid Glass Regular` (`backdrop-filter: blur(40px) saturate(180%)`)。
    *   **形状**：`border-radius: 12px`，外加极细的 `rgba(255,255,255,0.1)` 边框和柔和的阴影 `0 8px 24px rgba(0,0,0,0.2)`。
    *   **菜单项**：Pin (固定), Rename (重命名), Delete (删除)。
    *   **破坏性操作**：Delete 选项的文字和图标使用 `var(--color-danger)`，并在 Hover 时背景变为 `rgba(255, 69, 58, 0.15)`。

---

## 2. Header: 导航浮岛 (The Navigation Islands)

Header 不再是一个横跨屏幕的“条”，而是漂浮在内容上方的两个独立“岛屿”。

### 交通灯避让机制 (Traffic Light Clearance)
*   macOS 的红黄绿交通灯固定在窗口左上角（通常占据约 `72px` 宽度）。
*   **动态 Margin**：
    *   当 Sidebar **打开**时，左侧浮岛在 Sidebar 内部或紧贴 Sidebar 右侧，不会与交通灯冲突。
    *   当 Sidebar **关闭**时，左侧浮岛必须增加 `margin-left: 72px`（或 `80px` 安全区），优雅地避开交通灯，而不是被遮挡。

### 左侧浮岛：Context Pill (Hamburger + Title)
*   **尺寸与对齐**：高度 `40px`（比原来更大、更显眼）。上边界与 Sidebar 的顶部内容区对齐（通常是 `top: 24px` 或 `top: 32px`）。
*   **材质**：`Liquid Glass Regular`，`border-radius: 20px`（全圆角胶囊）。
*   **内部布局**：
    *   Hamburger Icon：左侧，`16px` 大小，点击区域 `32x32px`。
    *   分隔线：一条 `12px` 高、`1px` 宽的半透明竖线 `rgba(255,255,255,0.1)`。
    *   Title：`SF Pro Display`，`15px`，`Semibold`。字距微调 `tracking-tight`。
*   **UX 细节**：这是一个整体的胶囊，视觉上非常紧凑，强调“当前你在哪里”。

### 右侧浮岛：Mode Pill (Chat / TUI View)
*   **尺寸与对齐**：高度 `40px`。上边界与左侧浮岛**绝对水平对齐**。右边界与底部输入框的右边界**绝对垂直对齐**（建立隐形的网格线，这是高级感的来源）。
*   **材质**：`Liquid Glass Regular`，`border-radius: 20px`。
*   **内部交互 (Segmented Control)**：
    *   内部是一个分段控制器。选中态的背景是一个 `rgba(255,255,255,0.15)` 的滑块，带有 `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`。
    *   文字：`12px`，`Bold`，`UPPERCASE`（这里保留大写是因为它是模式切换标签），颜色在选中时为 Primary，未选中时为 Secondary。
    *   **动画**：切换时，背景滑块使用 Spring 动画平滑滑动（`transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`）。

---

## 3. Chat Hub: 输入与控制中枢 (The Command Center)

这是本次改造最精彩的部分。我们将 Agent 控制权下放，与用户的输入框合并，形成一个居中的、宽度受限的控制台。

### 整体布局约束
*   **最大宽度**：放弃全宽输入框。整个 Chat Hub（控制岛 + 输入框）的最大宽度限制为 `768px`（`max-w-3xl`）或 `832px`。居中显示。
*   **间距**：控制岛和输入框之间保持 `12px` 的间距。

### 左侧：Agent Control Pill (Session 控制浮岛)
*   **移除 Delete**：如你所说，删除当前 Session 的操作属于 Sidebar 的上下文菜单，不该出现在高频的输入区。
*   **尺寸**：高度与输入框一致（例如 `48px` 或 `52px`），`border-radius: 24px`。
*   **材质**：`Liquid Glass Regular`。
*   **内容**：
    *   **Play/Pause 按钮**：圆形，`32x32px`。Hover 时有轻微放大效果。
    *   **状态指示器**：一个小圆点 + 状态文字（如 "THINKING", "IDLE"）。文字使用 `11px`，`SF Pro Text`，`Medium`。
    *   **动态色彩**：当状态为 THINKING 时，整个胶囊的边框或背景可以有极其微弱的 Secondary Color（如紫色）的呼吸感（注意：是极微弱的透明度变化，不是刺眼的霓虹发光）。

### 右侧：Input Field (用户输入框)
*   **尺寸**：占据剩余的 Flex 空间（`flex-1`），高度随内容自适应，最小高度 `48px` 或 `52px`。`border-radius: 24px`。
*   **材质**：`Liquid Glass Clear`（比 Regular 更透明，让背景透过来更多，显得更轻盈）。
*   **边框**：默认 `1px solid rgba(255,255,255,0.1)`。Focus 时，边框变为 `rgba(255,255,255,0.3)`，并伴随一个非常柔和的系统蓝光晕 `box-shadow: 0 0 0 4px rgba(10, 132, 255, 0.15)`。
*   **排版**：输入文字使用 `15px`，`SF Pro Text`，行高 `1.5`。
*   **发送按钮**：内嵌在输入框右侧。默认状态为半透明/不可点；当有输入内容时，变为系统蓝（System Blue）的圆形按钮，图标为白色。

---

## 总结：为什么这样设计更好？

1. **视线聚焦 (Focal Point)**：将输入框收窄并居中，用户的视线不再需要在宽大的屏幕上左右横跳。阅读和输入的体验直线上升。
2. **逻辑闭环 (Logical Grouping)**：Agent 的状态（它在干什么）和用户的输入（我要它干什么）在物理空间上紧密结合，构成了完整的“人机对话循环”。
3. **呼吸感 (Breathing Room)**：通过将 Header 拆分为浮岛，我们把屏幕顶部的空间“还给”了背景壁纸。Liquid Glass 的魅力就在于这种“悬浮于空间之中”的通透感。

请让开发团队严格按照上述的尺寸、字体（SF Pro）和材质（Liquid Glass 规范）进行实现。细节决定了这是一款“能用的工具”还是一件“令人愉悦的作品”。