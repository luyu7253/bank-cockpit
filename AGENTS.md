# 给 AI 协作者的约定

这个仓库是一个银行经营驾驶舱大屏的演示项目。PR 的「测试」通过后会**自动合并并发布**到 GitHub Pages，所以每个 PR 都必须可以直接上线。

## 新功能放进「AI 待建设区」（最重要）

页面底部有三个待建设区：**A、B、C**。需求里说「在 A 区做……」，就只做 A 区；没说哪个区，就选一个还空着的区（`src/panels/` 下还没有对应文件的那个），并在 PR 描述里写明用了哪个区。

- 每个区只对应**一个独立文件**：`src/panels/slot-a.js`、`slot-b.js`、`slot-c.js`。
- **只新建或修改你那个区的文件**（以及需要的话，在 `test/` 里新建你自己的测试文件）。**不要改** `index.html`、`src/app.js`、`src/styles.css`、`src/data.js` 等共享文件——别的 AI 可能正在同时改其它区，动共享文件会让 PR 冲突、没法自动合并。
- 面板文件格式：

```js
// src/panels/slot-a.js
export default {
  title: '风险预警',          // 面板标题（中文）
  unit: '实时 · 模拟数据',     // 标题右侧小字（可选）
  render(el, ctx) {
    // el：面板内容容器（DOM 元素），往里面放内容
    // ctx.data     —— src/data.js 的全部导出（monthly、branches、regulatory、nextTransaction、seededRandom……）
    // ctx.metrics  —— src/metrics.js（yoy、rankBy、shares、formatYi、formatAmount、signed）
    // ctx.layout   —— src/layout.js（scale、ringLayout、arcPath、gaugeArc、sparkPath……）
    // ctx.charts   —— src/charts.js（lineChart、barList、segmentBar、svg、tip）
    // ctx.colors   —— { series: [5 个序列色], good, warn, bad, accent }
  },
};
```

- 面板需要的样式：在 `render` 里给 `el` 内的元素写内联样式，或者在面板文件里创建一个 `<style>`，选择器都以 `[data-slot="a"]`（换成你的区）开头，不要影响其它区域。
- 面板需要的模拟数据：在面板文件里用 `ctx.data.seededRandom(固定种子)` 生成，保证每次打开数字一致。
- 面板需要的计算逻辑：写成面板文件里导出的纯函数（`export function ...`），并在 `test/slot-<区>.test.js` 里测试；测试文件里只 import 这些纯函数，不要依赖浏览器 DOM。

## 硬性要求

- **不引入任何依赖**：不加 npm 包、不加 CDN 脚本。`vendor/`（three.js 与地图数据）由维护者管理，不要修改；面板里也不要用 three.js。
- **界面文字一律中文**；**只用模拟数据**，不要出现任何真实机构名称。
- 提交前运行 `npm test`，必须全部通过。
- **文字一律不换行**：标题、标签、数值、列表项都必须单行显示（`white-space: nowrap`）。放不下就缩短文字或缩小字号，宁可少几个字，也不要折成两行或出现省略号截断。
- 页面是 **1920×1080 固定画布的大屏**（按窗口等比缩放），不需要适配手机。A 区和 C 区约 470×300 像素，B 区约 950×300 像素，面板内容要在这个尺寸内放得下、不出滚动条。

## 视觉规范

- 深色大屏风格：半透明深色面板、蓝色发光描边。颜色全部用 `src/styles.css` 里的 CSS 变量（`var(--accent)`、`var(--good)` 等）或 `ctx.colors`。
- 图表序列色按顺序用 `ctx.colors.series[0]` 起，不要自造颜色；状态色只用 good / warn / bad，并配上图标或文字，不能只靠颜色表达。
- 两个及以上序列的图表必须有图例；不要用双纵轴。
- 适度使用动效（数字滚动、条形增长、闪烁提示），但不要让页面卡顿；尊重 `prefers-reduced-motion`。

## PR 要求

- 标题用中文，说明做了什么、用的哪个区。
- 描述里写清楚：改了哪些文件、怎么验证的、页面上哪里能看到变化。
