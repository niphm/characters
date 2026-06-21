# Tidewick encrypted vault

The publishable site consists of `index.html`, `vault.css`, `vault.js`, public image
assets, and the encrypted JSON files under `vault/`. The character pages and recovery
material under `private-src/` are excluded by `.gitignore`.

## Security model

- Character bundles use AES-256-GCM with a random key per character.
- User passwords derive AES wrapping keys using PBKDF2-HMAC-SHA-256 with 600,000
  iterations and a random salt.
- Each user record unlocks one character key.
- The browser retains decrypted content only in memory until logout or page closure.
- GitHub Pages receives ciphertext, not plaintext character HTML.

Because the encrypted files are public, attackers can attempt password guesses offline.
Use a unique passphrase of at least five random words. This design is appropriate for
private game material, not high-value regulated data.

## First-time setup

Use the bundled Node executable or any current Node.js installation:

```powershell
$node = "C:\Users\david\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

& $node tools\vault-admin.mjs init-character `
  --id tidewick `
  --title "Tidewick Greyholt" `
  --tracker "private-src\tidewick-greyholt-level-4.html" `
  --spellbook "private-src\Tidewick Spells Level 4.html" `
  --inventory "private-src\Tidewick Inventory Level 4.html"

& $node tools\vault-admin.mjs add-user `
  --character tidewick `
  --username david
```

The tool prompts for an administrator recovery passphrase and the user's password
without echoing them or writing them to disk.

## Adding another character

Place that character's plaintext Tracker, Spellbook, Inventory, and compass image in a private
source folder, run `init-character` with a new ID, then run `add-user`.

## Publishing

Initialize a Git repository and commit only files permitted by `.gitignore`. Before
publishing, confirm that no plaintext HTML or `private-src/` files are staged.
# Updating Tidewick's pages

After editing any private character page, double-click `Update Tidewick Vault.cmd`.
Enter the administrator recovery passphrase when prompted. This rebuilds the
encrypted character file while preserving all existing usernames and passwords.
