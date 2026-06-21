import {createHash, pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv} from 'node:crypto';
import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {basename, dirname, join, resolve} from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const ITERATIONS = 600_000;
const VERSION = 1;

function usage() {
  console.log(`
Tidewick encrypted-vault administrator

Create or replace a character bundle:
  node tools/vault-admin.mjs init-character --id tidewick --tracker "private-src/tidewick-greyholt-level-4.html" --spellbook "private-src/Tidewick Spells Level 4.html"

Update an existing character bundle while preserving all logins:
  node tools/vault-admin.mjs update-character --id tidewick --tracker "private-src/tidewick-greyholt-level-4.html" --spellbook "private-src/Tidewick Spells Level 4.html"

Add or replace a login:
  node tools/vault-admin.mjs add-user --character tidewick --username david

The tool prompts for secrets without saving passwords. Character recovery keys are
encrypted under an administrator passphrase in private-src/admin/ and are ignored by Git.
`);
}

function parseArgs(values) {
  const result = {_: []};
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }
    result[value.slice(2)] = values[++index];
  }
  return result;
}

function b64(value) {
  return Buffer.from(value).toString('base64');
}

function unb64(value) {
  return Buffer.from(value, 'base64');
}

function encryptJson(key, value, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {iv: b64(iv), ciphertext: b64(Buffer.concat([ciphertext, cipher.getAuthTag()]))};
}

function decryptJson(key, encrypted, aad) {
  const combined = unb64(encrypted.ciphertext);
  const ciphertext = combined.subarray(0, -16);
  const tag = combined.subarray(-16);
  const decipher = createDecipheriv('aes-256-gcm', key, unb64(encrypted.iv));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
}

function deriveKey(password, salt, iterations = ITERATIONS) {
  return pbkdf2Sync(password, salt, iterations, 32, 'sha256');
}

async function readSecret(prompt, environmentName) {
  if (environmentName && process.env[environmentName]) return process.env[environmentName];
  if (!process.stdin.isTTY) throw new Error('Secret prompts require an interactive terminal.');
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolveSecret, reject) => {
    let value = '';
    const onData = char => {
      if (char === '\u0003') {
        cleanup();
        reject(new Error('Cancelled.'));
      } else if (char === '\r' || char === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolveSecret(value);
      } else if (char === '\u0008' || char === '\u007f') {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (char >= ' ') {
        value += char;
        process.stdout.write('•');
      }
    };
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    process.stdin.on('data', onData);
  });
}

async function confirmedSecret(label, environmentName) {
  const first = await readSecret(`${label}: `, environmentName);
  if (first.length < 14) throw new Error(`${label} must be at least 14 characters.`);
  if (environmentName && process.env[environmentName]) return first;
  const second = await readSecret(`Confirm ${label.toLowerCase()}: `);
  if (first !== second) throw new Error('The entries did not match.');
  return first;
}

function normalizeUsername(value) {
  return value.trim().toLowerCase().normalize('NFKC');
}

function usernameId(value) {
  return createHash('sha256').update(normalizeUsername(value)).digest('hex');
}

function dataUri(mime, bytes) {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

function injectBridge(html) {
  const bridge = `<script>
document.addEventListener('click',event=>{
  const link=event.target.closest('[data-vault-page]');
  if(!link)return;
  event.preventDefault();
  parent.postMessage({type:'vault:navigate',page:link.dataset.vaultPage},'*');
});
</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${bridge}</body>`) : `${html}${bridge}`;
}

async function preparePages(trackerPath, spellbookPath) {
  let tracker = await readFile(trackerPath, 'utf8');
  let spellbook = await readFile(spellbookPath, 'utf8');
  const compassPath = join(dirname(spellbookPath), 'tidewick-compass-home.png');
  try {
    const compass = await readFile(compassPath);
    spellbook = spellbook.replaceAll('src="tidewick-compass-home.png"', `src="${dataUri('image/png', compass)}"`);
  } catch {
    console.warn(`Warning: ${basename(compassPath)} was not found; the spellbook home icon may not render.`);
  }

  tracker = tracker
    .replace(/href="Tidewick%20Spells%20Level%204\.html"/g, 'href="#spellbook" data-vault-page="spellbook"')
    .replace(/<link rel="manifest"[^>]*>/g, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>/g, '');
  spellbook = spellbook
    .replace(/href="tidewick-greyholt-level-4\.html"/g, 'href="#tracker" data-vault-page="tracker"')
    .replace(/<link rel="manifest"[^>]*>/g, '')
    .replace(/<link rel="apple-touch-icon"[^>]*>/g, '');

  return {
    tracker: {html: injectBridge(tracker)},
    spellbook: {html: injectBridge(spellbook)}
  };
}

