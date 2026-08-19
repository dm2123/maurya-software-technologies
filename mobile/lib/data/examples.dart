import '../models/workflow.dart';

/// Example workflows preloaded on first launch — same format as the
/// desktop suite examples folder.
const List<Map<String, dynamic>> exampleWorkflowJson = [
  {
    'name': 'Loop Demo',
    'description': 'Runs a loop over 3 items and appends each to a file.',
    'nodes': [
      {'id': 't1', 'type': 'trigger', 'name': 'Manual', 'config': {'triggerType': 'Manual'}, 'x': 40, 'y': 40},
      {'id': 'n2', 'type': 'loop', 'name': 'Loop over items', 'config': {'items': '["report","invoice","receipt"]', 'variable': 'doc'}, 'x': 200, 'y': 40},
      {'id': 'n3', 'type': 'action', 'name': 'Append to file', 'config': {'actionType': 'Write File', 'path': 'docs.txt', 'content': '{{data}}\n'}, 'x': 400, 'y': 40},
    ],
    'connections': [
      {'id': 'c1', 'from': 't1', 'to': 'n2'},
      {'id': 'c2', 'from': 'n2', 'to': 'n3'},
    ],
  },
  {
    'name': 'Webhook Demo',
    'description': 'Starts a local webhook server; POST JSON to it and the workflow transforms the payload.',
    'nodes': [
      {'id': 't1', 'type': 'trigger', 'name': 'Webhook', 'config': {'triggerType': 'Webhook', 'webhookPort': '3030', 'webhookPath': '/webhook', 'webhookMethod': 'POST'}, 'x': 40, 'y': 40},
      {'id': 'n2', 'type': 'transform', 'name': 'Greet sender', 'config': {'expression': '"Hello " + data.name'}, 'x': 220, 'y': 40},
      {'id': 'n3', 'type': 'action', 'name': 'Notify', 'config': {'actionType': 'Notify', 'message': '{{data}}'}, 'x': 400, 'y': 40},
    ],
    'connections': [
      {'id': 'c1', 'from': 't1', 'to': 'n2'},
      {'id': 'c2', 'from': 'n2', 'to': 'n3'},
    ],
  },
  {
    'name': 'PDF Invoice Demo',
    'description': 'Generates a PDF invoice file on the device.',
    'nodes': [
      {'id': 't1', 'type': 'trigger', 'name': 'Manual', 'config': {'triggerType': 'Manual'}, 'x': 40, 'y': 40},
      {'id': 'n2', 'type': 'action', 'name': 'Generate PDF', 'config': {'actionType': 'PDF Generate', 'title': 'Maurya Software Technologies', 'content': 'INVOICE #001\n\nClient: {{data.client}}\nAmount: Rs {{data.amount}}\n\nThank you for your business!', 'path': 'invoice.pdf'}, 'x': 220, 'y': 40},
      {'id': 'n3', 'type': 'action', 'name': 'Notify', 'config': {'actionType': 'Notify', 'message': 'PDF saved to {{data.path}}'}, 'x': 400, 'y': 40},
    ],
    'connections': [
      {'id': 'c1', 'from': 't1', 'to': 'n2'},
      {'id': 'c2', 'from': 'n2', 'to': 'n3'},
    ],
  },
  {
    'name': 'HTTP + Filter Demo',
    'description': 'Fetches a list, keeps big items and writes them to a file.',
    'nodes': [
      {'id': 't1', 'type': 'trigger', 'name': 'Manual', 'config': {'triggerType': 'Manual'}, 'x': 40, 'y': 40},
      {'id': 'n2', 'type': 'action', 'name': 'Fetch items', 'config': {'actionType': 'HTTP Request', 'url': 'https://api.github.com/repos/dm2123/maurya-software-technologies/commits?per_page=10', 'method': 'GET'}, 'x': 200, 'y': 40},
      {'id': 'n3', 'type': 'filter', 'name': 'Only with messages', 'config': {'items': 'data.body', 'expression': 'item.commit != null', 'variable': 'commits'}, 'x': 380, 'y': 40},
      {'id': 'n4', 'type': 'action', 'name': 'Write count', 'config': {'actionType': 'Write File', 'path': 'commits.json', 'content': '{{vars.commits.length}} commits'}, 'x': 560, 'y': 40},
    ],
    'connections': [
      {'id': 'c1', 'from': 't1', 'to': 'n2'},
      {'id': 'c2', 'from': 'n2', 'to': 'n3'},
      {'id': 'c3', 'from': 'n3', 'to': 'n4'},
    ],
  },
];

List<Workflow> exampleWorkflows() =>
    exampleWorkflowJson.map(Workflow.fromJson).toList();