import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class DownloadsScreen extends StatelessWidget {
  const DownloadsScreen({super.key});

  static const String _repo = 'https://github.com/dm2123/maurya-software-technologies';

  Future<void> _open(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Downloads — Desktop Suite')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Automation that runs where you work.',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Native cross-platform automation engine. Visual workflow builder. '
              'Triggers, actions, conditions. Runs locally — your data stays yours. '
              'Version 1.0.5 · MIT licensed.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            const _PlatformCard(
              platform: 'Windows',
              icon: Icons.window,
              desc: 'Squirrel installer with auto-updates',
              specs: ['Maurya-Desktop-Setup.exe', 'Auto-update via GitHub Releases'],
              buttons: [('Download for Windows', 'https://github.com/dm2123/maurya-software-technologies/releases/latest/download/Maurya-Desktop-Setup.exe')],
            ),
            const _PlatformCard(
              platform: 'Linux',
              icon: Icons.laptop,
              desc: 'AppImage, DEB, RPM — runs everywhere',
              specs: ['Maurya-Automation.AppImage', 'Maurya-Automation.deb', 'Maurya-Automation.rpm'],
              buttons: [
                ('AppImage', 'https://github.com/dm2123/maurya-software-technologies/releases/latest/download/Maurya-Desktop.AppImage'),
                ('DEB', 'https://github.com/dm2123/maurya-software-technologies/releases/latest/download/Maurya-Desktop.deb'),
                ('RPM', 'https://github.com/dm2123/maurya-software-technologies/releases/latest/download/Maurya-Desktop.rpm'),
              ],
            ),
            const _PlatformCard(
              platform: 'macOS',
              icon: Icons.apple,
              desc: 'Universal DMG (Apple Silicon + Intel)',
              specs: ['Maurya-Automation.dmg', 'Notarization pending'],
              buttons: [('Download for macOS', 'https://github.com/dm2123/maurya-software-technologies/releases/latest/download/Maurya-Desktop.dmg')],
            ),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Release details',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    const _MetaRow('Latest version', '1.0.5'),
                    const _MetaRow('Release channel', 'Stable'),
                    const _MetaRow('Electron version', '33.x'),
                    const _MetaRow('Architecture', 'x64 / arm64'),
                    const _MetaRow('License', 'MIT'),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      icon: const Icon(Icons.open_in_new, size: 18),
                      label: const Text('View all releases'),
                      onPressed: () => _open('$_repo/releases'),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.code, size: 18),
                      label: const Text('Source code'),
                      onPressed: () => _open(_repo),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            Card(
              color: Theme.of(context).colorScheme.primaryContainer,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Custom automation for your stack.',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    const Text(
                        'We build tailored workflows, custom actions, and integrations.'),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        FilledButton(
                          onPressed: () => _open(
                              'mailto:dm7178072@gmail.com?subject=${Uri.encodeComponent('Automation project inquiry')}'),
                          child: const Text('Email Dinesh'),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton(
                          onPressed: () => _open(
                              'https://wa.me/917808658872?text=${Uri.encodeComponent('Hello Dinesh, I want to automate a workflow.')}'),
                          child: const Text('WhatsApp'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

class _PlatformCard extends StatelessWidget {
  final String platform;
  final IconData icon;
  final String desc;
  final List<String> specs;
  final List<(String, String)> buttons;

  const _PlatformCard({
    required this.platform,
    required this.icon,
    required this.desc,
    required this.specs,
    required this.buttons,
  });

  @override
  Widget build(BuildContext context) => Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(platform,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Text(desc, style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 8),
              for (final s in specs)
                Text('•  $s', style: const TextStyle(fontSize: 13)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (final (label, url) in buttons)
                    FilledButton.tonal(
                      onPressed: () => launchUrl(Uri.parse(url),
                          mode: LaunchMode.externalApplication),
                      child: Text(label),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
}

class _MetaRow extends StatelessWidget {
  final String label;
  final String value;
  const _MetaRow(this.label, this.value);

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(color: Colors.grey)),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
      );
}