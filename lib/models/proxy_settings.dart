/// Proxy server configuration and user preferences.
class ProxySettings {
  final String serverUrl;
  final String scramjetPrefix;
  final bool openInNewTab;
  final bool saveHistory;

  const ProxySettings({
    required this.serverUrl,
    this.scramjetPrefix = '/scram/',
    this.openInNewTab = false,
    this.saveHistory = true,
  });

  /// Whether a proxy server has been configured.
  bool get isConfigured => serverUrl.trim().isNotEmpty;

  /// Constructs the full proxy URL for a given target URL.
  ///
  /// The server's frontend reads the `?url=` query param and routes the
  /// navigation through Scramjet on page load.
  String buildProxyUrl(String targetUrl) {
    final base = serverUrl.trimRight().replaceAll(RegExp(r'/$'), '');
    final encoded = Uri.encodeQueryComponent(targetUrl);
    return '$base/?url=$encoded';
  }

  ProxySettings copyWith({
    String? serverUrl,
    String? scramjetPrefix,
    bool? openInNewTab,
    bool? saveHistory,
  }) {
    return ProxySettings(
      serverUrl: serverUrl ?? this.serverUrl,
      scramjetPrefix: scramjetPrefix ?? this.scramjetPrefix,
      openInNewTab: openInNewTab ?? this.openInNewTab,
      saveHistory: saveHistory ?? this.saveHistory,
    );
  }

  Map<String, dynamic> toJson() => {
        'serverUrl': serverUrl,
        'scramjetPrefix': scramjetPrefix,
        'openInNewTab': openInNewTab,
        'saveHistory': saveHistory,
      };

  factory ProxySettings.fromJson(Map<String, dynamic> json) => ProxySettings(
        serverUrl: (json['serverUrl'] as String?) ?? '',
        scramjetPrefix:
            (json['scramjetPrefix'] as String?) ?? '/scram/',
        openInNewTab: (json['openInNewTab'] as bool?) ?? false,
        saveHistory: (json['saveHistory'] as bool?) ?? true,
      );

  static const ProxySettings empty = ProxySettings(serverUrl: '');
}