async function initCharacter(args) {
  if (!args.id || !args.tracker || !args.spellbook) throw new Error('Missing --id, --tracker, or --spellbook.');
  const id = args.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const trackerPath = resolve(ROOT, args.tracker);
  const spellbookPath = resolve(ROOT, args.spellbook);
  await access(trackerPath);
  await access(spellbookPath);
  const adminPassword = await confirmedSecret('Administrator recovery passphrase', 'VAULT_ADMIN_PASSWORD');
  const characterKey = randomBytes(32);
  const pages = await preparePages(trackerPath, spellbookPath);
  const payload = {
    version: VERSION,
    id,
    title: args.title || 'Tidewick Greyholt',
    entry: 'tracker',
    pages,
    generatedAt: new Date().toISOString()
  };

  const encrypted = encryptJson(characterKey, payload, `tidewick-vault:character:${id}:v1`);
  await mkdir(join(ROOT, 'vault', 'characters'), {recursive: true});
  await writeFile(
    join(ROOT, 'vault', 'characters', `${id}.json`),
    JSON.stringify({version: VERSION, encrypted}, null, 2)
  );

  const salt = randomBytes(16);
  const adminKey = deriveKey(adminPassword, salt);
  const recovery = encryptJson(adminKey, {key: b64(characterKey)}, `tidewick-vault:admin:${id}:v1`);
  await mkdir(join(ROOT, 'private-src', 'admin'), {recursive: true});
  await writeFile(
    join(ROOT, 'private-src', 'admin', `${id}.key.json`),
    JSON.stringify({
      version: VERSION,
      kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: b64(salt)},
      recovery
    }, null, 2)
  );
  console.log(`Encrypted character written to vault/characters/${id}.json`);
}

async function recoverCharacterKey(characterId) {
  const recoveryPath = join(ROOT, 'private-src', 'admin', `${characterId}.key.json`);
  const recoveryRecord = JSON.parse(await readFile(recoveryPath, 'utf8'));
  const adminPassword = await readSecret('Administrator recovery passphrase: ', 'VAULT_ADMIN_PASSWORD');
  const adminKey = deriveKey(adminPassword, unb64(recoveryRecord.kdf.salt), recoveryRecord.kdf.iterations);
  const recovered = decryptJson(
    adminKey,
    recoveryRecord.recovery,
    `tidewick-vault:admin:${characterId}:v1`
  );
  return unb64(recovered.key);
}

async function updateCharacter(args) {
  if (!args.id || !args.tracker || !args.spellbook) throw new Error('Missing --id, --tracker, or --spellbook.');
  const id = args.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const trackerPath = resolve(ROOT, args.tracker);
  const spellbookPath = resolve(ROOT, args.spellbook);
  await access(trackerPath);
  await access(spellbookPath);
  await access(join(ROOT, 'vault', 'characters', `${id}.json`));

  const characterKey = await recoverCharacterKey(id);
  const pages = await preparePages(trackerPath, spellbookPath);
  const payload = {
    version: VERSION,
    id,
    title: args.title || 'Tidewick Greyholt',
    entry: 'tracker',
    pages,
    generatedAt: new Date().toISOString()
  };
  const encrypted = encryptJson(characterKey, payload, `tidewick-vault:character:${id}:v1`);
  await writeFile(
    join(ROOT, 'vault', 'characters', `${id}.json`),
    JSON.stringify({version: VERSION, encrypted}, null, 2)
  );
  console.log(`Updated vault/characters/${id}.json without changing existing logins.`);
}

async function addUser(args) {
  if (!args.character || !args.username) throw new Error('Missing --character or --username.');
  const characterId = args.character.trim().toLowerCase();
  const normalizedUsername = normalizeUsername(args.username);
  const characterKey = await recoverCharacterKey(characterId);
  const userPassword = await confirmedSecret(`Password for ${normalizedUsername}`, 'VAULT_USER_PASSWORD');
  const salt = randomBytes(16);
  const userKey = deriveKey(userPassword, salt);
  const wrap = encryptJson(
    userKey,
    {key: b64(characterKey)},
    `tidewick-vault:user:${normalizedUsername}:${characterId}:v1`
  );
  const record = {
    version: VERSION,
    characterId,
    kdf: {name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: b64(salt)},
    wrap
  };
  await mkdir(join(ROOT, 'vault', 'users'), {recursive: true});
  const id = usernameId(normalizedUsername);
  await writeFile(join(ROOT, 'vault', 'users', `${id}.json`), JSON.stringify(record, null, 2));
  console.log(`Login created for ${normalizedUsername}.`);
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
try {
  if (command === 'init-character') await initCharacter(args);
  else if (command === 'update-character') await updateCharacter(args);
  else if (command === 'add-user') await addUser(args);
  else usage();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}
