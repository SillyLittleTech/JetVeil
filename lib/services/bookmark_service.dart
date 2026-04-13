import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/bookmark.dart';

/// Manages the persisted list of bookmarks.
class BookmarkService extends ChangeNotifier {
  static const _key = 'bookmarks';

  late SharedPreferences _prefs;
  List<Bookmark> _bookmarks = [];

  List<Bookmark> get bookmarks => List.unmodifiable(_bookmarks);
  
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    _load();
  }

  void _load() {
    final raw = _prefs.getString(_key);
    if (raw == null) return;
    try {
      final list = json.decode(raw) as List<dynamic>;
      _bookmarks = list
          .map((e) => Bookmark.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      _bookmarks = [];
    }
  }

  Future<void> _persist() async {
    await _prefs.setString(
      _key,
      json.encode(_bookmarks.map((b) => b.toJson()).toList()),
    );
  }

  Future<void> add(Bookmark bookmark) async {
    _bookmarks = [bookmark, ..._bookmarks];
    await _persist();
    notifyListeners();
  }

  Future<void> remove(String id) async {
    _bookmarks = _bookmarks.where((b) => b.id != id).toList();
    await _persist();
    notifyListeners();
  }

  Future<void> reorder(int oldIndex, int newIndex) async {
    final item = _bookmarks.removeAt(oldIndex);
    final adjusted = newIndex > oldIndex ? newIndex - 1 : newIndex;
    _bookmarks.insert(adjusted, item);
    await _persist();
    notifyListeners();
  }

  bool contains(String url) => _bookmarks.any((b) => b.url == url);
}
