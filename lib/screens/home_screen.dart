import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bookmark.dart';
import '../services/bookmark_service.dart';
import '../services/settings_service.dart';
import '../widgets/setup_card.dart';
import '../widgets/url_bar.dart';
import '../widgets/bookmark_tile.dart';

/// The main screen of JetVeil.
///
/// Shows a setup prompt when no server is configured, otherwise presents
/// the URL bar and quick-access bookmark grid.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _navIndex = 0;

  Future<void> _navigate(BuildContext context, String rawUrl) async {
    final settings = context.read<SettingsService>();
    if (!settings.proxy.isConfigured) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Configure your JetVeil server in Settings first.'),
        ),
      );
      return;
    }

    String url = rawUrl.trim();
    // Prepend https:// if the user typed a bare hostname
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://$url';
    }

    final proxyUrl = settings.proxy.buildProxyUrl(url);

    final uri = Uri.parse(proxyUrl);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open: $proxyUrl')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = context.watch<SettingsService>();
    final bookmarks = context.watch<BookmarkService>();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Icon(Icons.shield_rounded,
                color: theme.colorScheme.primary, size: 24),
            const SizedBox(width: 10),
            Text(
              'JetVeil',
              style: theme.appBarTheme.titleTextStyle,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bookmark_outline_rounded),
            tooltip: 'Bookmarks',
            onPressed: () => Navigator.pushNamed(context, '/bookmarks'),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            tooltip: 'Settings',
            onPressed: () => Navigator.pushNamed(context, '/settings'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (!settings.proxy.isConfigured) ...[
                    const SetupCard(),
                    const SizedBox(height: 28),
                  ] else ...[
                    UrlBar(onSubmit: (url) => _navigate(context, url)),
                    const SizedBox(height: 28),
                  ],
                  if (bookmarks.bookmarks.isNotEmpty) ...[
                    _SectionHeader(
                      icon: Icons.bookmark_rounded,
                      label: 'Bookmarks',
                      action: TextButton(
                        onPressed: () =>
                            Navigator.pushNamed(context, '/bookmarks'),
                        child: const Text('See all'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _BookmarkGrid(
                      bookmarks: bookmarks.bookmarks.take(8).toList(),
                      onTap: (url) => _navigate(context, url),
                    ),
                    const SizedBox(height: 28),
                  ],
                  _SectionHeader(
                    icon: Icons.public_rounded,
                    label: 'Quick Access',
                  ),
                  const SizedBox(height: 12),
                  _QuickAccessGrid(
                    onTap: (url) => _navigate(context, url),
                  ),
                  const SizedBox(height: 40),
                  _Footer(theme: theme),
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _navIndex,
        onDestinationSelected: (i) {
          setState(() => _navIndex = i);
          switch (i) {
            case 1:
              Navigator.pushNamed(context, '/bookmarks');
            case 2:
              Navigator.pushNamed(context, '/settings');
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_outline_rounded),
            selectedIcon: Icon(Icons.bookmark_rounded),
            label: 'Bookmarks',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings_rounded),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}

// ─── Quick access grid ────────────────────────────────────────────────────────

class _QuickAccessGrid extends StatelessWidget {
  const _QuickAccessGrid({required this.onTap});

  final void Function(String url) onTap;

  static const List<_QuickSite> _sites = [
    _QuickSite('Google', 'https://google.com', Icons.search_rounded),
    _QuickSite('YouTube', 'https://youtube.com', Icons.play_circle_outline_rounded),
    _QuickSite('Reddit', 'https://reddit.com', Icons.forum_outlined),
    _QuickSite('Discord', 'https://discord.com', Icons.chat_bubble_outline_rounded),
    _QuickSite('Twitter / X', 'https://x.com', Icons.tag_rounded),
    _QuickSite('Wikipedia', 'https://wikipedia.org', Icons.menu_book_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 160,
        mainAxisExtent: 96,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: _sites.length,
      itemBuilder: (context, i) {
        final site = _sites[i];
        return _SiteCard(site: site, onTap: () => onTap(site.url));
      },
    );
  }
}

class _QuickSite {
  final String name;
  final String url;
  final IconData icon;
  const _QuickSite(this.name, this.url, this.icon);
}

class _SiteCard extends StatelessWidget {
  const _SiteCard({required this.site, required this.onTap});

  final _QuickSite site;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.hardEdge,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(site.icon,
                  size: 28, color: theme.colorScheme.primary),
              const SizedBox(height: 6),
              Text(
                site.name,
                style: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Bookmark grid ────────────────────────────────────────────────────────────

class _BookmarkGrid extends StatelessWidget {
  const _BookmarkGrid({required this.bookmarks, required this.onTap});

  final List<Bookmark> bookmarks;
  final void Function(String url) onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GridView.builder(
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 160,
        mainAxisExtent: 96,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: bookmarks.length,
      itemBuilder: (context, i) {
        final b = bookmarks[i];
        return Card(
          clipBehavior: Clip.hardEdge,
          child: InkWell(
            onTap: () => onTap(b.url),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor:
                        theme.colorScheme.primaryContainer,
                    child: Text(
                      b.initial,
                      style: TextStyle(
                        color: theme.colorScheme.onPrimaryContainer,
                        fontWeight: FontWeight.w700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    b.title,
                    style: theme.textTheme.labelMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.label,
    this.action,
  });

  final IconData icon;
  final String label;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          label,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w700,
            color: theme.colorScheme.onSurfaceVariant,
            letterSpacing: 0.5,
          ),
        ),
        const Spacer(),
        if (action != null) action!,
      ],
    );
  }
}

// ─── Footer ───────────────────────────────────────────────────────────────────

class _Footer extends StatelessWidget {
  const _Footer({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Text(
      'JetVeil — powered by Scramjet',
      style: theme.textTheme.bodySmall?.copyWith(
        color: theme.colorScheme.onSurfaceVariant.withAlpha(120),
      ),
      textAlign: TextAlign.center,
    );
  }
}
