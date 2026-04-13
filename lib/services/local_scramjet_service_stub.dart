import '../models/proxy_settings.dart';

/// No-op implementation for non-IO targets (e.g. Flutter web).
class LocalScramjetService {
  LocalScramjetService._();

  static final LocalScramjetService instance = LocalScramjetService._();

  Future<void> startIfDesktop() async {}

  Future<void> stop() async {}

  ProxySettings applyDesktopDefaults(ProxySettings settings) => settings;
}
