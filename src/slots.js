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

export async function loadSlots(ctx) {
  await Promise.all(SLOT_IDS.map(async (id) => {
    const el = document.querySelector(`[data-slot="${id}"]`);
    if (!el) return;
    const url = new URL(`./panels/slot-${id}.js`, import.meta.url);
    let panel = null;
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (res.ok) panel = (await import(url.href)).default;
    } catch (err) {
      console.warn(`AI 待建设区 ${id.toUpperCase()} 加载失败`, err);
    }
    if (!panel) return; // 保持占位
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
  }));
}
