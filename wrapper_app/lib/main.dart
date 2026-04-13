import "dart:ui_web" as ui_web;
import "package:flutter/material.dart";
import "package:web/web.dart" as web;

const _defaultProxyUrl = "http://localhost:8080";
const _proxyUrl = String.fromEnvironment(
  "PROXY_URL",
  defaultValue: _defaultProxyUrl,
);

void main() {
  runApp(const JetVeilWrapperApp());
}

class JetVeilWrapperApp extends StatefulWidget {
  const JetVeilWrapperApp({super.key});

  @override
  State<JetVeilWrapperApp> createState() => _JetVeilWrapperAppState();
}

class _JetVeilWrapperAppState extends State<JetVeilWrapperApp> {
  static bool _factoryRegistered = false;
  final String _viewType = "jetveil-proxy-frame";

  @override
  void initState() {
    super.initState();
    if (!_factoryRegistered) {
      ui_web.platformViewRegistry.registerViewFactory(_viewType, (int id) {
        final iframe = web.HTMLIFrameElement()
          ..src = _proxyUrl
          ..style.border = "0"
          ..style.width = "100%"
          ..style.height = "100%"
          ..setAttribute("allow", "clipboard-read; clipboard-write");

        return iframe;
      });
      _factoryRegistered = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: "JetVeil Wrapper",
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00BCD4)),
        useMaterial3: true,
      ),
      home: const _WrapperScreen(),
    );
  }
}

class _WrapperScreen extends StatelessWidget {
  const _WrapperScreen();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: Text(
                "JetVeil Wrapper -> $_proxyUrl",
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context)
                    .textTheme
                    .bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            const Expanded(
              child: HtmlElementView(viewType: "jetveil-proxy-frame"),
            ),
          ],
        ),
      ),
    );
  }
}
