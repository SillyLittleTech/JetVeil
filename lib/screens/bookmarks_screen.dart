import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/bookmark.dart';
import '../services/bookmark_service.dart';
import '../services/settings_service.dart';
import '../widgets/bookmark_tile.dart';

/// Full bookmarks management screen.
class BookmarksScreen extends StatelessWidget {
  const BookmarksScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bookmarks = context.watch<BookmarkService>();
    final settings = context.read<SettingsService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bookmarks'),
        leading: const BackButton(),
        actions: [
          if (bookmarks.bookmarks.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined),
              tooltip: 'Clear all',
              onPressed: () async {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    title: const Text('Clear all bookmarks?'),
                    content: const Text('This cannot be undone.'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context, false),
                        child: const Text('Cancel'),
                      ),
                      FilledButton(
                        onPressed: () => Navigator.pop(context, true),
                        child: const Text('Clear'),
                      ),
                    ],
                  ),
                );
                if (confirmed == true) {
                  for (final b in List.of(bookmarks.bookmarks)) {
                    await bookmarks.remove(b.id);
                  }
                }
              },
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: SafeArea(
        child: bookmarks.bookmarks.isEmpty
            ? _EmptyState(theme: theme)
            : ReorderableListView.builder(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                itemCount: bookmarks.bookmarks.length,
                onReorder: bookmarks.reorder,
                itemBuilder: (context, i) {
                  final b = bookmarks.bookmarks[i];
                  return BookmarkTile(
                    key: ValueKey(b.id),
                    bookmark: b,
                    onTap: () async {
                      if (!settings.proxy.isConfigured) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                                'Configure your server in Settings first.'),
                          ),
                        );
                        return;
                      }
                      final proxyUrl =
                          settings.proxy.buildProxyUrl(b.url);
                      final uri = Uri.parse(proxyUrl);
                      if (await canLaunchUrl(uri)) {
                        await launchUrl(uri,
                            mode: LaunchMode.externalApplication);
                      }
                    },
                    onDelete: () => bookmarks.remove(b.id),
                  );
                },
              ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddDialog(context, bookmarks),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Add Bookmark'),
      ),
    );
  }

  Future<void> _showAddDialog(
      BuildContext context, BookmarkService service) async {
    final titleCtrl = TextEditingController();
    final urlCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    await showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Bookmark'),
        content: Form(
          key: formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  prefixIcon: Icon(Icons.bookmark_outline_rounded),
                ),
                textInputAction: TextInputAction.next,
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Required' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: urlCtrl,
                decoration: const InputDecoration(
                  labelText: 'URL',
                  hintText: 'https://example.com',
                  prefixIcon: Icon(Icons.link_rounded),
                ),
                keyboardType: TextInputType.url,
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return 'Required';
                  final uri = Uri.tryParse(v.trim());
                  if (uri == null || !uri.hasScheme) {
                    return 'Enter a valid URL (include https://)';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              await service.add(Bookmark(
                id: DateTime.now().millisecondsSinceEpoch.toString(),
                title: titleCtrl.text.trim(),
                url: urlCtrl.text.trim(),
              ));
              if (context.mounted) Navigator.pop(context);
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.theme});
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.bookmark_border_rounded,
              size: 64,
              color: theme.colorScheme.onSurfaceVariant.withAlpha(120)),
          const SizedBox(height: 16),
          Text(
            'No bookmarks yet',
            style: theme.textTheme.titleMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 6),
          Text(
            'Tap + to save your favourite sites',
            style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant.withAlpha(160)),
          ),
        ],
      ),
    );
  }
}
