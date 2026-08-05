import {readFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'private-src', 'azrael');
const pages = [
  'azrael-main.html',
  'azrael-spells.html',
  'azrael-attack.html',
  'azrael-journal.html',
  'azrael-inventory.html',
  'azrael-data.html'
];

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

for (const file of pages) {
  const path = join(SOURCE, file);
  const html = await readFile(path, 'utf8');
  check(html.includes('data-theme="azrael"'), `${file}: missing Azrael theme`);
  check(html.includes('Azrael'), `${file}: missing character name`);
  check(!/(?:Kenpachi|Miku|Tidewick Greyholt)/i.test(html), `${file}: contains a stale character reference`);
  check((html.match(/class="page-nav-link"/g) || []).length === 6, `${file}: expected six navigation links`);
  check((html.match(/<(?:a|span)[^>]*aria-current="page"/g) || []).length === 1, `${file}: expected one current navigation item`);
  check(html.includes('data-vault-page="spells"') || file === 'azrael-spells.html', `${file}: Spells vault route missing`);
  check(html.includes('data-vault-page="attack"') || file === 'azrael-attack.html', `${file}: Attack vault route missing`);
  const spellsPosition = html.indexOf('aria-label="Spells"');
  const attackPosition = html.indexOf('aria-label="Attack"');
  check(spellsPosition >= 0 && attackPosition > spellsPosition, `${file}: Attack navigation must be immediately after Spells`);

  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  check(duplicateIds.length === 0, `${file}: duplicate IDs ${duplicateIds.join(', ')}`);

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

const main = await readFile(join(SOURCE, 'azrael-main.html'), 'utf8');
check(main.includes('"hp":32'), 'azrael-main.html: expected 32 HP default');
check(main.includes('"ac":15'), 'azrael-main.html: expected AC 15 default');
check(main.includes('id="azrael-nautical-preview"'), 'azrael-main.html: nautical preview stylesheet is missing');
for (const color of ['#071723', '#102936', '#69bcc0', '#c6a15b', '#f1ebdd', '#a9bdc0', '#b8574f']) {
  check(main.toLowerCase().includes(color), `azrael-main.html: nautical preview is missing ${color}`);
}
const previewStyle = main.match(/<style id="azrael-nautical-preview">([\s\S]*?)<\/style>/)?.[1] || '';
check((previewStyle.match(/{/g) || []).length === (previewStyle.match(/}/g) || []).length, 'azrael-main.html: nautical preview stylesheet has unbalanced braces');
for (const file of pages.filter(page => page !== 'azrael-main.html')) {
  const html = await readFile(join(SOURCE, file), 'utf8');
  check(!html.includes('azrael-nautical-preview'), `${file}: main-page nautical preview leaked into another page`);
  check(html.includes('content="#071723"'), `${file}: theme color is not the approved hull navy`);
  check(html.includes('href="azrael-fantasy.css"'), `${file}: shared Azrael stylesheet is missing`);
}
for (const tracker of ['channelDivinityUsed', 'warPriestUsed', 'level1Used', 'level2Used']) {
  check(main.includes(`data-toggle-array="${tracker}"`), `azrael-main.html: missing ${tracker} controls`);
}
check(main.includes("state.channelDivinityUsed = (state.channelDivinityUsed || []).slice(0, -1);"), 'azrael-main.html: short rest must restore exactly one Channel Divinity use');
check((main.match(/data-channel-option="/g) || []).length === 3, 'azrael-main.html: expected three Channel Divinity option links');
for (const option of ['Divine Spark', 'Turn Undead', 'Guided Strike']) {
  check(main.includes(`>${option}</button>`), `azrael-main.html: missing ${option} modal link`);
}
check(main.includes('id="channelDivinityModal" aria-hidden="true"'), 'azrael-main.html: Channel Divinity modal is missing');
check(main.includes('role="dialog" aria-modal="true"'), 'azrael-main.html: Channel Divinity modal lacks accessible dialog semantics');
check(main.includes("event.key === 'Escape'"), 'azrael-main.html: Channel Divinity modal cannot be closed with Escape');
check(!main.includes('>Cleric Features</h2>'), 'azrael-main.html: Cleric Features card should be removed');
check(main.indexOf('>War Priest</h2>') < main.indexOf('>Channel Divinity</h2>'), 'azrael-main.html: War Priest card must appear before Channel Divinity');
for (const score of ['14', '10', '13', '8', '16', '12']) check(main.includes(`attribute-score">${score}<`), `azrael-main.html: missing ability score ${score}`);

const spellbook = await readFile(join(SOURCE, 'azrael-spells.html'), 'utf8');
for (const spell of ['Thaumaturgy', 'Poison Spray', 'Guidance', 'Sacred Flame', 'Resistance', 'Toll the Dead', 'Ray of Sickness', 'Fog Cloud', 'Thunderwave', 'Sanctuary', 'Command', 'Healing Word', 'Cure Wounds', 'Gust of Wind', 'Aid', 'Hold Person', 'Spiritual Weapon', 'Shatter', 'Thunderous Rebuke', 'Divine Spark', 'Turn Undead']) {
  check(spellbook.includes(`name:'${spell}'`), `azrael-spells.html: missing ${spell}`);
}
check(!/classes:\[[^\]]*'attack'/.test(spellbook), 'azrael-spells.html: spell records must not inherit Attack page card styling');
for (const spell of ['Poison Spray', 'Ray of Sickness', 'Spiritual Weapon']) {
  check(new RegExp(`name:'${spell}'[^\\n]+classes:\\[[^\\]]*'spell-attack'`).test(spellbook), `azrael-spells.html: ${spell} is missing its spell-specific attack tag`);
}
check(spellbook.includes('const formatMarkdown = value => escapeHtml(value)'), 'azrael-spells.html: safe Markdown formatter is missing');
check(spellbook.includes(".replace(/\\*\\*([^*\\n]+?)\\*\\*/g, '<strong>$1</strong>')"), 'azrael-spells.html: bold Markdown support is missing');
check(spellbook.includes(".replace(/\\*([^*\\n]+?)\\*/g, '<em>$1</em>')"), 'azrael-spells.html: italic Markdown support is missing');
check(spellbook.includes(".replace(/\\r?\\n/g, '<br>')"), 'azrael-spells.html: Markdown line-break support is missing');
check(spellbook.includes('<div class="spell-value">${formatMarkdown(value)}</div>'), 'azrael-spells.html: spell details do not use the safe Markdown formatter');

const attack = await readFile(join(SOURCE, 'azrael-attack.html'), 'utf8');
for (const weapon of ['Warhammer', 'Sickle', 'Longbow']) check(attack.includes(`name:'${weapon}'`), `azrael-attack.html: missing seeded ${weapon}`);
check(!/(?:ragePreview|rageEligible|rageMode)/i.test(attack), 'azrael-attack.html: stale Rage behavior should be absent');

const inventory = await readFile(join(SOURCE, 'azrael-inventory.html'), 'utf8');
for (const item of ['Warhammer', 'Sickle', 'Longbow', 'Shield']) check(inventory.includes(`name:'${item}'`), `azrael-inventory.html: missing seeded ${item}`);

const dataPage = await readFile(join(SOURCE, 'azrael-data.html'), 'utf8');
for (const key of ['azrael-tracker-level-4-v1', 'azrael-attacks-level-4-v1', 'azrael-inventory-level-4-v1', 'azrael-journal-level-4-v1']) {
  check(dataPage.includes(key), `azrael-data.html: missing backup key ${key}`);
}

const css = await readFile(join(SOURCE, 'azrael-fantasy.css'), 'utf8');
for (const token of ['--purple', '--gold', '--teal', '--paper']) check(css.includes(token), `azrael-fantasy.css: missing ${token} token`);
check((css.match(/{/g) || []).length === (css.match(/}/g) || []).length, 'azrael-fantasy.css: unbalanced braces');
for (const color of ['#071723', '#102936', '#69bcc0', '#c6a15b', '#f1ebdd', '#a9bdc0', '#b8574f']) {
  check(css.toLowerCase().includes(color), `azrael-fantasy.css: missing approved nautical color ${color}`);
}
check(css.includes('grid-template-columns: repeat(3, 42px) !important'), 'azrael-fantasy.css: desktop navigation is not locked to three columns');
check(css.includes('.details-page .pip:not(.used)'), 'azrael-fantasy.css: teal tracker-resource override is missing');
check(/\.spell-card\s*\{[^}]*position:\s*static;[^}]*padding:\s*0;/s.test(css), 'azrael-fantasy.css: spell cards do not explicitly reset Attack page positioning and padding');
check(css.includes('.spellbook-page .spell-card::after { content: none; display: none; }'), 'azrael-fantasy.css: spell cards do not suppress the Attack page decoration');

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${pages.length} Azrael pages, approved nautical palette, three-column navigation, saved-state keys, scripts, spells, attacks, and inventory.`);
}
