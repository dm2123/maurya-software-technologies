# Development

## Layout

```
maurya-software-technologies/
  website/     static site
  desktop/     Electron app (shared Windows / Linux / macOS codebase)
  docs/        documentation
  .github/     GitHub Actions
```

## Website

Edit HTML/CSS/JS under `website/`. Shared behavior lives in `website/assets/app.js`.

Configuration you must replace before public downloads work:

```js
GITHUB_REPOSITORY: "dm2123/maurya-software-technologies"
```

Also update canonical URLs in page `<head>` tags and `website/sitemap.xml` / `website/robots.txt` if you use GitHub Pages.

## Desktop

```bash
cd desktop
npm install
npm start
```

Security defaults in `src/main.js`:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- IPC only through `src/preload.js`

Theme preference key: `mst-theme` (`system` | `dark` | `light`).

## Commands

| Command | Where | Purpose |
| --- | --- | --- |
| `npm start` | `desktop/` | Run Electron |
| `npm run make` | `desktop/` | Package installers for the current OS |
| Open `website/index.html` | browser | Preview site |
