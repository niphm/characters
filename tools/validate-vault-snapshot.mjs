import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {join, resolve} from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CHARACTERS = ['tidewick', 'miku', 'kenpachi', 'azrael'];
const failures = [];

const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const readJson = async path => {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    failures.push(`${path}: ${error.message}`);
    return null;
  }
};

const characterDirectory = join(ROOT, 'vault', 'characters');
const userDirectory = join(ROOT, 'vault', 'users');
const characterFiles = (await readdir(characterDirectory)).filter(file => file.endsWith('.json'));
const userFiles = (await readdir(userDirectory)).filter(file => file.endsWith('.json'));

check(characterFiles.length === CHARACTERS.length, `expected ${CHARACTERS.length} character records, found ${characterFiles.length}`);
check(userFiles.length === CHARACTERS.length, `expected ${CHARACTERS.length} login records, found ${userFiles.length}`);

for (const characterId of CHARACTERS) {
  const characterFile = `${characterId}.json`;
  check(characterFiles.includes(characterFile), `missing vault/characters/${characterFile}`);
  const character = await readJson(join(characterDirectory, characterFile));
  if (character) {
    check(character.version === 1, `${characterFile}: unsupported version`);
    check(Boolean(character.encrypted?.iv && character.encrypted?.ciphertext), `${characterFile}: incomplete encrypted payload`);
    check(!JSON.stringify(character).includes('<!doctype html>'), `${characterFile}: plaintext HTML detected`);
  }

  const userId = createHash('sha256').update(characterId).digest('hex');
  const userFile = `${userId}.json`;
  check(userFiles.includes(userFile), `missing login record for ${characterId}`);
  const user = await readJson(join(userDirectory, userFile));
  if (user) {
    check(user.characterId === characterId, `${userFile}: expected characterId ${characterId}, found ${user.characterId}`);
    check(user.kdf?.iterations === 600_000, `${userFile}: unexpected password KDF settings`);
    check(Boolean(user.wrap?.iv && user.wrap?.ciphertext), `${userFile}: incomplete wrapped character key`);
  }
}

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated complete vault snapshot: ${CHARACTERS.length} encrypted characters and ${CHARACTERS.length} matching login records.`);
}
