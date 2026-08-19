import 'package:flutter/material.dart';

class NodeTemplate {
  final String type;
  final String category;
  final String label;
  final Map<String, dynamic> config;

  const NodeTemplate({
    required this.type,
    required this.category,
    required this.label,
    this.config = const {},
  });
}

const List<NodeTemplate> nodeTemplates = [
  NodeTemplate(
    type: 'trigger',
    category: 'Trigger',
    label: 'Manual',
    config: {'triggerType': 'Manual'},
  ),
  NodeTemplate(
    type: 'trigger',
    category: 'Trigger',
    label: 'Webhook',
    config: {
      'triggerType': 'Webhook',
      'webhookPort': '3030',
      'webhookPath': '/webhook',
      'webhookMethod': 'POST',
    },
  ),
  NodeTemplate(
    type: 'trigger',
    category: 'Trigger',
    label: 'Schedule',
    config: {'triggerType': 'Schedule', 'schedule': '0 * * * *'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'HTTP Request',
    config: {'actionType': 'HTTP Request', 'url': 'https://api.example.com', 'method': 'GET'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Delay',
    config: {'actionType': 'Delay', 'ms': '1000'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Write File',
    config: {'actionType': 'Write File', 'path': 'output.txt', 'content': '{{data}}'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Read File',
    config: {'actionType': 'Read File', 'path': 'output.txt'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Notify',
    config: {'actionType': 'Notify', 'message': 'Done'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'AI Completion',
    config: {'actionType': 'AI Completion', 'provider': 'openai', 'prompt': '{{data}}'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Telegram',
    config: {'actionType': 'Telegram', 'message': '{{data}}'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Slack',
    config: {'actionType': 'Slack', 'slackMessage': '{{data}}'},
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'Email',
    config: {
      'actionType': 'Email',
      'to': 'client@example.com',
      'subject': 'Hello {{data}}',
      'text': 'Message from Maurya Automation',
    },
  ),
  NodeTemplate(
    type: 'action',
    category: 'Action',
    label: 'PDF Generate',
    config: {
      'actionType': 'PDF Generate',
      'title': 'Maurya Automation Document',
      'content': 'Hello {{data}}',
      'path': 'document.pdf',
    },
  ),
  NodeTemplate(
    type: 'setvar',
    category: 'Control',
    label: 'Set Variable',
    config: {'variable': 'myVar', 'value': 'hello'},
  ),
  NodeTemplate(
    type: 'loop',
    category: 'Control',
    label: 'Loop',
    config: {'items': '[1,2,3]', 'variable': 'item'},
  ),
  NodeTemplate(
    type: 'filter',
    category: 'Control',
    label: 'Filter',
    config: {'items': '["a","b"]', 'expression': 'true', 'variable': 'filtered'},
  ),
  NodeTemplate(
    type: 'condition',
    category: 'Control',
    label: 'Condition',
    config: {'expression': 'true'},
  ),
  NodeTemplate(
    type: 'transform',
    category: 'Control',
    label: 'Transform',
    config: {'expression': 'data'},
  ),
];

const Map<String, Color> typeColors = {
  'trigger': Color(0xFF8E44AD),
  'action': Color(0xFF2D6CDF),
  'setvar': Color(0xFF16A085),
  'loop': Color(0xFFD35400),
  'filter': Color(0xFFD35400),
  'condition': Color(0xFFC0392B),
  'transform': Color(0xFFC0392B),
  'custom': Color(0xFF7F8C8D),
};
