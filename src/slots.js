// 「AI 待建设区」加载器。
// 每个区对应一个独立文件 src/panels/slot-<id>.js；文件存在就渲染面板，不存在就显示占位。
// 新面板只需新建自己的文件，不改动任何共享文件，所以多个 AI 可以并行开发、互不冲突。
//
// 面板文件约定（见 AGENTS.md）：
//   export default {
//     title: '风险预警',            // 面板标题
//     unit: '实时 · 模拟数据',       // 标题右侧的小字（可选）
//     render(el, ctx) { ... },      // el 是面板内容容器；ctx 见下方
//   };

export const SLOT_IDS = ['a', 'b', 'c'];

const built = new Set();

async function tryLoad(id, ctx) {
  const el = document.querySelector(`[data-slot="${id}"]`);
  if (!el || built.has(id)) return;
  // 加时间戳绕过浏览器和 CDN 缓存，面板一发布就能被发现
  const url = new URL(`./panels/slot-${id}.js?v=${Date.now()}`, import.meta.url);
  let panel = null;
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (res.ok) panel = (await import(url.href)).default;
  } catch (err) {
    console.warn(`AI 待建设区 ${id.toUpperCase()} 加载失败`, err);
  }
  if (!panel) return; // 保持占位
  built.add(id);
  el.classList.remove('slot-empty');
  el.classList.add('slot-built');
  el.innerHTML = `
    <header><h2><span class="ai-tag">AI 建设</span>${panel.title}</h2><span class="unit">${panel.unit ?? ''}</span></header>
    <div class="slot-body"></div>`;
  try {
    await panel.render(el.querySelector('.slot-body'), ctx);
  } catch (err) {
    el.querySelector('.slot-body').textContent = '面板渲染出错，详见控制台';
    console.error(err);
  }
}

/** 加载已有面板；之后每 10 秒检查一次还空着的区，新面板发布后无需刷新页面就会亮起。 */
export async function loadSlots(ctx, { pollMs = 10000 } = {}) {
  await Promise.all(SLOT_IDS.map((id) => tryLoad(id, ctx)));
  const timer = setInterval(() => {
    const pending = SLOT_IDS.filter((id) => !built.has(id));
    if (!pending.length) return clearInterval(timer);
    pending.forEach((id) => tryLoad(id, ctx));
  }, pollMs);
}
