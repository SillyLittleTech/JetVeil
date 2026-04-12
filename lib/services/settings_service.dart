import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/proxy_settings.dart';

/// Persists and exposes user preferences via [SharedPreferences].
///
/// Call [init] once at startup before the app is rendered.
class SettingsService extends ChangeNotifier {
  static const _keyProxy = 'proxy_settings';
  static const _keyThemeMode = 'theme_mode';
  static const _keyAccentColor = 'accent_color';

  late SharedPreferences _prefs;

  ProxySettings _proxy = ProxySettings.empty;
  ThemeMode _themeMode = ThemeMode.dark;
  Color _accentColor = const Color(0xFF00E5FF);

  ProxySettings get proxy => _proxy;
  ThemeMode get themeMode => _themeMode;
  Color get accentColor => _accentColor;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _loadProxy();
    _loadTheme();
    _loadAccent();
  }

  // ─── Proxy settings ─────────────────────────────────────────────────────────

  void _loadProxy() {
    final raw = _prefs.getString(_keyProxy);
    if (raw != null) {
      try {
        _proxy = ProxySettings.fromJson(
            json.decode(raw) as Map<String, dynamic>);
      } catch (_) {
        _proxy = ProxySettings.empty;
      }
    }
  }

  Future<void> saveProxy(ProxySettings settings) async {
    _proxy = settings;
    await _prefs.setString(_keyProxy, json.encode(settings.toJson()));
    notifyListeners();
  }

  // ─── Theme ───────────────────────────────────────────────────────────────────

  void _loadTheme() {
    final stored = _prefs.getString(_keyThemeMode);
    _themeMode = switch (stored) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark,
    };
  }

  Future<void> saveThemeMode(ThemeMode mode) async {
    _themeMode = mode;
    final label = switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.system => 'system',
      _ => 'dark',
    };
    await _prefs.setString(_keyThemeMode, label);
    notifyListeners();
  }

  // ─── Accent colour ───────────────────────────────────────────────────────────

  void _loadAccent() {
    final stored = _prefs.getInt(_keyAccentColor);
    if (stored != null) _accentColor = Color(stored);
  }

  Future<void> saveAccentColor(Color color) async {
    _accentColor = color;
    await _prefs.setInt(_keyAccentColor, color.value);
    notifyListeners();
  }
}
