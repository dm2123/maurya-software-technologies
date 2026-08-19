# Architecture

## Website

Static files only. GitHub Pages hosts `website/`. There is no application server in v1.0.0.

Future backend hook: the contact form already validates `name`, `email`, `subject`, and `message`. A later service can accept the same JSON/form fields. No secrets are stored in the site.

## Desktop

Single Electron codebase in `desktop/` used for Windows, Linux, and macOS.

```
Renderer (HTML/CSS/JS)
    ↑ contextBridge
preload.js
    ↑ IPC invoke("system:info")
main.js (Node, Electron APIs)
```

The renderer cannot require Node modules.

## CI/CD

- `deploy-website.yml` — publish `website/` to GitHub Pages on `main`
- `build-releases.yml` — on `v*` tags, make installers and publish a GitHub Release using `GITHUB_TOKEN` (no extra secrets)

## Versioning

Displayed as **1.0.0** on the website and in Maurya Desktop. Bump both when you cut a release.
