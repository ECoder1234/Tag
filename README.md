# Tag Infinity

Shared codebase for two game variants:

- `infinity`: Tag Infinity (powerups + skins enabled)
- `classic`: Multiplayer Quick Tag style (same core gameplay, different visuals, no powerups/skins)

## Development

```bash
npm ci
npm run dev
```

## Quality Checks

```bash
npm run typecheck
npm test
```

## Build

```bash
npm run build
```

## Sync Both Variants

Build once and update both folders:

- `tag-infinity/dist` (infinity build)
- `../fetch ga,e/multiplayer-quick-tag-files` (classic build)

```bash
npm run sync-variants
```

Runtime config files:

- `public/runtime-config.json` (infinity source config)
- `../fetch ga,e/multiplayer-quick-tag-files/runtime-config.json` (classic config)

## Deploy (GitHub Pages)

Pushing to `main` triggers Pages deploy via `.github/workflows/deploy-pages.yml`.
