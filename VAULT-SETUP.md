# Saltmarsh character vault

The publishable site consists of `index.html`, `vault.css`, `vault.js`, the login logo
`tidewick-compass-home.png`, the icon credits in `ATTRIBUTION.txt`, and the encrypted JSON files
under `vault/`. The character pages, icons and recovery material under `private-src/` are excluded
by `.gitignore`.

## Security model

- Character bundles use AES-256-GCM with a random key per character.
- User passwords derive AES wrapping keys using PBKDF2-HMAC-SHA-256 with 600,000
  iterations and a random salt.
- Each user record unlocks one character key.
- The browser retains decrypted content only in memory until the player leaves or closes the page.
- GitHub Pages receives ciphertext, not plaintext character HTML.

Because the encrypted files are public, attackers can attempt password guesses offline.
Use a unique passphrase of at least five random words. This design is appropriate for
private game material, not high-value regulated data.

## Folder layout

- `private-src/<id>/` — one folder per character (`tidewick`, `hestia`, `azrael`, `kenpachi`, `miku`):
  its pages (`<id>-main.html`, `<id>-spells.html` and/or `<id>-attack.html`, `<id>-journal.html`,
  `<id>-inventory.html`, `<id>-data.html`), its theme (`<id>-theme.css`) and any images only it
  uses (`assets/`).
- `private-src/shared/` — the shared stylesheets and scripts, and `icons/`, the icon set every
  character uses.
- `private-src/source-art/` — full-size originals of the icons (`icons/`), each character's images
  (`<id>/`) and the login logo.
- `private-src/admin/` — encrypted recovery keys. Never publish, rename or move these.
- `tools/` — the vault tool and validators.
- `Update <Name> Vault.cmd` — rebuilds one character's encrypted file.

## First-time setup

Use the bundled Node executable or any current Node.js installation:

```powershell
$node = "C:\Users\david\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

& $node tools\vault-admin.mjs init-character `
  --id tidewick `
  --title "Tidewick Grayholt" `
  --tracker "private-src\tidewick\tidewick-main.html" `
  --spellbook "private-src\tidewick\tidewick-spells.html" `
  --inventory "private-src\tidewick\tidewick-inventory.html" `
  --data "private-src\tidewick\tidewick-data.html" `
  --journal "private-src\tidewick\tidewick-journal.html"

& $node tools\vault-admin.mjs add-user `
  --character tidewick `
  --username david
```

The tool prompts for an administrator recovery passphrase and the user's password
without echoing them or writing them to disk. `--title` (the character's full name) is required.

## Adding another character

Create `private-src/<id>/` with that character's pages and theme, following the layout above, run
`init-character` with the new ID, then run `add-user`. Copy one of the `Update <Name> Vault.cmd`
files for the new character.

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

## Updating a character's pages

After editing a character's private pages, double-click that character's
`Update <Name> Vault.cmd` (for example `Update Tidewick Vault.cmd`). Enter the administrator
recovery passphrase when prompted. This rebuilds the encrypted character file while preserving
all existing usernames and passwords.

## Names that must never change

Some names still say "tidewick" or an old level. Players never see them, and changing them would
break things, so they stay as they are:

- **Saved-data keys** in each page's `window.PAGE`, for example `tidewick-tracker-level-3-storm-ui-v1`,
  `hestia-journal-level-4-v1` and the shared Group inventory key `tidewick-group-inventory-level-4-v1`.
  The level numbers record when each key was created, not the character's level. A new key would
  make that player's saved progress look empty. `tools/validate-pages.mjs` pins every key.
- **The `tidewick-vault:` labels** in `tools/vault-admin.mjs` and `vault.js`. They are part of the
  encryption; changing one locks every player out.
- **Backup app names** on each Data page (for example "Tidewick Tracker"). Older backup files only
  import when the name matches.
- **Character ids** (`tidewick`, `hestia`, …). They name the encrypted files, recovery keys and logins.

## Images and shared styles

- Every image is embedded into each page of the encrypted bundle, so keep icons small. Icons
  display at 23-42 CSS px; they are stored at 128 px (the login logo at 336 px). Full-size
  originals are kept in `private-src/source-art/`. Resize any new artwork the same way.
- Shared icons live in `private-src/shared/icons/`; pages reference them as `../shared/icons/…`.
  Their licence credits are in the published `ATTRIBUTION.txt`; add any new third-party icon there.
- Every character page links `private-src/shared/base.css` (shared layout) and its own theme file
  (for example `private-src/hestia/hestia-theme.css`), which sets that character's colours and adds
  its unique rules. Keep colours in the theme files so the characters stay distinct.
- Page behaviour comes from shared scripts in `private-src/shared/` (`tracker.js`, `journal.js`,
  `inventory.js`, `attack.js`, `data.js`, `spellbook.js`, all after `app.js`). Each page sets
  `window.PAGE` with its own storage keys and rest rules first; the comment at the top of each script
  lists the settings it needs.
- The vault tool inlines every local stylesheet, script and image into the encrypted bundle.
- After editing any page, run `node tools/validate-pages.mjs`. It checks all five characters,
  including that each page still uses the same saved-data keys (a changed key would hide a
  player's saved progress).
- `validate-character` fails if a page still links a stylesheet that was not inlined or loads an
  outside script, so the vault never depends on another website.

## Publishing

Commit only files permitted by `.gitignore`. Before publishing, confirm that no plaintext HTML or
`private-src/` files are staged, and remove from the repository any published file that no longer
exists in the project.
