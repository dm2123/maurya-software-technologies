# Release

Version scheme: `1.0.0` → `1.0.1` / `1.1.0` / `2.0.0`. Keep `desktop/package.json` and `website/assets/app.js` (`VERSION`) in sync.

## Process

1. Make changes
2. Commit
3. Push `main`
4. Create tag:

```bash
git tag v1.0.0
```

5. Push tag:

```bash
git push origin v1.0.0
```

6. GitHub Actions (`.github/workflows/build-releases.yml`) builds:
   - Windows (`windows-latest`)
   - Linux (`ubuntu-latest`)
   - macOS (`macos-latest`)
7. A GitHub Release is created and generated installers are attached
8. Website download links use:

```
https://github.com/<GITHUB_REPOSITORY>/releases/latest/download/<asset>
```

Expected asset names:

- `Maurya-Desktop-Setup.exe`
- `Maurya-Desktop.AppImage`
- `Maurya-Desktop.deb`
- `Maurya-Desktop.rpm`
- `Maurya-Desktop.dmg`

## Before the first tag

Set `GITHUB_REPOSITORY` in `website/assets/app.js`. Until that placeholder is replaced, download buttons stay disabled so they never point at a made-up username.

macOS artifacts are not notarized in this workflow.
