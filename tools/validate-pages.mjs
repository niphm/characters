// Checks every character's private pages before they are built into the vault:
//   - each page links shared/base.css and its character theme, and the theme defines every colour the
//     shared stylesheets use;
//   - navigation reaches every page of that character, and every linked file exists;
//   - each shared script (shared/*.js) gets the page settings and elements it needs;
//   - the saved-data keys match the table below. Changing a key would hide a player's saved data, so
//     a mismatch here must never be "fixed" by editing the table;
//   - character-specific rules (starting HP, rest rules, spells, and so on) still hold.
// Run: node tools/validate-pages.mjs
import {readFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'private-src');
const SHARED = join(SRC, 'shared');
const GROUP_KEY = 'tidewick-group-inventory-level-4-v1';

const keysFor = (id, trackerKey = `${id}-tracker-level-4-v1`) => ({
  tracker: trackerKey,
  journal: `${id}-journal-level-4-v1`,
  inventory: `${id}-inventory-level-4-v1`,
  active: `${id}-active-inventory-level-4-v1`,
  attacks: `${id}-attacks-level-4-v1`
});

const CHARACTERS = [
  {
    id: 'tidewick', name: 'Tidewick Greyholt', app: 'Tidewick Tracker', dir: SRC, theme: 'tidewick-theme.css',
    keys: keysFor('tidewick', 'tidewick-tracker-level-3-storm-ui-v1'),
    pages: {tracker: 'tidewick-greyholt-level-4.html', spells: 'Tidewick Spells Level 4.html', journal: 'Tidewick Journal Level 4.html', inventory: 'Tidewick Inventory Level 4.html', data: 'Tidewick Data Level 4.html'}
  },
  {
    id: 'hestia', name: 'Hestia Hearthstone', app: 'Hestia Tracker', dir: join(SRC, 'hestia'), theme: 'hestia-theme.css',
    keys: keysFor('hestia'),
    pages: {tracker: 'hestia-main.html', spells: 'hestia-spells.html', journal: 'hestia-journal.html', inventory: 'hestia-inventory.html', data: 'hestia-data.html'}
  },
  {
    id: 'azrael', name: 'Azrael', app: 'Azrael Tracker', dir: join(SRC, 'azrael'), theme: 'azrael-theme.css',
    keys: keysFor('azrael'),
    pages: {tracker: 'azrael-main.html', spells: 'azrael-spells.html', attack: 'azrael-attack.html', journal: 'azrael-journal.html', inventory: 'azrael-inventory.html', data: 'azrael-data.html'}
  },
  {
    id: 'kenpachi', name: 'Kenpachi', app: 'Kenpachi Tracker', dir: join(SRC, 'kenpachi'), theme: 'kenpachi-theme.css',
    keys: keysFor('kenpachi'),
    pages: {tracker: 'kenpachi-main.html', attack: 'kenpachi-attack.html', journal: 'kenpachi-journal.html', inventory: 'kenpachi-inventory.html', data: 'kenpachi-data.html'}
  },
  {
    id: 'miku', name: 'Miku Noelani', app: 'Miku Tracker', dir: join(SRC, 'miku'), theme: 'miku-theme.css',
    keys: keysFor('miku'),
    pages: {tracker: 'miku-main.html', attack: 'miku-attack.html', journal: 'miku-journal.html', inventory: 'miku-inventory.html', data: 'miku-data.html'}
  }
];

// Elements a shared script only touches when the page opts in.
const OPTIONAL_IDS = {'tracker.js': ['conditions', 'concentration'], 'attack.js': ['rageMode', 'attackRageEligible']};

const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const exists = async path => { try { await stat(path); return true; } catch { return false; } };
const count = (text, pattern) => (text.match(pattern) || []).length;

