import 'dart:io';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:maurya_automation/engine/engine.dart';
import 'package:maurya_automation/engine/eval.dart';
import 'package:maurya_automation/engine/interpolate.dart';
import 'package:maurya_automation/models/workflow.dart';

String pjoin(Directory tmp, String name) =>
    '${tmp.path}${Platform.pathSeparator}$name';

void main() {
  late Directory tmp;

  setUp(() => tmp = Directory.systemTemp.createTempSync('engine_test'));
  tearDown(() => tmp.deleteSync(recursive: true));

  FlowNode node(String id, String type, Map<String, dynamic> config, {String name = ''}) =>
      FlowNode(id: id, type: type, name: name.isEmpty ? id : name, config: config);

  test('interpolate resolves nested data and vars', () {
    final data = {
      'body': {'hello': 'duniya', 'n': 42},
      'ok': true,
    };
    final vars = {'item': 'a', 'deep': {'x': 9}};
    expect(interpolate('Hi {{data.body.hello}}!', data, vars), 'Hi duniya!');
    expect(interpolate('n={{data.body.n}} ok={{data.ok}}', data, vars), 'n=42 ok=true');
    expect(interpolate('{{vars.item}}-{{vars.deep.x}}', data, vars), 'a-9');
    expect(interpolate('no-tokens', data, vars), 'no-tokens');
  });

  test('eval parses booleans, comparisons and arithmetic', () {
    dynamic resolve(String n) {
      if (n == 'item') return 3;
      if (n == 'data') return 5;
      return null;
    }

    expect(truthy(ExprEvaluator('item > 2', resolve).parse()), true);
    expect(truthy(ExprEvaluator('item <= 2', resolve).parse()), false);
    expect(truthy(ExprEvaluator("data == 5", resolve).parse()), true);
    expect(truthy(ExprEvaluator("item == 3 && data == 5", resolve).parse()), true);
    expect(truthy(ExprEvaluator("item == 3 || data == 1", resolve).parse()), true);
    expect(truthy(ExprEvaluator('!(data == 1)', resolve).parse()), true);
    expect(ExprEvaluator('item + data', resolve).parse(), 8);
  });

  test('manual trigger + setvar + write/read file end to end', () async {
    final wf = Workflow(
      name: 'file-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('s', 'setvar', {'variable': 'greeting', 'value': 'Namaste {{data.name}}'}),
        node('w', 'action', {
          'actionType': 'Write File',
          'path': 'out.txt',
          'content': '{{vars.greeting}}'
        }),
        node('r', 'action', {'actionType': 'Read File', 'path': 'out.txt'}),
      ],
      connections: [
        Connection(id: 'c1', from: 't', to: 's'),
        Connection(id: 'c2', from: 's', to: 'w'),
        Connection(id: 'c3', from: 'w', to: 'r'),
      ],
    );

    final logs = <String>[];
    final engine = AutomationEngine(
        baseDir: tmp.path,
        onLog: (l, m) => logs.add('$l: $m'));

    final res = await engine.run(wf, webhookPayload: {'name': 'Dinesh'});

    expect(res.status, 'success');
    expect(res.results['w'], {'written': true, 'path': 'out.txt'});
    final written = File(pjoin(tmp, 'out.txt')).readAsStringSync();
    expect(written, 'Namaste Dinesh');
    expect(res.results['r'], 'Namaste Dinesh');
  });

  test('loop iterates over list and interpolates item', () async {
    final wf = Workflow(
      name: 'loop-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('l', 'loop', {'items': '[1, 2, 3]', 'variable': 'n'}),
        node('w', 'action', {
          'actionType': 'Write File',
          'path': 'sum.txt',
          'content': '{{data}}'
        }),
      ],
      connections: [
        Connection(id: 'c1', from: 't', to: 'l'),
        Connection(id: 'c2', from: 'l', to: 'w'),
      ],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf);

    expect(res.status, 'success');
    expect(res.results['l'], {'iterations': 3});
    // write node ran 3 times; last iteration wrote "3"
    expect(File(pjoin(tmp, 'sum.txt')).readAsStringSync(), '3');
  });

  test('filter keeps matching items', () async {
    final wf = Workflow(
      name: 'filter-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('f', 'filter', {
          'items': '[1, 2, 3, 4, 5]',
          'expression': 'item > 2',
          'variable': 'big'
        }),
        node('x', 'transform', {'expression': 'vars.big.length'}),
      ],
      connections: [
        Connection(id: 'c1', from: 't', to: 'f'),
        Connection(id: 'c2', from: 'f', to: 'x'),
      ],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf);

    expect(res.status, 'success');
    final f = res.results['f'] as Map<String, dynamic>;
    expect(f['kept'], 3);
    expect(res.results['x'], 3);
  });

  test('condition passes and fails', () async {
    final wf = Workflow(
      name: 'cond-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('c', 'condition', {'expression': 'data.score >= 70'}),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'c')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    var r1 = await engine.run(wf, webhookPayload: {'score': 85});
    expect((r1.results['c'] as Map)['passed'], true);
    var r2 = await engine.run(wf, webhookPayload: {'score': 40});
    expect((r2.results['c'] as Map)['passed'], false);
  });

  test('transform computes expression on data', () async {
    final wf = Workflow(
      name: 'xform-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('x', 'transform', {'expression': 'data.a + data.b'}),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'x')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf, webhookPayload: {'a': 20, 'b': 22});
    expect(res.results['x'], 42);
  });

  test('http action calls a real local server', () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    server.listen((req) async {
      final b = await utf8.decoder.bind(req).join();
      req.response
        ..headers.contentType = ContentType.json
        ..write(jsonEncode({'received': b, 'method': req.method}))
        ..close();
    });
    final port = server.port;

    final wf = Workflow(
      name: 'http-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('h', 'action', {
          'actionType': 'HTTP Request',
          'url': 'http://127.0.0.1:$port/echo',
          'method': 'POST',
          'body': {'msg': 'hello {{data.who}}'},
        }),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'h')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf, webhookPayload: {'who': 'mobile'});

    expect(res.status, 'success');
    final h = res.results['h'] as Map<String, dynamic>;
    expect(h['ok'], true);
    expect((h['body'] as Map)['method'], 'POST');
    expect(jsonDecode((h['body'] as Map)['received']), {'msg': 'hello mobile'});
    await server.close(force: true);
  });

  test('delay action returns delayed ms', () async {
    final wf = Workflow(
      name: 'delay-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('d', 'action', {'actionType': 'Delay', 'ms': 10}),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'd')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf);
    expect(res.results['d'], {'delayed': 10});
  });

  test('desktop-only actions skip with reason', () async {
    final wf = Workflow(
      name: 'skip-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('p', 'action', {'actionType': 'PDF Generate'}),
        node('o', 'action', {'actionType': 'OCR'}),
        node('z', 'action', {'actionType': 'Database'}),
      ],
      connections: [
        Connection(id: 'c1', from: 't', to: 'p'),
        Connection(id: 'c2', from: 'p', to: 'o'),
        Connection(id: 'c3', from: 'o', to: 'z'),
      ],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf);
    expect(res.status, 'success');
    expect((res.results['p'] as Map)['reason'], 'desktop-only');
    expect((res.results['o'] as Map)['reason'], 'desktop-only');
    expect((res.results['z'] as Map)['reason'], 'desktop-only');
  });

  test('webhook trigger warns without payload but still runs', () async {
    final wf = Workflow(
      name: 'webhook-test',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Webhook'}),
        node('x', 'transform', {'expression': 'data.name ?? "none"'}),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'x')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf);
    expect(res.status, 'success');
    expect(res.results['x'], 'none');
  });

}