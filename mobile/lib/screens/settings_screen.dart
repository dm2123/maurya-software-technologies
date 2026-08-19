import 'package:flutter/material.dart';

import '../state/app_state.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final List<String> predefined = const [
    'github_token',
    'gist_id',
    'ai_openai',
    'ai_anthropic',
    'telegram_token',
    'telegram_chat',
    'slack_webhook',
    'smtp_host',
    'smtp_user',
    'smtp_pass',
  ];
  final Map<String, TextEditingController> _ctrl = {};

  @override
  void initState() {
    super.initState();
    for (final k in predefined) {
      _ctrl[k] = TextEditingController(text: appState.secrets[k] ?? '');
    }
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final custom = appState.secrets.keys.where((k) => !predefined.contains(k)).toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Settings & Secrets')),
      body: ListView(
        padding: const EdgeInsets.all(8),
        children: [
const Card(
            child: ListTile(
              leading: Icon(Icons.security),
              title: Text('Secrets vault'),
              subtitle: Text('Stored locally on device (app documents). '
                  'Used by AI, Telegram, Slack, Email and Cloud Sync.'),
            ),
          ),
          const SizedBox(height: 8),
          const Text('Connections',
              style: TextStyle(fontWeight: FontWeight.bold)),
          for (final k in predefined)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4),
              child: TextField(
                controller: _ctrl[k],
                obscureText: k.contains('token') || k.contains('pass') || k.contains('key'),
                decoration: InputDecoration(
                  labelText: k,
                  border: const OutlineInputBorder(),
                ),
                onChanged: (v) => appState.setSecret(k, v),
              ),
            ),
          const Divider(),
          const Text('Custom secrets',
              style: TextStyle(fontWeight: FontWeight.bold)),
          ...custom.map((k) => ListTile(
                title: Text(k),
                subtitle: Text(appState.secrets[k]!),
                trailing: IconButton(
                  icon: const Icon(Icons.delete),
                  onPressed: () => appState.removeSecret(k),
                ),
              )),
          Padding(
            padding: const EdgeInsets.all(8),
            child: ElevatedButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add custom secret'),
              onPressed: () {
                final keyCtrl = TextEditingController();
                final valCtrl = TextEditingController();
                showDialog(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('New secret'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: keyCtrl,
                          decoration: const InputDecoration(labelText: 'Key'),
                        ),
                        TextField(
                          controller: valCtrl,
                          decoration: const InputDecoration(labelText: 'Value'),
                          obscureText: true,
                        ),
                      ],
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          if (keyCtrl.text.trim().isNotEmpty) {
                            appState.setSecret(keyCtrl.text.trim(), valCtrl.text);
                          }
                          Navigator.pop(ctx);
                        },
                        child: const Text('Save'),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
          const Divider(),
          const Card(
            child: ListTile(
              leading: Icon(Icons.info),
              title: Text('Maurya Automation (Mobile)'),
              subtitle: Text('Version 1.0.0 · Flutter'),
            ),
          ),
        ],
      ),
    );
  }
}
