# Maurya Software Technologies

Company website, product catalog, download center, and **Maurya Desktop** — a real Electron application for Windows, Linux, and macOS.

**Founder:** Dinesh Maurya
**Version:** 1.0.1
**License:** MIT

This repository is meant to be pushed to GitHub as-is. It does not include fake installers, fake customers, or fake download counts.

## Features

- Static company website (`website/`) with dark/light theme and mobile navigation
- Download center that points at GitHub Releases after you set `GITHUB_REPOSITORY`
- Electron desktop app with dashboard, system information, settings, and About
- GitHub Actions: GitHub Pages deploy + tagged cross-platform builds
- Documentation for install, development, architecture, and release

## Technology

| Area | Stack |
| --- | --- |
| Website | HTML5, CSS3, JavaScript |
| Desktop | Electron, Electron Forge |
| CI/CD | GitHub Actions |
| Hosting | GitHub Pages |

## Installation

See [docs/INSTALLATION.md](docs/INSTALLATION.md).

Website (local):

```bash
# Open in a browser
website/index.html
```

Desktop:

```bash
cd desktop
npm install
npm start
```

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Build

From `desktop/`:

```bash
npm run make
```

Installers are produced for the OS you run the command on. Full Windows + Linux + macOS packages are built by GitHub Actions on a version tag.

## Deployment

Enable GitHub Pages with **Source: GitHub Actions**. Push `main` to run [`.github/workflows/deploy-website.yml`](.github/workflows/deploy-website.yml).

## Release

See [docs/RELEASE.md](docs/RELEASE.md).

1. `GITHUB_REPOSITORY` is set to `dm2123/maurya-software-technologies` in `website/assets/app.js`
2. Commit and push
3. Tag and push `v1.0.1`
4. Actions builds Windows, Linux, and macOS and attaches assets to the GitHub Release
5. Website download buttons use `/releases/latest/download/...`

## Download

After the first release exists:

- Windows: `Maurya-Desktop-Setup.exe`
- Linux: `Maurya-Desktop.AppImage`, `Maurya-Desktop.deb`, `Maurya-Desktop.rpm`
- macOS: `Maurya-Desktop.dmg`

macOS builds are **not** Apple-signed or notarized unless you add those credentials later.

## License

MIT. See [LICENSE](LICENSE).
