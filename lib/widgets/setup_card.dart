import 'package:flutter/material.dart';

/// Shown on the home screen when no proxy server has been configured.
class SetupCard extends StatelessWidget {
  const SetupCard({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(
          color: theme.colorScheme.primary.withAlpha(80),
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Logo / icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    theme.colorScheme.primary.withAlpha(40),
                    theme.colorScheme.primary.withAlpha(10),
                  ],
                ),
              ),
              child: Icon(
                Icons.shield_rounded,
                size: 40,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 20),

            Text(
              'Welcome to JetVeil',
              style: theme.textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'JetVeil is a deep web proxy powered by the Scramjet engine. '
              'To start browsing, deploy the server to Vercel (free) and '
              'paste the URL into Settings.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),

            // Steps
            _Step(
              number: '1',
              icon: Icons.cloud_upload_outlined,
              title: 'Deploy the server',
              subtitle:
                  'Click "Deploy to Vercel" in Settings — it\'s free and takes ~2 minutes.',
              theme: theme,
            ),
            const SizedBox(height: 12),
            _Step(
              number: '2',
              icon: Icons.settings_outlined,
              title: 'Paste your server URL',
              subtitle:
                  'Open Settings and enter the URL Vercel gives you (e.g. https://my-jetveil.vercel.app).',
              theme: theme,
            ),
            const SizedBox(height: 12),
            _Step(
              number: '3',
              icon: Icons.travel_explore_rounded,
              title: 'Start browsing',
              subtitle:
                  'Type any URL in the address bar and JetVeil routes it through Scramjet.',
              theme: theme,
            ),

            const SizedBox(height: 24),

            FilledButton.icon(
              onPressed: () => Navigator.pushNamed(context, '/settings'),
              icon: const Icon(Icons.settings_rounded),
              label: const Text('Open Settings'),
            ),
          ],
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  const _Step({
    required this.number,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.theme,
  });

  final String number;
  final IconData icon;
  final String title;
  final String subtitle;
  final ThemeData theme;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: theme.colorScheme.primaryContainer,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Text(
            number,
            style: TextStyle(
              color: theme.colorScheme.onPrimaryContainer,
              fontWeight: FontWeight.w700,
              fontSize: 14,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 16, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(
                    title,
                    style: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
