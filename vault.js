(() => {
  'use strict';

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const loginPanel = document.getElementById('loginPanel');
  const loginForm = document.getElementById('loginForm');
  const loginButton = document.getElementById('loginButton');
  const status = document.getElementById('status');
  const viewer = document.getElementById('viewer');
  const frame = document.getElementById('characterFrame');
  let unlockedBundle = null;
  let activeBlobUrl = null;

  const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

  function normalizeUsername(value) {
    return value.trim().toLowerCase().normalize('NFKC');
  }

  async function sha256Hex(value) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
    return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function derivePasswordKey(password, kdf) {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        hash: kdf.hash,
        salt: fromBase64(kdf.salt),
        iterations: kdf.iterations
      },
      keyMaterial,
      {name: 'AES-GCM', length: 256},
      false,
      ['decrypt']
    );
  }

  async function decryptJson(key, encrypted, additionalData) {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(encrypted.iv),
        additionalData: encoder.encode(additionalData),
        tagLength: 128
      },
      key,
      fromBase64(encrypted.ciphertext)
    );
    return JSON.parse(decoder.decode(plaintext));
  }

  async function unlock(username, password) {
    const normalized = normalizeUsername(username);
    const userId = await sha256Hex(normalized);
    const userResponse = await fetch(`vault/users/${userId}.json`, {cache: 'no-store'});
    if (!userResponse.ok) throw new Error('Invalid credentials.');
    const userRecord = await userResponse.json();
    const passwordKey = await derivePasswordKey(password, userRecord.kdf);
    const wrapAad = `tidewick-vault:user:${normalized}:${userRecord.characterId}:v1`;
    const wrapped = await decryptJson(passwordKey, userRecord.wrap, wrapAad);
    const characterKey = await crypto.subtle.importKey(
      'raw',
      fromBase64(wrapped.key),
      {name: 'AES-GCM'},
      false,
      ['decrypt']
    );

    const characterResponse = await fetch(`vault/characters/${userRecord.characterId}.json`, {cache: 'no-store'});
    if (!characterResponse.ok) throw new Error('Invalid credentials.');
    const characterRecord = await characterResponse.json();
    const characterAad = `tidewick-vault:character:${userRecord.characterId}:v1`;
    return decryptJson(characterKey, characterRecord.encrypted, characterAad);
  }

  function showPage(pageName) {
    if (!unlockedBundle?.pages?.[pageName]) return;
    if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    const blob = new Blob([unlockedBundle.pages[pageName].html], {type: 'text/html'});
    activeBlobUrl = URL.createObjectURL(blob);
    frame.src = activeBlobUrl;
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginButton.disabled = true;
    status.textContent = 'Unlocking…';
    try {
      unlockedBundle = await unlock(
        document.getElementById('username').value,
        document.getElementById('password').value
      );
      loginPanel.hidden = true;
      viewer.hidden = false;
      status.textContent = '';
      showPage(unlockedBundle.entry || 'tracker');
    } catch {
      status.textContent = 'Invalid username or password.';
    } finally {
      loginButton.disabled = false;
      document.getElementById('password').value = '';
    }
  });

  window.addEventListener('message', event => {
    if (event.data?.type === 'vault:navigate') showPage(event.data.page);
  });
  window.addEventListener('pagehide', () => {
    unlockedBundle = null;
    if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
  });
})();
