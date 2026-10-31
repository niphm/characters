# Project working rules

- Make page updates in `private-src/<character>/`; shared styles, scripts and icons live in `private-src/shared/`.
- Do not encrypt source pages into the vault unless the user explicitly asks.
- Do not upload or push changes to GitHub unless the user explicitly asks.
- For each requested GitHub upload, create a new branch from `main` named `<YYYY-MM-DD_X>`, where `X` is the sequence number of that day's uploads.
- Treat every GitHub vault deployment as a complete publishable snapshot. Copy and validate every current file under `vault/characters/` and `vault/users/`; never publish only the character changed in the current conversation.
- Before pushing a vault deployment, run `tools/validate-vault-snapshot.mjs` and confirm the branch includes all expected character and login records.
- Never rename saved-data keys, `tidewick-vault:` encryption labels, backup app names or character ids, even where they mention "tidewick" or an old level. See "Names that must never change" in `VAULT-SETUP.md`.
