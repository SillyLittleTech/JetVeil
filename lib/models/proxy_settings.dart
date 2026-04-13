import 'package:flutter/foundation.dart';

/// Proxy server configuration and user preferences.
class ProxySettings {
  final String serverUrl;
  final String desktopLocalServerUrl;
  final bool preferLocalDesktopServer;
  final bool openInNewTab;
  final bool saveHistory;

  const ProxySettings({
    required this.serverUrl,
    this.desktopLocalServerUrl = 'http://127.0.0.1:8080',
    this.preferLocalDesktopServer = true,
    this.openInNewTab = false,
    this.saveHistory = true,
  });

  static const String defaultDesktopLocalServerUrl = 'http://127.0.0.1:8080';

  bool get _isDesktopPlatform {
    if (kIsWeb) return false;
    return switch (defaultTargetPlatform) {
      TargetPlatform.linux ||
      TargetPlatform.windows ||
      TargetPlatform.macOS =>
        true,
      _ => false,
    };
  }

  /// The backend URL currently used for proxy navigation.
  String get effectiveServerUrl {
    if (_isDesktopPlatform && preferLocalDesktopServer) {
      return desktopLocalServerUrl.trim();
    }
    return serverUrl.trim();
  }

  /// Whether a proxy server has been configured for the current platform.
  bool get isConfigured => effectiveServerUrl.isNotEmpty;

  /// Constructs the full proxy URL for a given target URL.
  ///
  /// The server's frontend reads the `?url=` query param and routes the
  /// navigation through the selected backend on page load.
  String buildProxyUrl(String targetUrl) {
    final base = effectiveServerUrl.trimRight().replaceAll(RegExp(r'/$'), '');
    final encoded = Uri.encodeQueryComponent(targetUrl);
    return '$base/?url=$encoded';
  }

  ProxySettings copyWith({
    String? serverUrl,
    String? desktopLocalServerUrl,
    bool? preferLocalDesktopServer,
    bool? openInNewTab,
    bool? saveHistory,
  }) {
    return ProxySettings(
      serverUrl: serverUrl ?? this.serverUrl,
      desktopLocalServerUrl:
          desktopLocalServerUrl ?? this.desktopLocalServerUrl,
      preferLocalDesktopServer:
          preferLocalDesktopServer ?? this.preferLocalDesktopServer,
      openInNewTab: openInNewTab ?? this.openInNewTab,
      saveHistory: saveHistory ?? this.saveHistory,
    );
  }

  Map<String, dynamic> toJson() => {
        'serverUrl': serverUrl,
        'desktopLocalServerUrl': desktopLocalServerUrl,
        'preferLocalDesktopServer': preferLocalDesktopServer,
        'openInNewTab': openInNewTab,
        'saveHistory': saveHistory,
      };

  factory ProxySettings.fromJson(Map<String, dynamic> json) => ProxySettings(
        serverUrl: (json['serverUrl'] as String?) ?? '',
        desktopLocalServerUrl:
            (json['desktopLocalServerUrl'] as String?) ??
                defaultDesktopLocalServerUrl,
        preferLocalDesktopServer:
            (json['preferLocalDesktopServer'] as bool?) ?? true,
        openInNewTab: (json['openInNewTab'] as bool?) ?? false,
        saveHistory: (json['saveHistory'] as bool?) ?? true,
      );

  factory ProxySettings.defaultForCurrentPlatform() {
    if (!kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.linux ||
            defaultTargetPlatform == TargetPlatform.windows ||
            defaultTargetPlatform == TargetPlatform.macOS)) {
      return const ProxySettings(
        serverUrl: '',
        desktopLocalServerUrl: defaultDesktopLocalServerUrl,
        preferLocalDesktopServer: true,
      );
    }

    return const ProxySettings(serverUrl: '');
  }
}
