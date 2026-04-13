import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';

import '../models/proxy_settings.dart';

/// Starts a local ScramJet backend for desktop builds.
class LocalScramjetService {
  LocalScramjetService._();

  static final LocalScramjetService instance = LocalScramjetService._();

  Process? _process;
  bool _startAttempted = false;

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

  /// Starts the local backend if this runtime target is desktop.
  Future<void> startIfDesktop({int port = 8080}) async {
    if (!_isDesktopPlatform || _startAttempted) return;
    _startAttempted = true;

    if (await _isPortOpen(port)) {
      return;
    }

    final backendRoot = _resolveBackendRootPath();
    if (backendRoot == null || !Directory(backendRoot).existsSync()) {
      debugPrint('Local ScramJet backend directory not found: $backendRoot');
      return;
    }

    if (!Directory('$backendRoot/node_modules').existsSync()) {
      debugPrint(
          'Desktop ScramJet dependencies missing. Run "npm install" in desktop/scramjet-server.');
      return;
    }

    try {
      _process = await Process.start(
        'node',
        ['src/index.js'],
        environment: {'PORT': '$port'},
        workingDirectory: backendRoot,
        runInShell: true,
      );

      unawaited(_process!.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .forEach((line) => debugPrint('[local-scramjet] $line')));

      unawaited(_process!.stderr
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .forEach((line) => debugPrint('[local-scramjet] $line')));
    } catch (err) {
      debugPrint('Failed to start local ScramJet backend: $err');
      return;
    }

    for (var i = 0; i < 20; i++) {
      if (await _isPortOpen(port)) {
        return;
      }
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }

    debugPrint('Local ScramJet backend did not become ready on port $port.');
  }

  String? _resolveBackendRootPath() {
    final candidates = <String>[
      'desktop/scramjet-server',
    ];

    for (final candidate in candidates) {
      final path = '${Directory.current.path}/$candidate';
      if (Directory(path).existsSync()) {
        return path;
      }
    }
    return null;
  }

  Future<bool> _isPortOpen(int port) async {
    try {
      final socket = await Socket.connect(
        InternetAddress.loopbackIPv4,
        port,
        timeout: const Duration(milliseconds: 300),
      );
      await socket.close();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> stop() async {
    final process = _process;
    if (process == null) return;
    process.kill();
    await process.exitCode;
    _process = null;
  }

  ProxySettings applyDesktopDefaults(ProxySettings settings) {
    if (!_isDesktopPlatform) return settings;
    return settings.copyWith(
      desktopLocalServerUrl: ProxySettings.defaultDesktopLocalServerUrl,
      preferLocalDesktopServer: true,
    );
  }
}
