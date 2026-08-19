import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const String _email = 'dm7178072@gmail.com';
  static const String _whatsapp = '+91 78086 58872';

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      return;
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('About')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const CircleAvatar(
              radius: 36,
              backgroundColor: AppTheme.primary,
              child: Icon(Icons.auto_awesome, size: 36, color: Colors.white),
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
              'same workflow format, can run HTTP / Email / PDF / AI / messaging / file tasks on device, '
              'and syncs projects to the cloud via GitHub Gist.',
            ),
            const SizedBox(height: 16),
            const Text('Capabilities on mobile',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const Bullet('Visual node workflow editor (trigger → action → control)'),
            const Bullet('Run workflows on-device: HTTP, Delay, Write/Read File, Email (SMTP), PDF, Notify, AI, Telegram, Slack'),
            const Bullet('Control nodes: Loop, Filter, Set Variable, Condition, Transform'),
            const Bullet('Cloud Sync: pull & push workflows to GitHub Gist'),
            const Bullet('Webhook trigger: real localhost server on the phone — POST to it from any device'),
            const SizedBox(height: 16),
            const Text('Founder', style: TextStyle(fontWeight: FontWeight.bold)),
            const Bullet('Dinesh Maurya — Maurya Software Technologies'),
            const SizedBox(height: 16),
            const Text('Contact', style: TextStyle(fontWeight: FontWeight.bold)),
            ListTile(
              leading: const Icon(Icons.email),
              title: const Text('Email'),
              subtitle: const Text(_email),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
              onTap: () => _open(
                  'mailto:$_email?subject=${Uri.encodeComponent('Project inquiry')}'
                  '&body=${Uri.encodeComponent('Hello Dinesh, I want to discuss a software or automation project.')}'),
            ),
            ListTile(
              leading: const Icon(Icons.chat),
              title: const Text('WhatsApp / Phone'),
              subtitle: const Text(_whatsapp),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
              onTap: () => _open(
                  'https://wa.me/917808658872?text=${Uri.encodeComponent('Hello Dinesh, I want to discuss a software or automation project.')}'),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Instagram'),
              subtitle: const Text('@mr_dinesh_hacker'),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
              onTap: () => _open('https://instagram.com/mr_dinesh_hacker'),
            ),
            ListTile(
              leading: const Icon(Icons.code),
              title: const Text('GitHub'),
              subtitle: const Text('dm2123'),
              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
              onTap: () => _open('https://github.com/dm2123'),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              icon: const Icon(Icons.edit_note),
              label: const Text('Compose project email'),
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => const ComposeEmailDialog(),
              ),
            ),
            const SizedBox(height: 16),
            const Card(
              child: ListTile(
                leading: Icon(Icons.desktop_windows),
                title: Text('Desktop suite'),
                subtitle: Text('Same workflows run on Windows / macOS / Linux'),
              ),
            ),
          ],
        ),
      );
}

class ComposeEmailDialog extends StatefulWidget {
  const ComposeEmailDialog({super.key});

  @override
  State<ComposeEmailDialog> createState() => _ComposeEmailDialogState();
}

class _ComposeEmailDialogState extends State<ComposeEmailDialog> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  Future<void> _compose() async {
    final name = _name.text.trim();
    final email = _email.text.trim();
    final subject = _subject.text.trim();
    final message = _message.text.trim();
    final emailOk = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email);
    if (name.isEmpty || !emailOk || subject.isEmpty || message.length < 10) {
      setState(() => _error =
          'Please enter a valid name, email, subject, and a message of at least 10 characters. Nothing was sent.');
      return;
    }
    final mailto = Uri(
      scheme: 'mailto',
      path: AboutScreen._email,
      queryParameters: {
        'subject': 'Project inquiry: $subject',
        'body': 'Name: $name\nEmail: $email\n\n$message',
      },
    );
    if (!await launchUrl(mailto, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        setState(() => _error =
            'Could not open your email app. Contact Dinesh on WhatsApp: ${AboutScreen._whatsapp}');
      }
      return;
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Compose project email'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              TextField(
                controller: _subject,
                decoration: const InputDecoration(labelText: 'Subject'),
              ),
              TextField(
                controller: _message,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Message'),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
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
            onPressed: _compose,
            child: const Text('Compose'),
          ),
        ],
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