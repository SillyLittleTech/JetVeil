# JetVeil Wrapper App

Flutter web wrapper that embeds the JetVeil proxy frontend in an iframe.

## Create full Flutter scaffolding (one-time)

From this directory:

```bash
flutter create . --platforms=web
```

Keep existing `lib/main.dart` when prompted.

## Run locally

```bash
flutter run -d chrome --dart-define=PROXY_URL=http://localhost:8080
```

## Build for web

```bash
flutter build web --dart-define=PROXY_URL=https://YOUR-PROXY.vercel.app
```
