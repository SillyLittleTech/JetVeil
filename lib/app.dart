import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/bookmarks_screen.dart';
import 'theme/app_theme.dart';

class JetVeilApp extends StatelessWidget {
  const JetVeilApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeNotifier = context.watch<ThemeNotifier>();

    return MaterialApp(
      title: 'JetVeil',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme(themeNotifier.accentColor),
      darkTheme: AppTheme.darkTheme(themeNotifier.accentColor),
      themeMode: themeNotifier.themeMode,
      initialRoute: '/',
      routes: {
        '/': (_) => const HomeScreen(),
        '/settings': (_) => const SettingsScreen(),
        '/bookmarks': (_) => const BookmarksScreen(),
      },
    );
  }
}
