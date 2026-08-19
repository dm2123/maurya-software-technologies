import 'package:flutter/foundation.dart';

import '../models/workflow.dart';
import 'storage.dart';

class AppState extends ChangeNotifier {
  final StorageService _storage = StorageService();
  List<Workflow> workflows = [];
  Map<String, String> secrets = {};
  bool loading = true;

  Future<void> init() async {
    workflows = await _storage.loadWorkflows();
    secrets = await _storage.loadSecrets();
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

  String? get githubToken => secrets['github_token'];
  Future<String> get baseDir => _storage.baseDir;
}

final AppState appState = AppState();
