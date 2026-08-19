import 'package:flutter/material.dart';

class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  static const _services = [
    (Icons.terminal, 'Software Development',
        'Product engineering from specification to release process.'),
    (Icons.language, 'Web Development', 'Responsive sites and web applications.'),
    (Icons.smartphone, 'Mobile Application Development',
        'Planning and implementation of mobile products.'),
    (Icons.desktop_windows, 'Desktop Application Development',
        'Cross-platform Electron applications like Maurya Desktop.'),
    (Icons.api, 'API Development', 'HTTP APIs designed for later cloud hosting.'),
    (Icons.cloud, 'Cloud Integration',
        'Deployment and integration patterns for hosted services.'),
    (Icons.palette, 'UI/UX Development',
        'Interface systems, theming, and accessible layouts.'),
    (Icons.settings_suggest, 'Automation',
        'CI, release tagging, and repeatable build pipelines.'),
    (Icons.psychology, 'Technology Consulting',
        'Architecture review and implementation guidance.'),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Services')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('What we can build',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'These are service capabilities, not a list of existing clients, offices, or completed contracts.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            for (final (icon, title, desc) in _services)
              Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
                  title: Text(title,
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(desc),
                ),
              ),
          ],
        ),
      );
}