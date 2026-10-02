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
  const backupNote = document.getElementById('backupNote');
  const lockButton = document.getElementById('lockButton');
  const BACKUP_REMINDER_DAYS = 14;
  let unlockedBundle = null;
  let activeBlobUrl = null;
  let activePage = null;

  // Wrong usernames and wrong passwords deliberately share one message.
  const MESSAGES = {
    credentials: 'Invalid username or password.',
    network: 'Couldn’t reach the vault. Check your connection and try again.',
    server: 'The vault site returned an error. Try again in a moment.',
    missing: 'Your character file is missing from the site. It may need to be republished.',
    damaged: 'Your character file couldn’t be opened. It may be mid-update; reload and try again.',
    unsupported: 'This browser can’t unlock the vault. Use a current browser over https.'
  };

  class VaultError extends Error {
    constructor(reason) {
      super(MESSAGES[reason]);
      this.reason = reason;
    }
  }

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

  // 'no-cache' revalidates with the server, so unchanged vault files come back as a quick 304.
  async function fetchJson(url, notFoundReason) {
    let response;
    try {
      response = await fetch(url, {cache: 'no-cache'});
    } catch {
      throw new VaultError('network');
    }
    if (response.status === 404) throw new VaultError(notFoundReason);
    if (!response.ok) throw new VaultError('server');
    try {
      return await response.json();
    } catch {
      throw new VaultError('server');
    }
  }

  async function unlock(username, password) {
    if (!globalThis.crypto?.subtle) throw new VaultError('unsupported');
    const normalized = normalizeUsername(username);
    const userId = await sha256Hex(normalized);
    const userRecord = await fetchJson(`vault/users/${userId}.json`, 'credentials');
    let characterKey;
    try {
      const passwordKey = await derivePasswordKey(password, userRecord.kdf);
      const wrapAad = `tidewick-vault:user:${normalized}:${userRecord.characterId}:v1`;
      const wrapped = await decryptJson(passwordKey, userRecord.wrap, wrapAad);
      characterKey = await crypto.subtle.importKey(
        'raw',
        fromBase64(wrapped.key),
        {name: 'AES-GCM'},
        false,
        ['decrypt']
      );
    } catch {
      throw new VaultError('credentials');
    }

    const characterRecord = await fetchJson(`vault/characters/${userRecord.characterId}.json`, 'missing');
    const characterAad = `tidewick-vault:character:${userRecord.characterId}:v1`;
    try {
      return await decryptJson(characterKey, characterRecord.encrypted, characterAad);
    } catch {
      throw new VaultError('damaged');
    }
  }

  // Pages are swapped with location.replace so the frame never builds its own history of
  // revoked blob URLs (Back used to show a blank frame). Top-level history entries drive Back instead.
  function showPage(pageName, {addHistory = false} = {}) {
    if (!unlockedBundle?.pages?.[pageName]) return;
    const previousUrl = activeBlobUrl;
    activeBlobUrl = URL.createObjectURL(new Blob([unlockedBundle.pages[pageName].html], {type: 'text/html'}));
    try {
      frame.contentWindow.location.replace(activeBlobUrl);
    } catch {
      frame.src = activeBlobUrl;
    }
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    if (addHistory && pageName !== activePage) history.pushState({vaultPage: pageName}, '');
    activePage = pageName;
    updateBackupNote();
  }

  function lockVault() {
    unlockedBundle = null;
    activePage = null;
    try {
      frame.contentWindow.location.replace('about:blank');
    } catch {}
    if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
    viewer.hidden = true;
    loginPanel.hidden = false;
  }

  function updateBackupNote() {
    if (!unlockedBundle?.pages?.data) {
      backupNote.hidden = true;
      return;
    }
    let savedAt = NaN;
    try {
      savedAt = Date.parse(localStorage.getItem(`${unlockedBundle.id}-last-backup-v1`));
    } catch {}
    const days = Number.isFinite(savedAt) ? Math.max(0, Math.floor((Date.now() - savedAt) / 86400000)) : null;
    const overdue = days === null || days >= BACKUP_REMINDER_DAYS;
    backupNote.textContent = days === null ? 'No backup yet · Back up now'
      : overdue ? `Last backup ${days} days ago · Back up now`
      : days === 0 ? 'Backed up today'
      : days === 1 ? 'Backed up yesterday'
      : `Backed up ${days} days ago`;
    backupNote.classList.toggle('overdue', overdue);
    backupNote.hidden = false;
  }

  // Asks the browser not to clear this site's saved character data under storage pressure.
  async function requestPersistentStorage() {
    try {
      if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
    } catch {}
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
      const entry = unlockedBundle.entry || 'tracker';
      history.replaceState({vaultPage: entry}, '');
      showPage(entry);
      requestPersistentStorage();
    } catch (error) {
      status.textContent = error instanceof VaultError ? error.message : MESSAGES.credentials;
    } finally {
      loginButton.disabled = false;
      document.getElementById('password').value = '';
    }
  });

  lockButton.addEventListener('click', () => {
    if (!confirm('Lock the vault? You’ll need your password to open it again.')) return;
    lockVault();
    history.replaceState(null, '');
    document.getElementById('password').focus();
  });
  backupNote.addEventListener('click', () => showPage('data', {addHistory: true}));

  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'vault:navigate') showPage(event.data.page, {addHistory: true});
  });
  window.addEventListener('popstate', event => {
    if (unlockedBundle && event.state?.vaultPage) showPage(event.state.vaultPage);
  });
  // The Data page records each backup; refresh the reminder when it does.
  window.addEventListener('storage', event => {
    if (event.key?.endsWith('-last-backup-v1')) updateBackupNote();
  });
  // Leaving the page drops the decrypted character from memory; a page restored from the
  // back/forward cache therefore comes back locked rather than half-unlocked.
  window.addEventListener('pagehide', lockVault);
})();
