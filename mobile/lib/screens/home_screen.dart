import 'package:flutter/material.dart';

import '../models/workflow.dart';
import '../state/app_state.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: appState,
        builder: (context, _) => Scaffold(
          appBar: AppBar(
            title: const Text('Maurya Automation'),
            actions: [
              IconButton(
                icon: const Icon(Icons.cloud_outlined),
                onPressed: () => Navigator.pushNamed(context, '/cloud'),
              ),
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: () => Navigator.pushNamed(context, '/settings'),
              ),
              IconButton(
                icon: const Icon(Icons.info_outline),
                onPressed: () => Navigator.pushNamed(context, '/about'),
              ),
            ],
          ),
          body: appState.loading
              ? const Center(child: CircularProgressIndicator())
              : appState.workflows.isEmpty
                  ? const Center(
                      child: Text('No workflows yet.\nTap + to create one.',
                          textAlign: TextAlign.center))
                  : ListView.builder(
                      itemCount: appState.workflows.length,
                      itemBuilder: (context, i) {
                        final wf = appState.workflows[i];
                        return Card(
                          child: ListTile(
                            leading: const Icon(Icons.account_tree_outlined),
                            title: Text(wf.name),
                            subtitle: Text(
                                '${wf.nodes.length} nodes · ${wf.connections.length} links'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.play_arrow),
                                  onPressed: () => Navigator.pushNamed(context, '/runner',
                                      arguments: wf),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.edit),
                                  onPressed: () => Navigator.pushNamed(context, '/editor',
                                      arguments: wf),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete),
                                  onPressed: () => appState.deleteWorkflow(wf.name),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
          floatingActionButton: FloatingActionButton(
            onPressed: () => Navigator.pushNamed(
              context,
              '/editor',
              arguments: Workflow(
                name: 'New Workflow',
                nodes: [
                  FlowNode(
                    id: 't',
                    type: 'trigger',
                    name: 'Manual',
                    config: {'triggerType': 'Manual'},
                  ),
                ],
                connections: [],
              ),
            ),
            child: const Icon(Icons.add),
          ),
        ),
      );
}
