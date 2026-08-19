import 'dart:convert';
import 'package:flutter/material.dart';

import '../models/workflow.dart';
import '../state/app_state.dart';
import '../engine/engine.dart';

class RunnerScreen extends StatefulWidget {
  const RunnerScreen({super.key});

  @override
  State<RunnerScreen> createState() => _RunnerScreenState();
}

class _RunnerScreenState extends State<RunnerScreen> {
  late Workflow wf;
  final List<String> logs = [];
  EngineResult? result;
  bool running = false;
  final TextEditingController payloadCtrl = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arg = ModalRoute.of(context)?.settings.arguments;
    wf = (arg is Workflow ? arg : Workflow(name: '', nodes: [], connections: []));
  }

  bool get _isWebhook =>
      wf.nodes.any((n) => n.type == 'trigger' && 'webhook' == n.config['triggerType'].toString().toLowerCase().replaceAll(' ', '-'));

  Future<void> _run() async {
    setState(() {
      running = true;
      logs.clear();
      result = null;
    });
    Map<String, dynamic>? payload;
    if (_isWebhook && payloadCtrl.text.trim().isNotEmpty) {
      try {
        payload = jsonDecode(payloadCtrl.text) as Map<String, dynamic>;
      } catch (_) {
        payload = {'raw': payloadCtrl.text};
      }
    }
    final engine = AutomationEngine(
      secrets: appState.secrets,
      baseDir: await appState.baseDir,
      onLog: (lvl, msg) => setState(() => logs.add('[$lvl] $msg')),
      onNode: (id, state) => setState(() => logs.add('• $id → $state')),
    );
    final r = await engine.run(wf, webhookPayload: payload);
    setState(() {
      result = r;
      running = false;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text('Run: ${wf.name}')),
        body: Column(
          children: [
            if (_isWebhook)
              Padding(
                padding: const EdgeInsets.all(8),
                child: TextField(
                  controller: payloadCtrl,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    labelText: 'Webhook payload (JSON)',
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: ElevatedButton.icon(
                icon: running
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.play_arrow),
                label: Text(running ? 'Running…' : 'Run workflow'),
                onPressed: running ? null : _run,
              ),
            ),
            if (result != null)
              Padding(
                padding: const EdgeInsets.all(8),
                child: Card(
                  color: result!.status == 'success'
                      ? Colors.green.shade50
                      : Colors.red.shade50,
                  child: ListTile(
                    title: Text('Status: ${result!.status}'),
                    subtitle: Text(
                        '${result!.durationMs} ms\n${jsonEncode(result!.lastOutput)}'),
                  ),
                ),
              ),
            const Divider(),
            Expanded(
              child: ListView.builder(
                itemCount: logs.length,
                itemBuilder: (c, i) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  child: Text(logs[i],
                      style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                ),
              ),
            ),
          ],
        ),
      );
}
