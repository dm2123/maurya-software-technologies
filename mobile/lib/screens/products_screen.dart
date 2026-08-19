import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class ProductsScreen extends StatelessWidget {
  const ProductsScreen({super.key});

  Future<void> _open(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Products')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('Software lines in this repository',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Statuses below describe what is actually present in this project.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            _ProductCard(
              title: 'Maurya Desktop',
              desc: 'Cross-platform desktop software for Windows, Linux and macOS.',
              tags: const ['Status: available in repo', 'Windows', 'Linux', 'macOS'],
              live: true,
              buttonLabel: 'View downloads',
              onPressed: () => Navigator.pushNamed(context, '/downloads'),
            ),
            _ProductCard(
              title: 'Maurya Web Platform',
              desc: 'Modern responsive web applications and digital platforms.',
              tags: const ['Status: this website', 'Web'],
              live: true,
              buttonLabel: 'View website',
              onPressed: () => _open(
                  'https://dm2123.github.io/maurya-software-technologies/'),
            ),
            const _ProductCard(
              title: 'Maurya Apps',
              desc: 'Mobile applications for modern users and businesses.',
              tags: ['Status: this Android app', 'Android', 'iOS planned'],
              live: true,
              buttonLabel: 'You are using it',
            ),
            _ProductCard(
              title: 'Maurya Cloud',
              desc: 'Cloud-ready APIs, backend systems and scalable services.',
              tags: const ['Status: architecture ready', 'API', 'Cloud'],
              live: false,
              buttonLabel: 'View services',
              onPressed: () => Navigator.pushNamed(context, '/services'),
            ),
          ],
        ),
      );
}

class _ProductCard extends StatelessWidget {
  final String title;
  final String desc;
  final List<String> tags;
  final bool live;
  final String buttonLabel;
  final VoidCallback? onPressed;

  const _ProductCard({
    required this.title,
    required this.desc,
    required this.tags,
    required this.live,
    required this.buttonLabel,
    this.onPressed,
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
                  Icon(Icons.auto_awesome, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: 8),
                  Text(title,
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 6),
              Text(desc, style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  for (final t in tags)
                    Chip(
                      label: Text(t, style: const TextStyle(fontSize: 12)),
                      backgroundColor: live
                          ? Colors.green.shade50
                          : Colors.orange.shade50,
                      visualDensity: VisualDensity.compact,
                    ),
                ],
              ),
              if (onPressed != null)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton.tonal(
                      onPressed: onPressed,
                      child: Text(buttonLabel),
                    ),
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text(buttonLabel,
                      style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                ),
            ],
          ),
        ),
      );
}