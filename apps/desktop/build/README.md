# macOS app icon assets

- `icon-source.png` — 1024×1024 master (replace to rebrand)
- `icon.png` — same master, used for dev Dock icon
- `icon.icns` — built for electron-builder (`mac.icon`)

Regenerate after changing the artwork:

```bash
pnpm --filter @oppvera/watch-desktop icon:mac
# or pass a PNG/JPEG path:
node apps/desktop/scripts/build-mac-icon.mjs /path/to/logo.png
```

The packaged `.dmg` picks up `icon.icns` via `stage-mac.mjs` copying this folder into the build staging dir.
