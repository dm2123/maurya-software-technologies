import 'package:flutter/material.dart';

import '../theme.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('About')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            CircleAvatar(
              radius: 36,
              backgroundColor: AppTheme.primary,
              child: const Icon(Icons.auto_awesome, size: 36, color: Colors.white),
            ),
            const SizedBox(height: 12),
            const Text('Maurya Software Technologies',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const Text('Maurya Automation Suite — Mobile',
                style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 12),
            const Text(
              'Build, run and sync automation workflows from your phone. '
              'The mobile app is a companion to the desktop suite: it shares the '
              'same workflow format, can run HTTP / AI / messaging / file tasks on device, '
              'and syncs projects to the cloud via GitHub Gist.',
            ),
            const SizedBox(height: 16),
            const Text('Capabilities on mobile',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const Bullet('Visual node workflow editor (trigger → action → control)'),
            const Bullet('Run workflows on-device: HTTP, Delay, Write/Read File, Notify, AI, Telegram, Slack'),
            const Bullet('Control nodes: Loop, Filter, Set Variable, Condition, Transform'),
            const Bullet('Cloud Sync: pull & push workflows to GitHub Gist'),
            const Bullet('Webhook trigger with editable JSON payload'),
            const SizedBox(height: 16),
            const Text('Founder', style: TextStyle(fontWeight: FontWeight.bold)),
            const Bullet('Dinesh Maurya — Maurya Software Technologies'),
            const SizedBox(height: 16),
            const Text('Contact', style: TextStyle(fontWeight: FontWeight.bold)),
            const Bullet('Email: dm7178072@gmail.com'),
            const Bullet('WhatsApp: wa.me/917808658872'),
            const Bullet('GitHub: github.com/dm2123'),
            const Bullet('Instagram: @mr_dinesh_hacker'),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                leading: const Icon(Icons.desktop_windows),
                title: const Text('Desktop suite'),
                subtitle: const Text('Same workflows run on Windows / macOS / Linux'),
              ),
            ),
          ],
        ),
      );
}

class Bullet extends StatelessWidget {
  final String text;
  const Bullet(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('•  '),
            Expanded(child: Text(text)),
          ],
        ),
      );
}
