import 'package:flutter/material.dart';

/// The primary URL input bar.
///
/// Shows a rounded text field with a shield icon on the left and
/// a submit arrow on the right. Calls [onSubmit] when the user
/// presses Enter or taps the arrow.
class UrlBar extends StatefulWidget {
  const UrlBar({
    super.key,
    required this.onSubmit,
    this.initialValue = '',
  });

  final void Function(String url) onSubmit;
  final String initialValue;

  @override
  State<UrlBar> createState() => _UrlBarState();
}

class _UrlBarState extends State<UrlBar> {
  late final TextEditingController _controller;
  final _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue);
    _controller.addListener(_onTextChanged);
  }

  void _onTextChanged() => setState(() {});

  @override
  void dispose() {
    _controller.removeListener(_onTextChanged);
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _submit() {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _focusNode.unfocus();
    widget.onSubmit(text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withAlpha(60),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(
            Icons.shield_rounded,
            size: 20,
            color: theme.colorScheme.primary,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _controller,
              focusNode: _focusNode,
              decoration: const InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                hintText: 'Enter a URL or search term…',
                contentPadding:
                    EdgeInsets.symmetric(vertical: 14),
                filled: false,
              ),
              keyboardType: TextInputType.url,
              textInputAction: TextInputAction.go,
              onSubmitted: (_) => _submit(),
              style: theme.textTheme.bodyLarge,
            ),
          ),
          if (_controller.text.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded),
              iconSize: 18,
              tooltip: 'Clear',
              onPressed: () {
                _controller.clear();
                setState(() {});
              },
            ),
          FilledButton(
            onPressed: _submit,
            style: FilledButton.styleFrom(
              minimumSize: const Size(48, 48),
              shape: const RoundedRectangleBorder(
                borderRadius: BorderRadius.only(
                  topRight: Radius.circular(14),
                  bottomRight: Radius.circular(14),
                ),
              ),
              padding: EdgeInsets.zero,
            ),
            child: const Icon(Icons.arrow_forward_rounded, size: 20),
          ),
        ],
      ),
    );
  }
}
