import 'package:flutter/material.dart';

/// Controls the current [ThemeMode] and accent colour for the app.
class ThemeNotifier extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.dark;
  Color _accentColor = const Color(0xFF00E5FF); // default: jet cyan

  ThemeMode get themeMode => _themeMode;
  Color get accentColor => _accentColor;

  void setThemeMode(ThemeMode mode) {
    if (_themeMode == mode) return;
    _themeMode = mode;
    notifyListeners();
  }

  void setAccentColor(Color color) {
    if (_accentColor.value == color.value) return;
    _accentColor = color;
    notifyListeners();
  }

  void toggle() {
    _themeMode =
        _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }
}

/// JetVeil design system.
///
/// Dark-first palette inspired by the CookieCut design language used in
/// SillyLittleTech projects. Uses deep dark backgrounds with an electric
/// cyan accent to evoke speed (jet) and stealth (veil).
abstract class AppTheme {
  // ─── Preset accent colours ──────────────────────────────────────────────────
  static const Map<String, Color> accentPresets = {
    'Jet Cyan': Color(0xFF00E5FF),
    'Neon Violet': Color(0xFFAB47BC),
    'Emerald': Color(0xFF00E676),
    'Solar Orange': Color(0xFFFF6D00),
    'Rose Red': Color(0xFFFF1744),
    'Sky Blue': Color(0xFF40C4FF),
  };

  static const Color _errorColor = Color(0xFFFF3D00);
  static const Color _successColor = Color(0xFF00E676);

  // ─── Dark (default) theme ────────────────────────────────────────────────────
  static ThemeData darkTheme(Color seed) {
    final cs = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.dark,
      // Override surface colours for a deeper dark aesthetic
      surface: const Color(0xFF0D0D17),
    ).copyWith(
      surface: const Color(0xFF0D0D17),
      surfaceContainerLowest: const Color(0xFF08080F),
      surfaceContainer: const Color(0xFF141420),
      surfaceContainerHighest: const Color(0xFF1E1E2E),
      error: _errorColor,
    );
    return _buildTheme(cs);
  }

  // ─── Light theme ─────────────────────────────────────────────────────────────
  static ThemeData lightTheme(Color seed) {
    final cs = ColorScheme.fromSeed(
      seedColor: seed,
      brightness: Brightness.light,
    ).copyWith(error: _errorColor);
    return _buildTheme(cs);
  }

  // ─── Semantic helpers ────────────────────────────────────────────────────────
  static Color successColor(BuildContext context) => _successColor;
  static Color errorColor(BuildContext context) =>
      Theme.of(context).colorScheme.error;

  // ─── Shared builder ──────────────────────────────────────────────────────────
  static ThemeData _buildTheme(ColorScheme cs) {
    return ThemeData(
      useMaterial3: true,
      colorScheme: cs,
      // ── Typography ────────────────────────────────────────────────────────────
      textTheme: const TextTheme(
        displaySmall: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.5),
        headlineMedium: TextStyle(fontWeight: FontWeight.w600),
        titleLarge: TextStyle(fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(height: 1.5),
        bodyMedium: TextStyle(height: 1.5),
      ),
      // ── AppBar ────────────────────────────────────────────────────────────────
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: cs.surface,
        foregroundColor: cs.onSurface,
        elevation: 0,
        scrolledUnderElevation: 1,
        titleTextStyle: TextStyle(
          color: cs.onSurface,
          fontSize: 20,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
      ),
      // ── Cards ─────────────────────────────────────────────────────────────────
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: cs.outlineVariant, width: 1),
        ),
        margin: EdgeInsets.zero,
        color: cs.surfaceContainer,
      ),
      // ── Input fields ──────────────────────────────────────────────────────────
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: cs.surfaceContainerHighest.withAlpha(80),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.outlineVariant),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: cs.error),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      // ── Buttons ───────────────────────────────────────────────────────────────
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle:
              const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle:
              const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        ),
      ),
      // ── Chips ─────────────────────────────────────────────────────────────────
      chipTheme: ChipThemeData(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      // ── Divider ───────────────────────────────────────────────────────────────
      dividerTheme: DividerThemeData(color: cs.outlineVariant, space: 1),
      // ── Navigation bar ────────────────────────────────────────────────────────
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: cs.surface,
        indicatorColor: cs.primaryContainer,
        labelTextStyle: WidgetStateProperty.all(
          const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        ),
      ),
      // ── Snack bar ─────────────────────────────────────────────────────────────
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
