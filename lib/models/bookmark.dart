/// A saved bookmark (quick-access site).
class Bookmark {
  final String id;
  final String title;
  final String url;

  const Bookmark({
    required this.id,
    required this.title,
    required this.url,
  });

  /// Returns the first letter of the title, used as a fallback icon.
  String get initial => title.isNotEmpty ? title[0].toUpperCase() : '?';

  /// Returns the origin of the URL for display (e.g. "google.com").
  String get displayUrl {
    try {
      return Uri.parse(url).host;
    } catch (_) {
      return url;
    }
  }

  Bookmark copyWith({String? id, String? title, String? url}) => Bookmark(
        id: id ?? this.id,
        title: title ?? this.title,
        url: url ?? this.url,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'url': url,
      };

  factory Bookmark.fromJson(Map<String, dynamic> json) => Bookmark(
        id: (json['id'] as String?) ?? '',
        title: (json['title'] as String?) ?? '',
        url: (json['url'] as String?) ?? '',
      );
}
