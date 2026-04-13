import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'services/bookmark_service.dart';
import 'services/local_scramjet_service.dart';
import 'services/settings_service.dart';
import 'theme/app_theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final settings = SettingsService();
  final bookmarks = BookmarkService();
  final localScramjet = LocalScramjetService.instance;
  await Future.wait([settings.init(), bookmarks.init()]);
  await localScramjet.startIfDesktop();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(
          create: (_) => ThemeNotifier(),
        ),
        ChangeNotifierProvider<SettingsService>.value(value: settings),
        ChangeNotifierProvider<BookmarkService>.value(value: bookmarks),
      ],
      child: const JetVeilApp(),
    ),
  );
}
