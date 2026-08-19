import 'package:flutter/material.dart';

import '../models/workflow.dart';
import '../state/app_state.dart';
import '../data/palette.dart';

class EditorScreen extends StatefulWidget {
  const EditorScreen({super.key});

  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  late Workflow wf;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final arg = ModalRoute.of(context)?.settings.arguments;
    wf = (arg is Workflow ? arg : Workflow(name: 'New', nodes: [], connections: [])).clone();
    _autoLayout();
  }

  void _autoLayout() {
    double y = 30;
    for (final n in wf.nodes) {
      if (n.x == 0 && n.y == 0) {
        n.x = 24;
        n.y = y;
        y += 84;
      }
    }
  }

  String _newId() => 'n${DateTime.now().microsecondsSinceEpoch}';

  void _addNode(NodeTemplate tpl) {
    final type = tpl.config['type']?.toString() ?? tpl.type;
    final node = FlowNode(
      id: _newId(),
      type: type,
      name: tpl.label,
      config: Map<String, dynamic>.from(tpl.config),
      x: 24,
      y: 30 + wf.nodes.length * 84,
    );
    setState(() => wf.nodes.add(node));
  }

  void _deleteNode(String id) {
    setState(() {
      wf.nodes.removeWhere((n) => n.id == id);
      wf.connections.removeWhere((c) => c.from == id || c.to == id);
    });
  }

  void _addConnection(String from, String to) {
    if (from == to) return;
    if (wf.connections.any((c) => c.from == from && c.to == to)) return;
    setState(() => wf.connections
        .add(Connection(id: 'c${from}_$to', from: from, to: to)));
  }

  void _deleteConnection(int index) =>
      setState(() => wf.connections.removeAt(index));

  Future<void> _save() async {
    final name = wf.name.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Workflow needs a name')));
      return;
    }
    appState.upsertWorkflow(wf);
    if (mounted) Navigator.pop(context);
  }

  void _editNode(FlowNode node) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _NodeEditor(
        node: node,
        onChanged: (updated) => setState(() => node.config = updated),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ids = wf.nodes.map((n) => n.id).toList();
    String? fromSel = ids.isNotEmpty ? ids.first : null;
    String? toSel = ids.length > 1 ? ids[1] : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(wf.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.play_arrow),
            onPressed: () => Navigator.pushNamed(context, '/runner', arguments: wf),
          ),
          IconButton(icon: const Icon(Icons.save), onPressed: _save),
        ],
      ),
      body: Column(
        children: [
          SizedBox(
            height: 150,
            child: CustomPaint(
              painter: _CanvasPainter(wf),
              child: Container(),
            ),
          ),
          const Divider(),
          Expanded(
            child: ListView(
              children: [
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('Nodes', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                ...wf.nodes.map((n) => Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: typeColors[n.type] ?? Colors.grey,
                          child: const Icon(Icons.circle, size: 12, color: Colors.white),
                        ),
                        title: Text(n.name),
                        subtitle: Text(n.type),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit),
                              onPressed: () => _editNode(n),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete),
                              onPressed: () => _deleteNode(n.id),
                            ),
                          ],
                        ),
                      ),
                    )),
                const Padding(
                  padding: EdgeInsets.all(8),
                  child: Text('Connections', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                ...wf.connections.asMap().entries.map((e) => ListTile(
                      dense: true,
                      leading: const Icon(Icons.link),
                      title: Text('${_name(e.value.from)} → ${_name(e.value.to)}'),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete),
                        onPressed: () => _deleteConnection(e.key),
                      ),
                    )),
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: fromSel,
                          items: ids
                              .map((id) => DropdownMenuItem(value: id, child: Text(_name(id))))
                              .toList(),
                          onChanged: (v) => fromSel = v,
                          decoration: const InputDecoration(labelText: 'From'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: toSel,
                          items: ids
                              .map((id) => DropdownMenuItem(value: id, child: Text(_name(id))))
                              .toList(),
                          onChanged: (v) => toSel = v,
                          decoration: const InputDecoration(labelText: 'To'),
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.add),
                        onPressed: () {
                          if (fromSel != null && toSel != null) {
                            _addConnection(fromSel!, toSel!);
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        child: const Icon(Icons.add),
        onPressed: () => showModalBottomSheet(
          context: context,
          builder: (ctx) => ListView(
            children: [
              for (final cat in ['Trigger', 'Action', 'Control'])
                ...nodeTemplates
                    .where((t) => t.category == cat)
                    .map((t) => ListTile(
                          title: Text(t.label),
                          subtitle: Text(t.category),
                          onTap: () {
                            _addNode(t);
                            Navigator.pop(ctx);
                          },
                        )),
            ],
          ),
        ),
      ),
    );
  }

  String _name(String id) =>
      wf.nodes.firstWhere((n) => n.id == id, orElse: () => FlowNode(id: id, type: '', name: id)).name;
}

class _NodeEditor extends StatefulWidget {
  final FlowNode node;
  final void Function(Map<String, dynamic>) onChanged;
  const _NodeEditor({required this.node, required this.onChanged});

  @override
  State<_NodeEditor> createState() => _NodeEditorState();
}

class _NodeEditorState extends State<_NodeEditor> {
  late Map<String, String> fields;

  @override
  void initState() {
    super.initState();
    fields = widget.node.config.map((k, v) => MapEntry(k, v.toString()));
  }

  void _commit() => widget.onChanged(Map<String, dynamic>.from(fields));

  @override
  Widget build(BuildContext context) {
    final nameCtrl = TextEditingController(text: widget.node.name);
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Name'),
              onChanged: (v) => widget.node.name = v,
            ),
            const SizedBox(height: 8),
            for (final key in fields.keys)
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(key, style: const TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  Expanded(
                    flex: 3,
                    child: TextField(
                      controller: TextEditingController(text: fields[key]),
                      decoration: InputDecoration(hintText: key),
                      onChanged: (v) {
                        fields[key] = v;
                        _commit();
                      },
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete),
                    onPressed: () {
                      setState(() => fields.remove(key));
                      _commit();
                    },
                  ),
                ],
              ),
            TextButton.icon(
              icon: const Icon(Icons.add),
              label: const Text('Add field'),
              onPressed: () {
                setState(() => fields['newField'] = '');
                _commit();
              },
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _CanvasPainter extends CustomPainter {
  final Workflow wf;
  _CanvasPainter(this.wf);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = Colors.grey.shade400 ..strokeWidth = 2;
    final pos = {for (var n in wf.nodes) n.id: Offset(n.x, n.y)};
    for (final c in wf.connections) {
      final a = pos[c.from];
      final b = pos[c.to];
      if (a != null && b != null) {
        canvas.drawLine(a + const Offset(60, 60), b + const Offset(60, 0), paint);
      }
    }
    for (final n in wf.nodes) {
      final color = typeColors[n.type] ?? Colors.grey;
      final rect = Rect.fromLTWH(n.x, n.y, 120, 56);
      canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(10)),
          Paint()..color = color.withOpacity(0.85));
      final tp = TextPainter(
        text: TextSpan(
          text: n.name,
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
        textDirection: TextDirection.ltr,
      );
      tp.layout();
      tp.paint(canvas, Offset(n.x + 8, n.y + 20));
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter old) => true;
}
