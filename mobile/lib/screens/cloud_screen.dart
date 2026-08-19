import 'dart:convert';
import 'package:flutter/material.dart';

import '../models/workflow.dart';
import '../state/app_state.dart';
import '../services/cloud_sync.dart';

class CloudScreen extends StatefulWidget {
  const CloudScreen({super.key});

  @override
  State<CloudScreen> createState() => _CloudScreenState();
}

class _CloudScreenState extends State<CloudScreen> {
  final CloudSyncService _cloud = CloudSyncService();
  List<CloudFile> files = [];
  bool loading = false;
  String? error;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final token = appState.githubToken;
    if (token == null || token.isEmpty) {
      setState(() {
        error = 'Set a "github_token" secret in Settings to use Cloud Sync.';
        files = [];
      });
      return;
    }
    setState(() => loading = true);
    try {
      files = await _cloud.list(token);
      error = null;
    } catch (e) {
      error = e.toString();
    }
    setState(() => loading = false);
  }

  Future<void> _pull(CloudFile f) async {
    try {
      final wf = Workflow.fromJson(jsonDecode(f.content) as Map<String, dynamic>);
      appState.upsertWorkflow(wf);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Pulled ${wf.name}')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Pull failed: $e')));
      }
    }
  }

  Future<void> _push(Workflow wf) async {
    final token = appState.githubToken;
    if (token == null || token.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('Set github_token first')));
      }
      return;
    }
    setState(() => loading = true);
    try {
      await _cloud.push(token, appState.secrets['gist_id'], wf);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Pushed ${wf.name}')));
      }
      await _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Push failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Cloud Sync'),
          actions: [IconButton(icon: const Icon(Icons.refresh), onPressed: _refresh)],
        ),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(8),
                children: [
                  if (error != null)
                    Card(
                      color: Colors.orange.shade50,
                      child: ListTile(title: Text(error!)),
                    ),
                  const Text('Cloud workflows (GitHub Gist)',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...files.map((f) => Card(
                        child: ListTile(
                          title: Text(f.filename),
                          subtitle: Text(f.updatedAt ?? f.gistId),
                          trailing: ElevatedButton(
                            onPressed: () => _pull(f),
                            child: const Text('Pull'),
                          ),
                        ),
                      )),
                  if (files.isEmpty && error == null)
                    const Text('No workflows in your Gist yet. Push one below.'),
                  const Divider(),
                  const Text('Push a local workflow',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...appState.workflows.map((wf) => Card(
                        child: ListTile(
                          title: Text(wf.name),
                          trailing: ElevatedButton(
                            onPressed: () => _push(wf),
                            child: const Text('Push'),
                          ),
                        ),
                      )),
                ],
              ),
      );
}
