// Link/asset checker for the built site: every relative href/src (and /aurora/ absolute path) must exist.
// Usage: node scripts/site-check.mjs [dir]   (default _site)
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(process.argv[2] || '_site');
const BASE = '/aurora';
const bad = [];
let files = 0, links = 0;

function walk(d) {
  return readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
for (const f of walk(root).filter((p) => p.endsWith('.html'))) {
  files++;
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    let u = m[1];
    if (/^(https?:|mailto:|#|data:|javascript:)/.test(u)) continue;
    links++;
    u = u.split('#')[0].split('?')[0];
    if (!u) continue;
    const target = u.startsWith(BASE + '/') ? join(root, u.slice(BASE.length)) : u.startsWith('/') ? null : join(dirname(f), u);
    if (target === null) { bad.push(`${f.replace(root, '')}: root-absolute link ${u} (use ${BASE}/...)`); continue; }
    const ok = existsSync(target) && (statSync(target).isFile() || existsSync(join(target, 'index.html')));
    if (!ok) bad.push(`${f.replace(root, '')}: missing ${u}`);
  }
  if (/\{\{[A-Z_]+\}\}/.test(html)) bad.push(`${f.replace(root, '')}: unreplaced placeholder`);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`site-check: ${files} pages, ${links} local links OK`);