// Every var(--x) used by the shared stylesheets must be defined in base.css's :root or the theme.
const sharedCss = {
  'base.css': await readFile(join(SHARED, 'base.css'), 'utf8'),
  'spellbook.css': await readFile(join(SHARED, 'spellbook.css'), 'utf8')
};
const usedVars = css => new Set([...css.matchAll(/var\((--[\w-]+)/g)].map(match => match[1]));
const definedVars = css => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(match => match[1]));
const engineIds = {};
for (const engine of ['tracker.js', 'journal.js', 'inventory.js', 'data.js', 'attack.js', 'spellbook.js']) {
  const source = await readFile(join(SHARED, engine), 'utf8');
  engineIds[engine] = [...new Set([...source.matchAll(/byId\('([^']+)'\)/g)].map(match => match[1]))]
    .filter(id => !(OPTIONAL_IDS[engine] || []).includes(id));
}

// Run a page's inline settings script and return window.PAGE.
const pageSettings = (html, file) => {
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).find(code => code.includes('window.PAGE'));
  if (!script) return null;
  const sandbox = {window: {}, document: {getElementById: () => null}};
  try { vm.runInNewContext(script, sandbox, {filename: file}); } catch (error) { failures.push(`${file}: page settings script failed (${error.message})`); return null; }
  return sandbox.window.PAGE;
};

const pagesById = {};
for (const character of CHARACTERS) {
  const {id, name, app, dir, theme, keys, pages} = character;
  const html = {};
  for (const [page, file] of Object.entries(pages)) html[page] = await readFile(join(dir, file), 'utf8');
  pagesById[id] = html;

  const themeCss = await readFile(join(dir, theme), 'utf8');
  check(count(themeCss, /{/g) === count(themeCss, /}/g), `${theme}: unbalanced braces`);
  const defined = new Set([...definedVars(sharedCss['base.css']), ...definedVars(themeCss)]);

  for (const [page, file] of Object.entries(pages)) {
    const text = html[page];
    const label = `${id}/${file}`;
    const path = join(dir, file);

    // Theme and shared styles.
    check(text.includes(`data-theme="${id}"`), `${label}: missing data-theme="${id}"`);
    check(text.includes(name), `${label}: missing the character name`);
    const sheets = [...text.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(match => match[1]);
    check(sheets[0]?.endsWith('shared/base.css'), `${label}: shared/base.css must be the first stylesheet`);
    check(sheets.at(-1) === theme, `${label}: ${theme} must be the last stylesheet`);
    for (const sheet of sheets.filter(sheet => sheet.includes('shared/'))) {
      const css = sharedCss[sheet.split('/').pop()];
      if (!css) continue;
      for (const variable of usedVars(css)) check(defined.has(variable), `${label}: ${theme} does not define ${variable}, used by ${sheet}`);
    }
    check(text.includes('class="character-header'), `${label}: header should use class "character-header"`);

    // Navigation.
    check(count(text, /class="page-nav-link"/g) === Object.keys(pages).length, `${label}: expected ${Object.keys(pages).length} navigation links`);
    check(count(text, /<(?:a|span)[^>]*aria-current="page"/g) === 1, `${label}: expected one current navigation item`);
    for (const [other, otherFile] of Object.entries(pages)) {
      if (other === page) continue;
      const link = text.match(new RegExp(`<a class="page-nav-link" href="([^"]+)" data-vault-page="${other}"`));
      check(link, `${label}: no navigation link with data-vault-page="${other}"`);
      if (link) check(decodeURIComponent(link[1]) === otherFile, `${label}: the ${other} link points to ${link[1]}`);
    }

    // Markup sanity.
    const ids = [...text.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    const duplicates = [...new Set(ids.filter((value, index) => ids.indexOf(value) !== index))];
    check(duplicates.length === 0, `${label}: duplicate IDs ${duplicates.join(', ')}`);
    for (const match of text.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const target = match[1];
      if (target.includes('${') || /^(?:https?:|data:|blob:|#)/i.test(target)) continue;
      check(await exists(resolve(dirname(path), decodeURIComponent(target))), `${label}: missing linked file ${target}`);
    }
    for (const match of text.matchAll(/<a\b[^>]*\bhref="https?:[^"]*"[^>]*>/gi)) {
      check(/\btarget="_blank"/i.test(match[0]), `${label}: outside link would replace the vault page; add target="_blank"`);
    }
    for (const match of text.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/\bsrc=/.test(match[1])) continue;
      if (/type="application\/json"/i.test(match[1])) {
        try { JSON.parse(match[2]); } catch (error) { failures.push(`${label}: invalid embedded JSON (${error.message})`); }
      } else {
        try { new vm.Script(match[2], {filename: file}); } catch (error) { failures.push(`${label}: script syntax error (${error.message})`); }
      }
    }

    // Shared scripts: app.js first, then the engine, with the elements and settings it needs.
    const scripts = [...text.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1].split('/').pop());
    const engines = scripts.filter(script => script !== 'app.js');
    if (engines.length) check(scripts[0] === 'app.js', `${label}: shared/app.js must load before ${engines.join(', ')}`);
    for (const engine of engines) {
      for (const required of engineIds[engine] || []) check(ids.includes(required), `${label}: ${engine} needs an element with id="${required}"`);
    }
    const settings = pageSettings(text, label);
    if (engines.some(engine => engine !== 'spellbook.js')) check(settings, `${label}: window.PAGE settings are missing`);
    if (!settings) continue;
    if (engines.includes('tracker.js')) {
      check(settings.trackerKey === keys.tracker, `${label}: trackerKey must stay "${keys.tracker}"`);
      check(typeof settings.shortRest === 'function' && typeof settings.longRest === 'function', `${label}: shortRest and longRest rules are required`);
      const defaults = JSON.parse(text.match(/<script type="application\/json" id="defaults">([\s\S]*?)<\/script>/)?.[1] || '{}');
      for (const rest of ['shortRest', 'longRest']) {
        try { check(typeof settings[rest]({...defaults}) === 'string', `${label}: ${rest} must return a status message (or '')`); }
        catch (error) { failures.push(`${label}: ${rest} failed on the default state (${error.message})`); }
      }
      for (const match of text.matchAll(/data-toggle-(?:array|bool)="([^"]+)"/g)) {
        check(match[1] in defaults, `${label}: tracker control "${match[1]}" has no default value`);
      }
    }
    if (engines.includes('journal.js')) {
      check(settings.journalKey === keys.journal, `${label}: journalKey must stay "${keys.journal}"`);
      check(typeof settings.emptyText === 'string', `${label}: emptyText is required`);
    }
    if (engines.includes('inventory.js')) {
      check(settings.owner === id, `${label}: inventory owner must be "${id}"`);
      check(settings.storageKeys?.[id] === keys.inventory, `${label}: personal inventory key must stay "${keys.inventory}"`);
      check(settings.storageKeys?.group === GROUP_KEY, `${label}: Group inventory key must stay "${GROUP_KEY}"`);
      check(settings.activeKey === keys.active, `${label}: activeKey must stay "${keys.active}"`);
      check(text.includes(`data-inventory="${id}"`) && text.includes('data-inventory="group"'), `${label}: inventory tabs must be data-inventory="${id}" and "group"`);
      for (const coin of ['cp', 'sp', 'ep', 'gp', 'pp']) {
        const icon = settings.coinIcons?.[coin];
        check(icon && await exists(resolve(dirname(path), icon)), `${label}: missing ${coin} coin icon`);
      }
      const seedIds = (settings.seedItems || []).map(item => item.id);
      check(new Set(seedIds).size === seedIds.length, `${label}: seed items need unique ids`);
    }
    if (engines.includes('data.js')) {
      check(settings.app === app, `${label}: backup app name must stay "${app}" or old backups will not import`);
      check(settings.keys?.tracker === keys.tracker && settings.keys?.journal === keys.journal && settings.keys?.inventory === keys.inventory && settings.keys?.groupInventory === GROUP_KEY,
        `${label}: backup keys must match the tracker, journal, inventory and Group keys`);
      check(pages.attack ? settings.keys?.attacks === keys.attacks : !('attacks' in (settings.keys || {})), `${label}: backup attacks key does not match the Attack page`);
    }
    if (engines.includes('attack.js')) {
      check(settings.attacksKey === keys.attacks, `${label}: attacksKey must stay "${keys.attacks}"`);
      if (settings.rage) {
        check(settings.rage.trackerKey === keys.tracker, `${label}: rage.trackerKey must be the tracker key`);
        for (const optional of OPTIONAL_IDS['attack.js']) check(ids.includes(optional), `${label}: Rage needs id="${optional}"`);
      }
    }
  }
}

// ---- Character-specific rules ----
const tidewick = pagesById.tidewick;
check(tidewick.tracker.includes('"hp":26') && tidewick.tracker.includes('"ac":12'), 'Tidewick: expected 26 HP and AC 12 defaults');
for (const tracker of ['sorcery', 'l1', 'l2', 'innateSorcery', 'inspiration', 'favored', 'freeMageArmor', 'feyMisty', 'feyCommand']) {
  check(tidewick.tracker.includes(`="${tracker}"`), `Tidewick tracker: missing ${tracker} controls`);
}
check(count(tidewick.spells, /<details class="spell"/g) === 20, 'Tidewick spellbook: expected 20 spells');
check(count(tidewick.spells, /class="spell-incant"/g) >= 15, 'Tidewick spellbook: incantations are missing');

const hestia = pagesById.hestia;
check(hestia.tracker.includes('"hp":26') && hestia.tracker.includes('"ac":14'), 'Hestia: expected 26 HP and AC 14 defaults');
for (const tracker of ['sorceryUsed', 'level1Used', 'level2Used', 'innateUsed', 'tidesUsed', 'freeCastsUsed', 'inspirationUsed']) {
  check(hestia.tracker.includes(`="${tracker}"`), `Hestia tracker: missing ${tracker} controls`);
}
const srdIds = new Set([...hestia.spells.matchAll(/data-srd-spell="([^"]+)"/g)].map(match => match[1]));
check(srdIds.size === 12, `Hestia spellbook: expected 12 Wild Magic spell links, found ${srdIds.size}`);
for (const spell of srdIds) check(hestia.spells.includes(`'${spell}': {`), `Hestia spellbook: no SRD text for ${spell}`);
check(hestia.spells.includes('System Reference Document 5.2.1') && hestia.spells.includes('creativecommons.org/licenses/by/4.0'), 'Hestia spellbook: the SRD 5.2.1 credit line is required');

const kenpachi = pagesById.kenpachi;
check(kenpachi.tracker.includes('"hp":41') && kenpachi.tracker.includes('"ac":16'), 'Kenpachi: expected 41 HP and AC 16 defaults');
check(!kenpachi.tracker.includes('tempHp'), 'Kenpachi: temporary HP counter should be absent');
check(!/data-adjust="hp"[^>]*data-max=/.test(kenpachi.tracker), 'Kenpachi: HP controls should allow values above 41');
for (const tracker of ['rageUsed', 'adrenalineUsed']) check(kenpachi.tracker.includes(`data-toggle-array="${tracker}"`), `Kenpachi: ${tracker} tracker is missing`);
for (const weapon of ['Pistol', 'Warhammer', 'Javelin']) check(kenpachi.attack.includes(`name:'${weapon}'`), `Kenpachi attacks: missing seeded ${weapon}`);
check(kenpachi.attack.includes('attackRageEligible'), 'Kenpachi attacks: Rage damage support is missing');
check(!/miku/i.test(Object.values(kenpachi).join('')), 'Kenpachi: contains a leftover Miku reference');

const miku = pagesById.miku;
for (const fragment of ['<strong>+2</strong><span>Proficiency</span>', '<strong>+3</strong><span>Initiative</span>', '<strong>45 ft</strong><span>Speed</span>', '<strong>11</strong><span>Passive Perception</span>']) {
  check(miku.tracker.includes(fragment), `Miku: missing combat statistic ${fragment}`);
}
check(miku.attack.includes("pinnedId: 'unarmed'"), 'Miku attacks: Unarmed Strike must stay pinned');

const azrael = pagesById.azrael;
check(azrael.tracker.includes('"hp":32') && azrael.tracker.includes('"ac":15'), 'Azrael: expected 32 HP and AC 15 defaults');
check(!/(?:Kenpachi|Miku|Tidewick Greyholt)/i.test(Object.values(azrael).join('')), 'Azrael: contains a stale character reference');
check(azrael.tracker.includes('id="azrael-nautical-preview"'), 'Azrael: nautical preview stylesheet is missing');
for (const page of ['spells', 'attack', 'journal', 'inventory', 'data']) {
  check(!azrael[page].includes('azrael-nautical-preview'), `Azrael ${page}: main-page nautical preview leaked into another page`);
  check(azrael[page].includes('content="#071723"'), `Azrael ${page}: theme color is not the approved hull navy`);
}
for (const page of Object.keys(azrael)) {
  const spells = azrael[page].indexOf('aria-label="Spells"');
  check(spells >= 0 && azrael[page].indexOf('aria-label="Attack"') > spells, `Azrael ${page}: Attack navigation must come right after Spells`);
}
for (const tracker of ['channelDivinityUsed', 'warPriestUsed', 'level1Used', 'level2Used']) check(azrael.tracker.includes(`data-toggle-array="${tracker}"`), `Azrael: missing ${tracker} controls`);
check(azrael.tracker.includes('state.channelDivinityUsed = (state.channelDivinityUsed || []).slice(0, -1);'), 'Azrael: Short Rest must restore exactly one Channel Divinity use');
check(count(azrael.tracker, /data-channel-option="/g) === 3, 'Azrael: expected three Channel Divinity option links');
for (const option of ['Divine Spark', 'Turn Undead', 'Guided Strike']) check(azrael.tracker.includes(`>${option}</button>`), `Azrael: missing ${option} pop-up link`);
check(azrael.tracker.includes('id="channelDivinityModal" aria-hidden="true"') && azrael.tracker.includes('role="dialog" aria-modal="true"') && azrael.tracker.includes("event.key === 'Escape'"), 'Azrael: Channel Divinity pop-up lost its dialog behaviour');
check(!azrael.tracker.includes('>Cleric Features</h2>'), 'Azrael: Cleric Features card should be removed');
check(azrael.tracker.indexOf('>War Priest</h2>') < azrael.tracker.indexOf('>Channel Divinity</h2>'), 'Azrael: War Priest card must appear before Channel Divinity');
for (const score of ['14', '10', '13', '8', '16', '12']) check(azrael.tracker.includes(`attribute-score">${score}<`), `Azrael: missing ability score ${score}`);
for (const spell of ['Thaumaturgy', 'Poison Spray', 'Guidance', 'Sacred Flame', 'Resistance', 'Toll the Dead', 'Ray of Sickness', 'Fog Cloud', 'Thunderwave', 'Sanctuary', 'Command', 'Healing Word', 'Cure Wounds', 'Gust of Wind', 'Aid', 'Hold Person', 'Spiritual Weapon', 'Shatter', 'Thunderous Rebuke', 'Divine Spark', 'Turn Undead']) {
  check(azrael.spells.includes(`name:'${spell}'`), `Azrael spells: missing ${spell}`);
}
check(!/classes:\[[^\]]*'attack'/.test(azrael.spells), 'Azrael spells: spell records must not inherit Attack page card styling');
for (const spell of ['Poison Spray', 'Ray of Sickness', 'Spiritual Weapon']) {
  check(new RegExp(`name:'${spell}'[^\\n]+classes:\\[[^\\]]*'spell-attack'`).test(azrael.spells), `Azrael spells: ${spell} is missing its spell-attack tag`);
}
check(azrael.spells.includes('const formatMarkdown = value => escapeHtml(value)') && azrael.spells.includes('<div class="spell-value">${formatMarkdown(value)}</div>'), 'Azrael spells: spell details must use the safe Markdown formatter');
for (const weapon of ['Warhammer', 'Sickle', 'Longbow']) check(azrael.attack.includes(`name:'${weapon}'`), `Azrael attacks: missing seeded ${weapon}`);
check(!/(?:ragePreview|rageEligible|rageMode)/i.test(azrael.attack), 'Azrael attacks: stale Rage behaviour should be absent');
for (const item of ['Warhammer', 'Sickle', 'Longbow', 'Shield']) check(azrael.inventory.includes(`name:'${item}'`), `Azrael inventory: missing seeded ${item}`);
const azraelCss = await readFile(join(SRC, 'azrael', 'azrael-theme.css'), 'utf8');
for (const color of ['#071723', '#102936', '#69bcc0', '#c6a15b', '#f1ebdd', '#a9bdc0', '#b8574f']) check(azraelCss.toLowerCase().includes(color), `azrael-theme.css: missing approved nautical colour ${color}`);
check(azraelCss.includes('grid-template-columns: repeat(3, 42px) !important'), 'azrael-theme.css: navigation must stay three columns wide');
check(/\.spell-card\s*\{[^}]*position:\s*static;[^}]*padding:\s*0;/s.test(azraelCss) && azraelCss.includes('.spellbook-page .spell-card::after { content: none; display: none; }'), 'azrael-theme.css: spell cards must not inherit Attack card decoration');

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  const pageCount = CHARACTERS.reduce((sum, character) => sum + Object.keys(character.pages).length, 0);
  console.log(`Validated ${pageCount} pages for ${CHARACTERS.length} characters: shared styles and scripts, navigation, saved-data keys, and character rules.`);
}
