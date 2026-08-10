import {readFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'private-src', 'miku');
const pages = [
  'miku-main.html',
  'miku-attack.html',
  'miku-journal.html',
  'miku-inventory.html',
  'miku-data.html'
];

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const file of pages) {
  const path = join(SOURCE, file);
  const html = await readFile(path, 'utf8');
  check(html.includes('data-theme="miku"'), `${file}: missing Miku theme`);
  check(html.includes('Miku Noelani'), `${file}: missing character name`);
  check((html.match(/class="page-nav-link"/g) || []).length === 5, `${file}: expected five navigation links`);
  check((html.match(/aria-current="page"/g) || []).length === 1, `${file}: expected one current navigation item`);
  check(html.includes('data-vault-page="attack"') || file === 'miku-attack.html', `${file}: Attack vault route missing`);

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1];
    if (target.includes('${') || /^(?:https?:|data:|blob:|#)/i.test(target)) continue;
    try { await stat(resolve(dirname(path), decodeURIComponent(target))); }
    catch { failures.push(`${file}: missing linked file ${target}`); }
  }

  for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="application\/json"/i.test(match[1])) {
      try { JSON.parse(match[2]); } catch (error) { failures.push(`${file}: invalid embedded JSON (${error.message})`); }
    } else {
      try { new vm.Script(match[2], {filename: file}); }
      catch (error) { failures.push(`${file}: script syntax error (${error.message})`); }
    }
  }
}

const css = await readFile(join(SOURCE, 'miku-fantasy.css'), 'utf8');
const main = await readFile(join(SOURCE, 'miku-main.html'), 'utf8');
check(main.includes('class="card quick-stats"'), 'miku-main.html: missing combat-stat bar');
for (const fragment of [
  '<strong>+2</strong><span>Proficiency</span>',
  '<strong>+3</strong><span>Initiative</span>',
  '<strong>45 ft</strong><span>Speed</span>',
  '<strong>11</strong><span>Passive Perception</span>'
]) check(main.includes(fragment), `miku-main.html: missing combat statistic ${fragment}`);
for (const color of ['--purple', '--gold', '--teal']) check(css.includes(color), `miku-fantasy.css: missing ${color} token`);
check((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'miku-fantasy.css: unbalanced braces');
if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${pages.length} Miku pages, shared theme, navigation targets, and embedded scripts.`);
}
