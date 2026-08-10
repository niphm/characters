import {readFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'private-src', 'kenpachi');
const pages = [
  'kenpachi-main.html',
  'kenpachi-attack.html',
  'kenpachi-journal.html',
  'kenpachi-inventory.html',
  'kenpachi-data.html'
];

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const file of pages) {
  const path = join(SOURCE, file);
  const html = await readFile(path, 'utf8');
  check(html.includes('data-theme="kenpachi"'), `${file}: missing Kenpachi theme`);
  check(html.includes('Kenpachi'), `${file}: missing character name`);
  check(!/miku/i.test(html), `${file}: contains a leftover Miku reference`);
  check((html.match(/class="page-nav-link"/g) || []).length === 5, `${file}: expected five navigation links`);
  check((html.match(/aria-current="page"/g) || []).length === 1, `${file}: expected one current navigation item`);
  check(html.includes('data-vault-page="attack"') || file === 'kenpachi-attack.html', `${file}: Attack vault route missing`);

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

  for (const match of html.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
    check(html.includes(`id="${match[1]}"`) || html.includes(`id='${match[1]}'`), `${file}: script references missing #${match[1]}`);
  }
}

const main = await readFile(join(SOURCE, 'kenpachi-main.html'), 'utf8');
check(main.includes('"hp":41'), 'kenpachi-main.html: expected 41 HP default');
check(main.includes('"ac":16'), 'kenpachi-main.html: expected AC 16 default');
check(!main.includes('tempHp'), 'kenpachi-main.html: temporary HP counter should be absent');
check(!/data-adjust="hp"[^>]*data-max=/.test(main), 'kenpachi-main.html: HP controls should allow values above 41');
check(main.includes('data-toggle-array="rageUsed"'), 'kenpachi-main.html: Rage tracker is missing');
check(main.includes('data-toggle-array="adrenalineUsed"'), 'kenpachi-main.html: Adrenaline Rush tracker is missing');
for (const icon of ['assets/warhammer.png', 'assets/rage.png', 'assets/adrenaline-rush.png', 'assets/relentless-endurance.png']) {
  check(main.includes(icon), `kenpachi-main.html: missing ${icon}`);
}

const attack = await readFile(join(SOURCE, 'kenpachi-attack.html'), 'utf8');
for (const weapon of ['Pistol', 'Warhammer', 'Javelin']) check(attack.includes(`name:'${weapon}'`), `kenpachi-attack.html: missing seeded ${weapon}`);
check(attack.includes('attackRageEligible'), 'kenpachi-attack.html: Rage damage support is missing');

const dataPage = await readFile(join(SOURCE, 'kenpachi-data.html'), 'utf8');
for (const key of ['kenpachi-tracker-level-4-v1', 'kenpachi-attacks-level-4-v1', 'kenpachi-inventory-level-4-v1', 'kenpachi-journal-level-4-v1']) {
  check(dataPage.includes(key), `kenpachi-data.html: missing backup key ${key}`);
}

const css = await readFile(join(SOURCE, 'kenpachi-fantasy.css'), 'utf8');
for (const color of ['--purple', '--gold', '--teal', '--paper']) check(css.includes(color), `kenpachi-fantasy.css: missing ${color} token`);
check((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'kenpachi-fantasy.css: unbalanced braces');
for (const color of ['#0a0c0c', '#b25432', '#aeb9bd', '#eee7d8']) check(css.includes(color), `kenpachi-fantasy.css: forged-iron palette is missing ${color}`);
for (const icon of ['warhammer.png', 'rage.png', 'adrenaline-rush.png', 'relentless-endurance.png']) {
  check((await stat(join(SOURCE, 'assets', icon))).size > 0, `${icon} is empty`);
}

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${pages.length} Kenpachi pages, shared theme, navigation targets, embedded scripts, and custom icons.`);
}
