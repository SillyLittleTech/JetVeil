import 'package:flutter/material.dart';

import '../models/bookmark.dart';

/// A single row in the bookmarks list.
class BookmarkTile extends StatelessWidget {
  const BookmarkTile({
    super.key,
    required this.bookmark,
    required this.onTap,
    required this.onDelete,
  });

  final Bookmark bookmark;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.hardEdge,
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: Text(
            bookmark.initial,
            style: TextStyle(
              color: theme.colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        title: Text(
          bookmark.title,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Text(
          bookmark.displayUrl,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.delete_outline_rounded),
              iconSize: 20,
              tooltip: 'Delete',
              color: theme.colorScheme.error,
              onPressed: onDelete,
            ),
            const Icon(Icons.drag_handle_rounded, size: 20),
          ],
        ),
        onTap: onTap,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      ),
    );
  }
}
