// 「AI 建设区」：AI 每上线一个面板，这里就长出一块；数量不设上限。
//
// - 面板清单 src/panels/index.json 由 scripts/build-panels.mjs 在发布时生成（不进仓库），
//   每个面板是独立文件 src/panels/<英文短名>.js，所以多个 AI 并行新增面板互不冲突。
// - 页面每 10 秒检查一次清单，新面板无需刷新就会「长」出来。
// - 每页固定 4 块、尺寸统一（与面板设计稿 460×236 同比例）；超过 4 块分页，自动横向滑动翻页，
//   新面板上线时跳到它所在的页并高亮。末尾始终有一块「＋ 等待新需求」。
//
// 面板文件约定（见 AGENTS.md）：
//   export default { title: '风险预警', unit: '实时 · 模拟数据', render(el, ctx) { ... } };

export const DESIGN_W = 460;
export const DESIGN_H = 236;
const PER_PAGE = 4;
const AUTO_FLIP_MS = 7000;

export function loadSlots(ctx, { pollMs = 10000 } = {}) {
  const zone = document.querySelector('[data-build-zone]');
  const viewport = zone.querySelector('.build-grid');
  const counter = zone.querySelector('[data-build-count]');
  const dotsEl = zone.querySelector('[data-build-pages]');
  const track = document.createElement('div');
  track.className = 'build-track';
  viewport.replaceChildren(track);
  const tiles = new Map(); // name -> element
  let page = 0;
  let holdUntil = 0; // 新面板上线后暂停自动翻页一会儿

  const ghost = document.createElement('section');
  ghost.className = 'build-tile ghost';
  ghost.innerHTML = '<div class="ghost-inner"><b>＋</b><p>等待新需求</p><small>在飞书 @DSH开发团队 说一句，AI 就在这里新建一块</small></div>';

  const pageCount = () => Math.ceil((tiles.size + 1) / PER_PAGE);

  function layout() {
    const all = [...tiles.values(), ghost];
    const pages = pageCount();
    page = Math.min(page, pages - 1);
    const frag = [];
    for (let p = 0; p < pages; p++) {
      const el = document.createElement('div');
      el.className = 'build-page';
      el.append(...all.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE));
      // 最后一页不足 4 块时用空位补齐，保证每块大小一致
      for (let k = el.children.length; k < PER_PAGE; k++) { const pad = document.createElement('div'); pad.className = 'build-pad'; el.append(pad); }
      frag.push(el);
    }
    track.replaceChildren(...frag);
    counter.textContent = tiles.size;
    dotsEl.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('') : '';
    go(page, false);
    requestAnimationFrame(fitAll);
  }

  function go(p, animate = true) {
    page = p;
    track.style.transition = animate ? 'transform .8s cubic-bezier(.6,0,.2,1)' : 'none';
    track.style.transform = `translateX(${-100 * page}%)`;
    [...dotsEl.children].forEach((d, i) => d.classList.toggle('on', i === page));
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

  async function addPanel(item, initial) {
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
    if (!initial) { holdUntil = Date.now() + 12000; go(Math.floor((tiles.size - 1) / PER_PAGE)); }
    try {
      await panel.render(tile.querySelector('.tile-canvas'), ctx);
    } catch (err) {
      tile.querySelector('.tile-canvas').textContent = '面板渲染出错，详见控制台';
      console.error(err);
    }
    setTimeout(() => tile.classList.remove('grow'), 1600);
  }

  let firstSync = true;
  async function sync() {
    let list = [];
    try {
      const res = await fetch(new URL(`./panels/index.json?v=${Date.now()}`, import.meta.url), { cache: 'no-store' });
      if (res.ok) list = await res.json();
    } catch {}
    for (const item of list) if (!tiles.has(item.name)) await addPanel(item, firstSync);
    firstSync = false;
  }

  layout();
  sync();
  setInterval(sync, pollMs);
  setInterval(() => {
    const pages = pageCount();
    if (pages > 1 && Date.now() > holdUntil) go((page + 1) % pages);
  }, AUTO_FLIP_MS);
  addEventListener('resize', fitAll);
}
