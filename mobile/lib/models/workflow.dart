import 'dart:convert';

class FlowNode {
  final String id;
  final String type;
  final String name;
  Map<String, dynamic> config;
  double x;
  double y;

  FlowNode({
    required this.id,
    required this.type,
    required this.name,
    Map<String, dynamic>? config,
    this.x = 0,
    this.y = 0,
  }) : config = config ?? {};

  factory FlowNode.fromJson(Map<String, dynamic> j) => FlowNode(
        id: j['id'].toString(),
        type: j['type'].toString(),
        name: (j['name'] ?? '').toString(),
        config: Map<String, dynamic>.from(j['config'] ?? {}),
        x: (j['x'] ?? 0).toDouble(),
        y: (j['y'] ?? 0).toDouble(),
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'name': name,
        'config': config,
        'x': x,
        'y': y,
      };
}

class Connection {
  final String id;
  final String from;
  final String to;

  Connection({required this.id, required this.from, required this.to});

  factory Connection.fromJson(Map<String, dynamic> j) => Connection(
        id: j['id'].toString(),
        from: j['from'].toString(),
        to: j['to'].toString(),
      );

  Map<String, dynamic> toJson() => {'id': id, 'from': from, 'to': to};
}

class Workflow {
  String name;
  String? description;
  final List<FlowNode> nodes;
  final List<Connection> connections;

  Workflow({
    required this.name,
    required this.nodes,
    required this.connections,
    this.description,
  });

  factory Workflow.fromJson(Map<String, dynamic> j) => Workflow(
        name: (j['name'] ?? 'Untitled').toString(),
        description: j['description']?.toString(),
        nodes: (j['nodes'] as List? ?? [])
            .map((n) => FlowNode.fromJson(n as Map<String, dynamic>))
            .toList(),
        connections: (j['connections'] as List? ?? [])
            .map((c) => Connection.fromJson(c as Map<String, dynamic>))
            .toList(),
      );

  Map<String, dynamic> toJson() => {
        'name': name,
        'description': description,
        'nodes': nodes.map((n) => n.toJson()).toList(),
        'connections': connections.map((c) => c.toJson()).toList(),
      };

  Workflow clone() => Workflow.fromJson(jsonDecode(jsonEncode(toJson())));
}
