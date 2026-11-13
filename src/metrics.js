// 指标计算与格式化：纯函数，页面和测试共用。

/** 同比变化率（%），保留 1 位小数。base 为 0 时返回 null。 */
export function yoy(now, base) {
  if (!base) return null;
  return Math.round(((now - base) / base) * 1000) / 10;
}

/** 百分点差（用于不良率这类本身就是百分比的指标）。 */
export function pointDelta(now, base) {
  return Math.round((now - base) * 100) / 100;
}

/** 按字段降序排名，返回新数组，附带 rank（从 1 开始）。 */
export function rankBy(list, key) {
  return [...list]
    .sort((a, b) => b[key] - a[key])
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

/** 各项占合计的比例（%），保留 1 位小数。 */
export function shares(list, key) {
  const total = list.reduce((s, x) => s + x[key], 0);
  return list.map((x) => ({ ...x, pct: total ? Math.round((x[key] / total) * 1000) / 10 : 0 }));
}

/** 金额格式：亿元，千分位，保留 1 位。 */
export function formatYi(v) {
  return `${v.toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/** 交易金额格式：统一用元，千分位，保留 2 位小数，例如 "11,189,000.00 元"。 */
export function formatAmount(yuan) {
  return `${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
}

/** 带符号的变化文字，例如 "+5.2%" / "−0.11 pp"。 */
export function signed(v, unit = '%') {
  if (v === null || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  return `${sign}${Math.abs(v)}${unit}`;
}
