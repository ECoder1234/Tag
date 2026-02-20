# Tag Infinity

Shared codebase for two game variants:

- `infinity`: Tag Infinity (powerups + skins enabled)
- `classic`: Multiplayer Quick Tag style (same core gameplay, different visuals)

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

## Pre-Publish

Run this before announcing a release:

```bash
npm run prepare-production
npm run sync-variants
```

Then verify:

1. `dist/index.html` exists and loads.
2. `dist/runtime-config.json` has the expected title/theme.
3. `fetch ga,e/multiplayer-quick-tag-files` opens locally on port 8080.
4. GitHub Actions Pages workflow for `main` is green.
