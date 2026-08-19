import 'dart:io';
import 'dart:convert';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import '../models/workflow.dart';

class StorageService {
  Future<Directory> get _dir async => await getApplicationDocumentsDirectory();

  Future<File> get _wfFile async => File(p.join((await _dir).path, 'workflows.json'));
  Future<File> get _secretFile async => File(p.join((await _dir).path, 'secrets.json'));

  Future<List<Workflow>> loadWorkflows() async {
    try {
      final f = await _wfFile;
      if (!await f.exists()) return [];
      final j = jsonDecode(await f.readAsString()) as Map;
      final list = (j['workflows'] as List? ?? []);
      return list.map((e) => Workflow.fromJson(e)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> saveWorkflows(List<Workflow> wfs) async {
    final f = await _wfFile;
    await f.writeAsString(jsonEncode({'workflows': wfs.map((w) => w.toJson()).toList()}));
  }

  Future<Map<String, String>> loadSecrets() async {
    try {
      final f = await _secretFile;
      if (!await f.exists()) return {};
      final j = jsonDecode(await f.readAsString()) as Map;
      return Map<String, String>.from(j);
    } catch (_) {
      return {};
    }
  }

  Future<void> saveSecrets(Map<String, String> s) async {
    final f = await _secretFile;
    await f.writeAsString(jsonEncode(s));
  }

  Future<String> get baseDir async => (await _dir).path;
}
