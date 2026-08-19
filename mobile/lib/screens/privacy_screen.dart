import 'package:flutter/material.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Privacy')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: const [
            Text('What this project stores',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 12),
            Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'The website stores only a theme preference in localStorage '
                      '(mst-theme). Maurya Desktop stores the same preference locally.',
                    ),
                    SizedBox(height: 12),
                    Text(
                      'The mobile app stores your workflows and secrets only on your '
                      'device (app documents folder). Secrets are used only by the '
                      'actions you run (AI, Email, Telegram, Slack).',
                    ),
                    SizedBox(height: 12),
                    Text(
                      'There is no user account system, no analytics SDK, and no '
                      'server-side contact inbox. GitHub will process downloads when '
                      'you use Releases, and GitHub Gist when you choose to sync.',
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Contact form values stay on your device or open your email app '
                      '— nothing is uploaded unless you connect a backend of your choosing.',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}