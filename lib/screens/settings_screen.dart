import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/proxy_settings.dart';
import '../services/settings_service.dart';
import '../theme/app_theme.dart';

/// Settings screen: proxy server configuration, theme, and accent colour.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _serverController;
  late TextEditingController _prefixController;
  bool _openInNewTab = false;
  bool _saveHistory = true;

  @override
  void initState() {
    super.initState();
    final p = context.read<SettingsService>().proxy;
    _serverController = TextEditingController(text: p.serverUrl);
    _prefixController =
        TextEditingController(text: p.scramjetPrefix);
    _openInNewTab = p.openInNewTab;
    _saveHistory = p.saveHistory;
  }

  @override
  void dispose() {
    _serverController.dispose();
    _prefixController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final settings = context.read<SettingsService>();
    await settings.saveProxy(
      ProxySettings(
        serverUrl: _serverController.text.trim(),
        scramjetPrefix: _prefixController.text.trim(),
        openInNewTab: _openInNewTab,
        saveHistory: _saveHistory,
      ),
    );
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved')),
      );
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final settings = context.watch<SettingsService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        leading: const BackButton(),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // ── Proxy server ─────────────────────────────────────────
                    _SectionLabel(
                        icon: Icons.dns_outlined, label: 'Proxy Server'),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            TextFormField(
                              controller: _serverController,
                              decoration: const InputDecoration(
                                labelText: 'Server URL',
                                hintText: 'https://my-jetveil.vercel.app',
                                prefixIcon:
                                    Icon(Icons.public_rounded),
                              ),
                              keyboardType: TextInputType.url,
                              textInputAction: TextInputAction.next,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'Server URL is required';
                                }
                                final uri = Uri.tryParse(v.trim());
                                if (uri == null ||
                                    !uri.hasScheme ||
                                    (!uri.scheme.startsWith('http'))) {
                                  return 'Enter a valid https:// URL';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            TextFormField(
                              controller: _prefixController,
                              decoration: const InputDecoration(
                                labelText: 'Scramjet Prefix',
                                hintText: '/scram/',
                                prefixIcon:
                                    Icon(Icons.route_outlined),
                                helperText:
                                    'The path prefix used by Scramjet on your server',
                              ),
                              textInputAction: TextInputAction.done,
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) {
                                  return 'Prefix is required';
                                }
                                return null;
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ── Behaviour ────────────────────────────────────────────
                    _SectionLabel(
                        icon: Icons.tune_rounded, label: 'Behaviour'),
                    const SizedBox(height: 12),
                    Card(
                      child: Column(
                        children: [
                          SwitchListTile(
                            value: _openInNewTab,
                            onChanged: (v) =>
                                setState(() => _openInNewTab = v),
                            title: const Text('Open in new tab'),
                            subtitle: const Text(
                                'Launch proxy URLs in a new browser tab'),
                            secondary: const Icon(
                                Icons.open_in_new_rounded),
                          ),
                          const Divider(height: 1),
                          SwitchListTile(
                            value: _saveHistory,
                            onChanged: (v) =>
                                setState(() => _saveHistory = v),
                            title: const Text('Save history'),
                            subtitle: const Text(
                                'Remember recently visited sites'),
                            secondary: const Icon(Icons.history_rounded),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // ── Appearance ───────────────────────────────────────────
                    _SectionLabel(
                        icon: Icons.palette_outlined,
                        label: 'Appearance'),
                    const SizedBox(height: 12),
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            _AccentPreview(current: settings.accentColor),
                            const SizedBox(height: 20),
                            _ThemeSelector(
                              current: settings.themeMode,
                              onChanged: (m) async {
                                await settings.saveThemeMode(m);
                              },
                            ),
                            const SizedBox(height: 20),
                            _AccentPicker(
                              current: settings.accentColor,
                              onChanged: (c) async {
                                await settings.saveAccentColor(c);
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),

                    FilledButton.icon(
                      onPressed: _save,
                      icon: const Icon(Icons.save_rounded),
                      label: const Text('Save Settings'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.pop(context),
                      icon: const Icon(Icons.close_rounded),
                      label: const Text('Cancel'),
                    ),

                    const SizedBox(height: 40),
                    _DeployCard(theme: theme),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Theme selector ───────────────────────────────────────────────────────────

class _ThemeSelector extends StatelessWidget {
  const _ThemeSelector({required this.current, required this.onChanged});

  final ThemeMode current;
  final void Function(ThemeMode) onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Theme', style: theme.textTheme.labelLarge),
        const SizedBox(height: 10),
        SegmentedButton<ThemeMode>(
          segments: const [
            ButtonSegment(
              value: ThemeMode.dark,
              icon: Icon(Icons.dark_mode_outlined),
              label: Text('Dark'),
            ),
            ButtonSegment(
              value: ThemeMode.light,
              icon: Icon(Icons.light_mode_outlined),
              label: Text('Light'),
            ),
            ButtonSegment(
              value: ThemeMode.system,
              icon: Icon(Icons.brightness_auto_outlined),
              label: Text('System'),
            ),
          ],
          selected: {current},
          onSelectionChanged: (s) => onChanged(s.first),
        ),
      ],
    );
  }
}

// ─── Accent colour picker ─────────────────────────────────────────────────────

class _AccentPicker extends StatelessWidget {
  const _AccentPicker({required this.current, required this.onChanged});

  final Color current;
  final void Function(Color) onChanged;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Accent Colour', style: theme.textTheme.labelLarge),
        const SizedBox(height: 4),
        Text(
          'Choose the highlight colour used across JetVeil.',
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: AppTheme.accentPresets.entries.map((entry) {
            final selected = current.value == entry.value.value;
            return Tooltip(
              message: entry.key,
              child: ChoiceChip(
                selected: selected,
                onSelected: (_) => onChanged(entry.value),
                label: Text(entry.key),
                avatar: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: entry.value,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected
                          ? theme.colorScheme.onSurface
                          : theme.colorScheme.outlineVariant,
                      width: 1,
                    ),
                  ),
                ),
                labelStyle: theme.textTheme.labelMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
                showCheckmark: false,
                selectedColor: theme.colorScheme.primaryContainer,
                backgroundColor: theme.colorScheme.surfaceContainerHighest,
                side: BorderSide(
                  color: selected
                      ? theme.colorScheme.primary
                      : theme.colorScheme.outlineVariant,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

class _AccentPreview extends StatelessWidget {
  const _AccentPreview({required this.current});

  final Color current;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onAccent = ThemeData.estimateBrightnessForColor(current) ==
            Brightness.dark
        ? Colors.white
        : Colors.black;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: current.withAlpha(28),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: current.withAlpha(90)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: current,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Live accent preview',
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton(
                onPressed: () {},
                style: FilledButton.styleFrom(
                  backgroundColor: current,
                  foregroundColor: onAccent,
                  minimumSize: const Size(0, 38),
                ),
                child: const Text('Primary action'),
              ),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                child: const Text('Secondary'),
              ),
              Chip(
                label: const Text('Accent chip'),
                backgroundColor: current.withAlpha(35),
                labelStyle: TextStyle(color: current),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Deploy card ──────────────────────────────────────────────────────────────

class _DeployCard extends StatelessWidget {
  const _DeployCard({required this.theme});

  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.rocket_launch_outlined,
                    color: theme.colorScheme.primary, size: 20),
                const SizedBox(width: 8),
                Text('Deploy Your Server',
                    style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700)),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'JetVeil needs a Scramjet backend to proxy web traffic. '
              'Deploy the server directory to Vercel in one click — '
              'no configuration required.',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 12),
            _DeployBadge(
              label: 'Deploy to Vercel',
              icon: Icons.cloud_upload_outlined,
              url:
                  'https://vercel.com/new/clone?repository-url=https://github.com/SillyLittleTech/JetVeil&root-directory=server',
            ),
          ],
        ),
      ),
    );
  }
}

class _DeployBadge extends StatelessWidget {
  const _DeployBadge(
      {required this.label, required this.icon, required this.url});

  final String label;
  final IconData icon;
  final String url;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return OutlinedButton.icon(
      onPressed: () async {
        final uri = Uri.parse(url);
        if (await canLaunchUrl(uri)) await launchUrl(uri);
      },
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 40),
          textStyle:
              const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
    );
  }
}

// ─── Section label ────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Icon(icon, size: 18, color: theme.colorScheme.primary),
        const SizedBox(width: 8),
        Text(
          label.toUpperCase(),
          style: theme.textTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: 1.2,
            color: theme.colorScheme.primary,
          ),
        ),
      ],
    );
  }
}
