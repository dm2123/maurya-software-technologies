# Installation

## Website

No build step. Open `website/index.html` in a browser, or serve the folder:

```bash
npx --yes serve website
```

GitHub Pages deploys the `website/` directory via Actions.

## Desktop (Maurya Desktop 1.0.1)

Requires Node.js 20+ and npm.

```bash
cd desktop
npm install
npm start
```

### Platform notes

- **Windows:** `npm run make` produces a Squirrel installer named `Maurya-Desktop-Setup.exe` when that maker succeeds.
- **Linux:** `npm run make` can produce AppImage, DEB, and RPM. RPM needs `rpm` tooling installed.
- **macOS:** `npm run make` produces a DMG. It is unsigned unless you configure Apple signing later.

Do not download fake binaries from this repo. Use GitHub Releases after a tag build.
