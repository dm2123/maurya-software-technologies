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
            leading: Builder(
              builder: (context) => IconButton(
                icon: const Icon(Icons.menu),
                onPressed: () => Scaffold.of(context).openDrawer(),
              ),
            ),
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
          drawer: const _HomeDrawer(),
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

class _HomeDrawer extends StatelessWidget {
  const _HomeDrawer();

  @override
  Widget build(BuildContext context) => Drawer(
        child: SafeArea(
          child: Column(
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.auto_awesome, size: 32),
                    SizedBox(width: 10),
                    Text('Maurya Automation',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const Divider(),
              Expanded(
                child: ListView(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.home_outlined),
                      title: const Text('Home'),
                      onTap: () => Navigator.pop(context),
                    ),
                    ListTile(
                      leading: const Icon(Icons.category_outlined),
                      title: const Text('Products'),
                      onTap: () => Navigator.pushNamed(context, '/products'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.work_outline),
                      title: const Text('Services'),
                      onTap: () => Navigator.pushNamed(context, '/services'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.download_outlined),
                      title: const Text('Downloads'),
                      onTap: () => Navigator.pushNamed(context, '/downloads'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.contact_mail_outlined),
                      title: const Text('About / Contact'),
                      onTap: () => Navigator.pushNamed(context, '/about'),
                    ),
                    ListTile(
                      leading: const Icon(Icons.privacy_tip_outlined),
                      title: const Text('Privacy'),
                      onTap: () => Navigator.pushNamed(context, '/privacy'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
}
