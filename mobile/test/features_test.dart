import 'dart:io';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:maurya_automation/engine/engine.dart';
import 'package:maurya_automation/models/workflow.dart';
import 'package:maurya_automation/services/webhook_server.dart';

String pjoin(Directory tmp, String name) =>
    '${tmp.path}${Platform.pathSeparator}$name';

FlowNode node(String id, String type, Map<String, dynamic> config,
        {String name = ''}) =>
    FlowNode(id: id, type: type, name: name.isEmpty ? id : name, config: config);

void main() {
  late Directory tmp;

  setUp(() => tmp = Directory.systemTemp.createTempSync('features_test'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('webhook server receives POST and runs the workflow', () async {
    final wf = Workflow(
      name: 'wh',
      nodes: [
        node('t', 'trigger', {
          'triggerType': 'Webhook',
          'webhookPort': '0',
          'webhookPath': '/hook',
          'webhookMethod': 'POST',
        }),
        node('x', 'transform', {'expression': '"Namaste " + data.msg'}),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'x')],
    );

    final server = WebhookServer();
    final ok = await server.start(
      port: 0,
      path: '/hook',
      method: 'POST',
      handler: (payload) async {
        final engine = AutomationEngine(baseDir: tmp.path);
        final r = await engine.run(wf, webhookPayload: payload);
        return {'status': r.status, 'output': r.lastOutput};
      },
    );
    expect(ok, true);

    final res = await http.post(
      Uri.parse('http://127.0.0.1:${server.port}/hook'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'msg': 'duniya'}),
    );
    expect(res.statusCode, 200);
    final j = jsonDecode(res.body) as Map;
    expect(j['status'], 'success');
    expect(j['output'], 'Namaste duniya');

    final notFound =
        await http.get(Uri.parse('http://127.0.0.1:${server.port}/wrong'));
    expect(notFound.statusCode, 404);

    await server.stop();
    expect(server.running, false);
  });

  test('pdf generate writes a valid PDF file', () async {
    final wf = Workflow(
      name: 'pdf',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('p', 'action', {
          'actionType': 'PDF Generate',
          'title': 'Invoice',
          'content': 'Client: {{data.client}\nAmount: Rs 100',
          'path': 'inv.pdf',
        }),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'p')],
    );

    final engine = AutomationEngine(baseDir: tmp.path);
    final res = await engine.run(wf, webhookPayload: {'client': 'Dinesh'});
    expect(res.status, 'success');
    expect((res.results['p'] as Map)['generated'], true);

    final f = File(pjoin(tmp, 'inv.pdf'));
    expect(f.existsSync(), true);
    final bytes = f.readAsBytesSync();
    expect(String.fromCharCodes(bytes.take(8)), '%PDF-1.4');
    expect(bytes.length, greaterThan(500));
  });

  test('email action sends via SMTP (mock server)', () async {
    final server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final dataLines = <String>[];
    final authPayloads = <String>[];
    var authCount = 0;
    var inData = false;
    server.listen((socket) {
      socket.write('220 mock SMTP ready\r\n');
      var buf = StringBuffer();
      socket.listen((chunk) {
        buf.write(utf8.decode(chunk));
        while (true) {
          final all = buf.toString();
          final idx = all.indexOf('\n');
          if (idx < 0) break;
          final line = all.substring(0, idx).trim();
          buf.clear();
          buf.write(all.substring(idx + 1));
          final up = line.toUpperCase();
          if (inData) {
            dataLines.add(line);
            if (line == '.') {
              inData = false;
              socket.write('250 2.0.0 OK id=<mock-1@test>\r\n');
            }
          } else if (up.startsWith('EHLO')) {
            socket.write('250-localhost\r\n250 OK\r\n');
          } else if (up == 'AUTH LOGIN') {
            socket.write('334 VXNlcm5hbWU6\r\n');
          } else if (up.startsWith('MAIL FROM')) {
            socket.write('250 2.1.0 OK\r\n');
          } else if (up.startsWith('RCPT TO')) {
            socket.write('250 2.1.5 OK\r\n');
          } else if (up == 'DATA') {
            inData = true;
            socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
          } else if (up == 'QUIT') {
            socket.write('221 2.0.0 Bye\r\n');
            socket.destroy();
          } else {
            authPayloads.add(line);
            authCount++;
            if (authCount == 1) {
              socket.write('334 UGFzc3dvcmQ6\r\n');
            } else {
              socket.write('235 2.7.0 Authentication successful\r\n');
            }
          }
        }
      });
    });

    final wf = Workflow(
      name: 'mail',
      nodes: [
        node('t', 'trigger', {'triggerType': 'Manual'}),
        node('e', 'action', {
          'actionType': 'Email',
          'to': 'to@example.com',
          'subject': 'Test subject',
          'text': 'Namaste {{data.who}}',
        }),
      ],
      connections: [Connection(id: 'c1', from: 't', to: 'e')],
    );

    final engine = AutomationEngine(
      baseDir: tmp.path,
      onLog: (l, m) => print('ENGINE LOG [$l] $m'),
      secrets: {
        'smtp_host': '127.0.0.1',
        'smtp_port': '${server.port}',
        'smtp_user': 'user@example.com',
        'smtp_pass': 'secret',
      },
    );
    final res = await engine.run(wf, webhookPayload: {'who': 'phone'});
    expect(res.status, 'success');
    expect((res.results['e'] as Map)['sent'], true);
    expect((res.results['e'] as Map)['messageId'], 'mock-1@test');

    final msg = dataLines.join('\n');
    expect(msg, contains('Subject: Test subject'));
    expect(msg, contains('To: to@example.com'));
    expect(msg, contains('Namaste phone'));
    expect(authPayloads.length, 2);
    expect(base64Decode(authPayloads[0]), utf8.encode('user@example.com'));

    await server.close();
  });
}