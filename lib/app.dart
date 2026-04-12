import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/bookmarks_screen.dart';
import 'services/settings_service.dart';
import 'theme/app_theme.dart';

class JetVeilApp extends StatelessWidget {
  const JetVeilApp({super.key});

  @override
  Widget build(BuildContext context) {
    // Mirror persisted theme/accent into the ThemeNotifier on first build.
    final settings = context.watch<SettingsService>();
    final themeNotifier = context.read<ThemeNotifier>();
    themeNotifier.setThemeMode(settings.themeMode);
    themeNotifier.setAccentColor(settings.accentColor);

    final theme = context.watch<ThemeNotifier>();

    return MaterialApp(
      title: 'JetVeil',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme(theme.accentColor),
      darkTheme: AppTheme.darkTheme(theme.accentColor),
      themeMode: theme.themeMode,
      initialRoute: '/',
      routes: {
        '/': (_) => const HomeScreen(),
        '/settings': (_) => const SettingsScreen(),
        '/bookmarks': (_) => const BookmarksScreen(),
      },
    );
  }
}
