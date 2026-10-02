# Tidewick encrypted vault

The publishable site consists of `index.html`, `vault.css`, `vault.js`, public image
assets, and the encrypted JSON files under `vault/`. The character pages and recovery
material under `private-src/` are excluded by `.gitignore`.

## Security model

- Character bundles use AES-256-GCM with a random key per character.
- User passwords derive AES wrapping keys using PBKDF2-HMAC-SHA-256 with 600,000
  iterations and a random salt.
- Each user record unlocks one character key.
- The browser retains decrypted content only in memory until the player taps Lock (in the bar under
  the character page) or leaves the page.
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
  --inventory "private-src\Tidewick Inventory Level 4.html" `
  --data "private-src\Tidewick Data Level 4.html" `
  --journal "private-src\Tidewick Journal Level 4.html"

& $node tools\vault-admin.mjs add-user `
  --character tidewick `
  --username david
```

The tool prompts for an administrator recovery passphrase and the user's password
without echoing them or writing them to disk.

## Adding another character

Place that character's plaintext Tracker, Spellbook, Inventory, Data, Journal, and compass image in a private
source folder, run `init-character` with a new ID, then run `add-user`.

Kenpachi uses an Attack page rather than a Spellbook. His first encrypted bundle can be created with:

```powershell
& $node tools\vault-admin.mjs init-character `
  --id kenpachi `
  --title "Kenpachi" `
  --tracker "private-src\kenpachi\kenpachi-main.html" `
  --attack "private-src\kenpachi\kenpachi-attack.html" `
  --inventory "private-src\kenpachi\kenpachi-inventory.html" `
  --data "private-src\kenpachi\kenpachi-data.html" `
  --journal "private-src\kenpachi\kenpachi-journal.html"

& $node tools\vault-admin.mjs add-user `
  --character kenpachi `
  --username david
```

After that first setup, use `Update Kenpachi Vault.cmd` whenever his private pages change.

## Publishing

Initialize a Git repository and commit only files permitted by `.gitignore`. Before
publishing, confirm that no plaintext HTML or `private-src/` files are staged.
# Updating Tidewick's pages

After editing any private character page, double-click `Update Tidewick Vault.cmd`.
Enter the administrator recovery passphrase when prompted. This rebuilds the
encrypted character file while preserving all existing usernames and passwords.

# Images and shared styles

- Every image is embedded into each page of the encrypted bundle, so keep icons small. Icons
  display at 23-42 CSS px; they are stored at 128 px (the login logo at 336 px). Full-size
  originals are kept in `private-src/source-art/`. Resize any new artwork the same way.
- Tidewick's pages use `private-src/tidewick-vendor.css`, a pinned local copy of the daisyUI and
  Tailwind styles they once downloaded from a CDN. It contains only the classes the pages use, so a
  newly added daisyUI or Tailwind class will not be styled until that file is regenerated.
- `validate-character` fails if a page still links a stylesheet that was not inlined or loads an
  outside script, so the vault never depends on another website.

# Backup reminder

Each Data page records when the player last exported a backup (`<character>-last-backup-v1` in
browser storage). The bar under the character page shows that date and turns gold after 14 days
or when no backup exists; tapping it opens the Data page.
