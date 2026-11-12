// 布局与几何计算：纯函数，测试覆盖。

/** 把 n 个点均匀放在椭圆上，从正上方顺时针开始。返回 [{x, y, angle}]。 */
export function ringLayout(n, cx, cy, rx, ry, startDeg = -90) {
  return Array.from({ length: n }, (_, i) => {
    const angle = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle), angle };
  });
}

/** 把数值线性映射到 [outMin, outMax]，超出范围会被夹住。 */
export function scale(v, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = Math.min(1, Math.max(0, (v - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

/** 两点之间的二次贝塞尔弧线（向外弯），返回 SVG path。 */
export function arcPath(x1, y1, x2, y2, bend = 0.18) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cx = mx - dy * bend, cy = my + dx * bend;
  return `M${x1.toFixed(1)},${y1.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
}

/** 仪表盘：按 0~1 的比例给出圆弧 path（从 startDeg 扫到 startDeg+sweep*ratio）。 */
export function gaugeArc(cx, cy, r, ratio, startDeg = 135, sweep = 270) {
  const t = Math.min(1, Math.max(0, ratio));
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = ((startDeg + sweep * t) * Math.PI) / 180;
  const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  const large = sweep * t > 180 ? 1 : 0;
  return t === 0 ? `M${p(a0)}` : `M${p(a0)} A${r},${r} 0 ${large} 1 ${p(a1)}`;
}

/** 监管指标状态：safe / watch（离红线 15% 以内）/ breach。 */
export function regulatoryState({ value, limit, better }) {
  const margin = better === 'high' ? (value - limit) / limit : (limit - value) / limit;
  if (margin < 0) return 'breach';
  if (margin < 0.15) return 'watch';
  return 'safe';
}

/** 迷你趋势线的 SVG path（宽 w 高 h，留 pad 像素边距）。 */
export function sparkPath(values, w, h, pad = 2) {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values);
  return values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (h - pad * 2);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join('');
}

/**
 * 墨卡托投影：经纬度 → 平面坐标。以 (lon0, lat0) 为原点，k 为缩放。
 * 返回 [x, y]，y 向北为正。
 */
export function mercator(lon, lat, lon0 = 104, lat0 = 35, k = 1) {
  const rad = Math.PI / 180;
  const my = (φ) => Math.log(Math.tan(Math.PI / 4 + (φ * rad) / 2));
  return [(lon - lon0) * rad * k, (my(lat) - my(lat0)) * k];
}
