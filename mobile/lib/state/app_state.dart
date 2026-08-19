import 'package:flutter/foundation.dart';

import '../models/workflow.dart';
import '../services/storage.dart';
import '../services/webhook_server.dart';
import '../engine/engine.dart';
import '../data/examples.dart';

class WebhookBinding {
  final Workflow wf;
  final WebhookServer server;
  WebhookBinding(this.wf, this.server);
}

class AppState extends ChangeNotifier {
  final StorageService _storage = StorageService();
  List<Workflow> workflows = [];
  Map<String, String> secrets = {};
  bool loading = true;
  final List<WebhookBinding> webhooks = [];

  Future<void> init() async {
    workflows = await _storage.loadWorkflows();
    secrets = await _storage.loadSecrets();
    if (workflows.isEmpty) {
      workflows = exampleWorkflows();
      await _storage.saveWorkflows(workflows);
    }
    loading = false;
    notifyListeners();
  }

  Future<void> persist() async {
    await _storage.saveWorkflows(workflows);
    await _storage.saveSecrets(secrets);
  }

  void upsertWorkflow(Workflow wf) {
    final i = workflows.indexWhere((w) => w.name == wf.name);
    if (i >= 0) {
      workflows[i] = wf;
    } else {
      workflows.add(wf);
    }
    persist();
    notifyListeners();
  }

  void deleteWorkflow(String name) {
    workflows.removeWhere((w) => w.name == name);
    persist();
    notifyListeners();
  }

  void setSecret(String k, String v) {
    secrets[k] = v;
    persist();
    notifyListeners();
  }

  void removeSecret(String k) {
    secrets.remove(k);
    persist();
    notifyListeners();
  }

  bool get anyWebhookRunning => webhooks.any((b) => b.server.running);

  String? webhookUrlFor(String wfName) {
    for (final b in webhooks) {
      if (b.wf.name == wfName && b.server.running) return b.server.url;
    }
    return null;
  }

  Future<void> startWebhooks() async {
    await stopWebhooks();
    final base = await _storage.baseDir;
    for (final wf in workflows) {
      FlowNode? trigger;
      for (final n in wf.nodes) {
        final tt = n.config['triggerType']?.toString().toLowerCase().replaceAll(' ', '-');
        if (n.type == 'trigger' && tt == 'webhook') {
          trigger = n;
          break;
        }
      }
      if (trigger == null) continue;
      final port = int.tryParse(
              trigger.config['webhookPort']?.toString() ??
                  trigger.config['port']?.toString() ??
                  '') ??
          3030;
      final path = trigger.config['webhookPath']?.toString() ??
          trigger.config['path']?.toString() ??
          '/webhook';
      final method = trigger.config['webhookMethod']?.toString() ??
          trigger.config['method']?.toString() ??
          'POST';
      final server = WebhookServer();
      final wfCopy = wf.clone();
      final ok = await server.start(
        port: port,
        path: path,
        method: method,
        handler: (payload) async {
          final engine = AutomationEngine(secrets: secrets, baseDir: base);
          final r = await engine.run(wfCopy, webhookPayload: payload);
          return {'status': r.status, 'durationMs': r.durationMs, 'output': r.lastOutput};
        },
      );
      if (ok) webhooks.add(WebhookBinding(wf, server));
    }
    notifyListeners();
  }

  Future<void> stopWebhooks() async {
    for (final b in webhooks) {
      await b.server.stop();
    }
    webhooks.clear();
    notifyListeners();
  }

  String? get githubToken => secrets['github_token'];
  Future<String> get baseDir => _storage.baseDir;
}

final AppState appState = AppState();