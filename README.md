# JetVeil

ACProx-style browser proxy rebuilt in this repository with a PasCurtain-inspired UI.

## What is in this repo

- `server/`: Ultraviolet + bare-server proxy backend and web UI.
- `wrapper_app/`: Flutter web wrapper that embeds the deployed proxy URL.

## Vercel-first deployment (main web app)

The main app is the `server/` folder and is set up to deploy directly on Vercel.

### One-click deploy

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/SillyLittleTech/JetVeil&root-directory=server)

### Manual Vercel settings

- Root directory: `server`
- Build command: none
- Install command: `npm install`
- Output directory: leave empty

`server/vercel.json` is included, so Vercel routes all requests to `index.js` automatically.

## Local development

```bash
cd server
npm install
npm run dev
```

Open <http://localhost:8080>.

## UI notes

The proxy UI is in:

- `server/public/index.html`
- `server/public/css/app.css`
- `server/public/js/app.js`

It provides browser-like controls (back, forward, reload, home, address/search bar) and uses Ultraviolet routing under `/service/`.

## Flutter web wrapper app

The wrapper app is in `wrapper_app/` and loads your deployed proxy URL in an iframe.

Quick start:

```bash
cd wrapper_app
flutter create . --platforms=web
flutter pub get
flutter run -d chrome --dart-define=PROXY_URL=https://YOUR-PROXY.vercel.app
```

Build:

```bash
flutter build web --dart-define=PROXY_URL=https://YOUR-PROXY.vercel.app
```

## License

[BSD 3-Clause](LICENSE) © SillyLittleTech
