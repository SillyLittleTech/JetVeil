# JetVeil

> Deep proxy browser powered by the [Scramjet](https://github.com/MercuryWorkshop/scramjet) engine — successor to [ACprox](https://github.com/SillyLittleTech/acprox).

[![Web App](https://img.shields.io/badge/Web_App-jetveil.sillylittle.tech-00E5FF?style=flat-square)](https://jetveil.sillylittle.tech)
[![License](https://img.shields.io/github/license/SillyLittleTech/JetVeil?style=flat-square)](LICENSE)

---

## Architecture

| Layer | Technology | Hosting |
|-------|-----------|---------|
| **Desktop app** (Win / macOS / Linux) | Flutter | GitHub Releases (built by CI) |
| **Web app / PWA** | Flutter web | Cloudflare Pages → `jetveil.sillylittle.tech` (build configured in CF dashboard) |
| **GitHub Pages redirect** | Static HTML in `docs/` | `sillylittletech.github.io/JetVeil` → `jetveil.sillylittle.tech` |
| **CF Pages fallback** | `_redirects` at repo root | Any CF Pages project pointing at this repo → `jetveil.sillylittle.tech` |
| **Proxy backend** | Node.js + Scramjet + bare-server | Vercel (free tier, `server/` directory) |

---

## Getting Started

### 1 — Deploy the Scramjet backend to Vercel

The proxy backend lives in `server/`. Deploy it to Vercel's free tier in ~2 minutes:

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SillyLittleTech/JetVeil&root-directory=server)

Vercel gives you a URL like `https://my-jetveil.vercel.app`. Copy it.

### 2 — Configure JetVeil

Open the app → **Settings** → paste your Vercel server URL → **Save**.

### 3 — Browse

Type any URL in the address bar. JetVeil routes it through your Scramjet server.

---

## Web App

Hosted on **Cloudflare Pages** at **[jetveil.sillylittle.tech](https://jetveil.sillylittle.tech)**.  
Build is configured in the Cloudflare Pages dashboard — no CI step required.

The old GitHub Pages URL (`sillylittletech.github.io/JetVeil`) permanently redirects there via `docs/index.html`.

### Cloudflare Pages — one-time dashboard setup

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build output directory | `build/web` |
| Root directory | _(repo root)_ |

Use this as the build command (CF Pages runs on Ubuntu — Flutter must be bootstrapped):

```bash
git clone https://github.com/flutter/flutter.git -b stable --depth 1 $HOME/flutter
export PATH="$PATH:$HOME/flutter/bin"
flutter pub get && flutter build web --release --base-href "/"
```

---

## Desktop Apps

Download the latest build from [Releases](../../releases/latest).

| Platform | Instructions |
|----------|-------------|
| 🐧 Linux | Extract `.tar.gz`, run `jet_veil` |
| 🪟 Windows | Extract `.zip`, run `jet_veil.exe` |
| 🍎 macOS | Extract `.zip`, open `JetVeil.app` |

---

## CI / CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| **Pre-Release** | PR marked ready-for-review | Builds Linux + Windows + macOS → creates pre-release. Posts a PR comment instead of building if the version tag already exists. |
| **Build & Release** | Push to `main` touching `lib/`, `web/`, `pubspec.yaml`, or `analysis_options.yaml` | Builds Linux + Windows + macOS → creates full GitHub Release |

> **Web builds are not part of CI.** Cloudflare Pages watches the repo and rebuilds automatically on every push to `main`.

Version numbers come from `version:` in `pubspec.yaml` (`major.minor.patch+build`).

---

## One-time Setup (repo owner)

### GitHub Pages redirect

1. **Settings → Pages → Source**: Deploy from a branch
2. Branch: `main` / Folder: `/docs`
3. Save → `sillylittletech.github.io/JetVeil` will now redirect to `jetveil.sillylittle.tech`

---

## Local Development

```bash
# Flutter app
flutter pub get
flutter run -d chrome        # web
flutter run -d linux         # desktop (Linux)
flutter run -d macos         # desktop (macOS)
flutter run -d windows       # desktop (Windows)

# Scramjet server
cd server
npm install
npm start                    # http://localhost:8080
```

---

## Contributing

1. Fork and create a feature branch from `main`
2. Make your changes
3. Mark your PR as **Ready for Review** → triggers an automated pre-release build
4. Merge to `main` → triggers a full desktop release build; CF Pages auto-deploys the web update

---

## License

[AGPL-3.0](LICENSE) © SillyLittleTech
