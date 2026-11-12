# 给 AI 协作者的约定

这个仓库是一个银行经营驾驶舱大屏的演示项目。PR 的「测试」通过后会**自动合并并发布**到 GitHub Pages，所以每个 PR 都必须可以直接上线。

## 新功能做成「AI 建设区」里的一个新面板（最重要）

页面底部是「AI 建设区」，数量不设上限：每上线一个面板就新长出一块。每个需求就做**一个新面板**。

- 新建**一个独立文件** `src/panels/<英文短名>.js`，文件名只用小写英文、数字和连字符，能看出内容，例如 `risk-alerts.js`、`deposit-mix.js`。先看一眼 `src/panels/` 里已有的文件，不要重名。
- **只新建你自己的面板文件**（需要的话再在 `test/` 里新建 `<英文短名>.test.js`）。**不要改**任何其它文件——别的 AI 可能正在同时做别的面板，动共享文件会让 PR 冲突、没法自动合并。
- 面板清单 `src/panels/index.json` 由发布流程自动生成，不要手写、不要提交。本地预览前运行 `npm run panels` 生成一份即可。
- 面板文件格式：

```js
// src/panels/risk-alerts.js
export default {
  title: '风险预警',          // 面板标题：中文，不超过 12 个字
  unit: '实时 · 模拟数据',     // 标题右侧小字（可选，尽量短）
  render(el, ctx) {
    // el：面板画布（DOM 元素），固定 460 × 236 像素；页面会把整块画布等比缩放进格子里，
    //     所以请按 460 × 236 设计，不要读取窗口尺寸，也不要写 @media。
    // ctx.data     —— src/data.js 的全部导出（monthly、branches、regulatory、finance、nextTransaction、seededRandom……）
    // ctx.metrics  —— src/metrics.js（yoy、rankBy、shares、formatYi、formatAmount、signed）
    // ctx.layout   —— src/layout.js（scale、ringLayout、arcPath、gaugeArc、sparkPath……）
    // ctx.charts   —— src/charts.js（lineChart、barList、segmentBar、svg、tip）
    // ctx.colors   —— { series: [5 个序列色], good, warn, bad, accent }
  },
};
```

- 面板样式：在 `render` 里写内联样式，或在面板文件里创建一个 `<style>`，选择器都以 `[data-panel="<英文短名>"]` 开头，不要影响页面其它部分。
- 面板需要的模拟数据：在面板文件里用 `ctx.data.seededRandom(固定种子)` 生成，保证每次打开数字一致。
- 面板需要的计算逻辑：写成面板文件里导出的纯函数（`export function ...`），并在 `test/<英文短名>.test.js` 里测试；测试只 import 这些纯函数，不要依赖浏览器 DOM。`test/panels.test.js` 会检查每个面板都导出了 `{ title, render }`。

## 一个需求里有多个面板：拆给子 Agent 并行做（每个面板一个 PR）

需求里列了多个面板（例如「一次性新增 6 个面板：A、B、C……」）时，**不要自己一个个做**，按下面做：

1. 先给每个面板定一个英文短名（`src/panels/<短名>.js`），并确认和已有面板不重名。
2. **由你先给每个面板建好独立工作目录和分支**（依次执行，几秒就完）：
   `git -C <执行目录> fetch origin main && git -C <执行目录> worktree add <执行目录>-<短名> -b agent/<工单短名>-<短名> origin/main`
   （`<执行目录>` 即 `$DSH_SUPERAGENT_DIR`，`<工单短名>` 即 `$DSH_SUPERAGENT_NAME`。）
3. **在同一步里一次性发起全部 `subagent` 调用**（每个面板一个），让它们同时开工，不要等一个做完再派下一个。每个调用：
   - `cwd` 设为该面板的工作目录 `<执行目录>-<短名>`；
   - `description` 写面板短名（例如 `risk-alerts`）；
   - `prompt` 写清楚：只做 `src/panels/<短名>.js` 这一个面板，遵守 `AGENTS.md` 全部规定；只在当前目录工作、不要切换分支；`npm test` 通过后提交、推送当前分支，**单独开一个 PR**（标题：新增「<面板标题>」面板，描述照「PR 要求」写）；完成后只回报 PR 链接、面板文件名、测试结果。
4. 子 Agent 全部返回后，你检查每个 PR 的测试状态，最后向调度员一次性汇报所有 PR 链接。PR 测试通过后会自动合并、自动发布，面板会一个接一个出现在大屏上。

## 硬性要求

- **不引入任何依赖**：不加 npm 包、不加 CDN 脚本。`vendor/`（three.js 与地图数据）由维护者管理，不要修改；面板里也不要用 three.js。
- **界面文字一律中文**；**只用模拟数据**，不要出现任何真实机构名称。
- 提交前运行 `npm test`，必须全部通过。
- **文字一律不换行**：标题、标签、数值、列表项都必须单行显示（`white-space: nowrap`）。放不下就缩短文字或缩小字号，宁可少几个字，也不要折成两行或出现省略号截断。
- 页面是 **1920×1080 固定画布的大屏**（按窗口等比缩放），不需要适配手机。面板画布固定 460×236 像素，内容要在这个尺寸内放得下、不出滚动条。

## 视觉规范

- 深色大屏风格：半透明深色面板、蓝色发光描边。颜色全部用 `src/styles.css` 里的 CSS 变量（`var(--accent)`、`var(--good)` 等）或 `ctx.colors`。
- 图表序列色按顺序用 `ctx.colors.series[0]` 起，不要自造颜色；状态色只用 good / warn / bad，并配上图标或文字，不能只靠颜色表达。
- 两个及以上序列的图表必须有图例；不要用双纵轴。
- 适度使用动效（数字滚动、条形增长、闪烁提示），但不要让页面卡顿；尊重 `prefers-reduced-motion`。

## PR 要求

- 标题用中文，说明新增了什么面板。
- 描述里写清楚：改了哪些文件、怎么验证的、页面上哪里能看到变化。
