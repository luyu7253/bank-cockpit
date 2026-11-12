// 「AI 建设区」：AI 每上线一个面板，这里就长出一块；数量不设上限。
//
// - 面板清单 src/panels/index.json 由 scripts/build-panels.mjs 在发布时生成（不进仓库），
//   每个面板是独立文件 src/panels/<英文短名>.js，所以多个 AI 并行新增面板互不冲突。
// - 页面每 10 秒检查一次清单，新面板无需刷新就会「长」出来。
// - 每个面板按固定设计尺寸 DESIGN_W × DESIGN_H 渲染，再整体缩放进当前格子，
//   面板越多格子越小，但面板内部排版不变。
//
// 面板文件约定（见 AGENTS.md）：
//   export default { title: '风险预警', unit: '实时 · 模拟数据', render(el, ctx) { ... } };

export const DESIGN_W = 460;
export const DESIGN_H = 236;
const PER_PAGE = 8;

/** 按面板数（含末尾的「等待新需求」占位）决定行列。 */
export function gridFor(total) {
  if (total <= 4) return { rows: 1, cols: Math.max(total, 1) };
  const n = Math.min(total, PER_PAGE);
  return { rows: 2, cols: Math.ceil(n / 2) };
}

export function loadSlots(ctx, { pollMs = 10000 } = {}) {
  const zone = document.querySelector('[data-build-zone]');
  const grid = zone.querySelector('.build-grid');
  const counter = zone.querySelector('[data-build-count]');
  const tiles = new Map(); // name -> element
  let page = 0;

  const ghost = document.createElement('section');
  ghost.className = 'build-tile ghost';
  ghost.innerHTML = '<div class="ghost-inner"><b>＋</b><p>等待新需求</p><small>在飞书 @DSH开发团队 说一句，AI 就在这里新建一块</small></div>';

  function layout() {
    const all = [...tiles.values(), ghost];
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
    page = Math.min(page, pages - 1);
    const visible = all.length > PER_PAGE ? all.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE) : all;
    const { rows, cols } = gridFor(visible.length);
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.gridTemplateRows = `repeat(${rows}, minmax(0, 1fr))`;
    grid.replaceChildren(...visible);
    grid.dataset.rows = rows;
    zone.querySelector('[data-build-pages]').textContent = pages > 1 ? `第 ${page + 1}/${pages} 页` : '';
    counter.textContent = tiles.size;
    requestAnimationFrame(fitAll);
  }

  function fitAll() {
    for (const tile of tiles.values()) {
      const box = tile.querySelector('.tile-body');
      const canvas = tile.querySelector('.tile-canvas');
      if (!box || !canvas) continue;
      const s = Math.min(box.offsetWidth / DESIGN_W, box.offsetHeight / DESIGN_H);
      canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
    }
  }

  async function addPanel(item) {
    const url = new URL(`./panels/${item.file}?v=${item.addedAt || Date.now()}`, import.meta.url);
    let panel;
    try {
      panel = (await import(url.href)).default;
    } catch (err) {
      console.warn(`面板 ${item.name} 加载失败`, err);
      return;
    }
    const tile = document.createElement('section');
    tile.className = 'build-tile grow';
    tile.dataset.panel = item.name;
    tile.innerHTML = `
      <header><h2><span class="ai-tag">AI</span>${panel.title}</h2><span class="unit">${panel.unit ?? ''}</span></header>
      <div class="tile-body"><div class="tile-canvas" data-panel="${item.name}" style="width:${DESIGN_W}px;height:${DESIGN_H}px"></div></div>`;
    const legacy = item.name.match(/^slot-([a-z])$/); // 兼容旧的 A/B/C 区面板（样式写在 [data-slot] 下）
    if (legacy) tile.querySelector('.tile-canvas').dataset.slot = legacy[1];
    tiles.set(item.name, tile);
    layout();
    try {
      await panel.render(tile.querySelector('.tile-canvas'), ctx);
    } catch (err) {
      tile.querySelector('.tile-canvas').textContent = '面板渲染出错，详见控制台';
      console.error(err);
    }
    setTimeout(() => tile.classList.remove('grow'), 1600);
  }

  async function sync() {
    let list = [];
    try {
      const res = await fetch(new URL(`./panels/index.json?v=${Date.now()}`, import.meta.url), { cache: 'no-store' });
      if (res.ok) list = await res.json();
    } catch {}
    for (const item of list) if (!tiles.has(item.name)) await addPanel(item);
  }

  layout();
  sync();
  setInterval(sync, pollMs);
  setInterval(() => { if (tiles.size + 1 > PER_PAGE) { page++; if (page * PER_PAGE >= tiles.size + 1) page = 0; layout(); } }, 8000);
  addEventListener('resize', fitAll);
}
