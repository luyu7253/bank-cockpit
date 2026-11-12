// 生成 src/panels/index.json：列出所有 AI 面板文件，按首次加入仓库的时间排序（新的在后）。
// 发布到 Pages 前由 GitHub Actions 运行；本地预览前也可手动运行：npm run panels
// index.json 不进仓库（见 .gitignore），所以多个 AI 同时新增面板不会冲突。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'panels');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];

function addedAt(file) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%ct', '--', path.join('src/panels', file)], { encoding: 'utf8' }).trim().split('\n').pop();
    if (out) return Number(out) * 1000;
  } catch {}
  return fs.statSync(path.join(dir, file)).mtimeMs; // 还没提交的文件：用修改时间
}

const list = files.map((f) => ({ file: f, name: f.replace(/\.js$/, ''), addedAt: addedAt(f) })).sort((a, b) => a.addedAt - b.addedAt);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(list, null, 2) + '\n');
console.log(`panels/index.json：${list.length} 个面板`, list.map((p) => p.name).join(', '));
