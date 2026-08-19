import 'dart:async';
import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;

import '../models/workflow.dart';
import 'interpolate.dart';
import 'eval.dart';
import 'pdf_gen.dart';

typedef LogFn = void Function(String level, String message);
typedef NodeFn = void Function(String id, String state);

class EngineResult {
  final String status;
  final dynamic lastOutput;
  final int durationMs;
  final Map<String, dynamic> results;
  EngineResult({
    required this.status,
    this.lastOutput,
    required this.durationMs,
    required this.results,
  });
}

class _Ctx {
  dynamic lastOutput;
  final Map<String, dynamic> vars = {};
}

class AutomationEngine {
  final Map<String, String> secrets;
  final LogFn? onLog;
  final NodeFn? onNode;
  final String baseDir;

  late List<FlowNode> _order;

  AutomationEngine({
    this.secrets = const {},
    this.onLog,
    this.onNode,
    this.baseDir = '',
  });

  List<FlowNode> _buildOrder(List<FlowNode> nodes, List<Connection> conns) {
    final byId = {for (var n in nodes) n.id: n};
    final indeg = {for (var n in nodes) n.id: 0};
    final adj = <String, List<String>>{};
    for (final c in conns) {
      if (byId.containsKey(c.from) && byId.containsKey(c.to)) {
        adj.putIfAbsent(c.from, () => []).add(c.to);
        indeg[c.to] = (indeg[c.to] ?? 0) + 1;
      }
    }
    final q = <String>[];
    // triggers first, then others with no incoming edges
    for (final n in nodes) {
      if ((indeg[n.id] ?? 0) == 0) q.add(n.id);
    }
    if (q.isEmpty && nodes.isNotEmpty) q.add(nodes.first.id);
    final seen = <String>{};
    final order = <FlowNode>[];
    while (q.isNotEmpty) {
      final id = q.removeAt(0);
      if (seen.contains(id)) continue;
      seen.add(id);
      order.add(byId[id]!);
      for (final nxt in adj[id] ?? []) {
        indeg[nxt] = (indeg[nxt] ?? 1) - 1;
        if ((indeg[nxt] ?? 0) <= 0) q.add(nxt);
      }
    }
    for (final n in nodes) {
      if (!seen.contains(n.id)) order.add(n);
    }
    // auto-layout positions for canvas if missing
    double y = 40;
    for (final n in order) {
      if (n.x == 0 && n.y == 0) {
        n.y = y;
        n.x = 40;
        y += 90;
      }
    }
    return order;
  }

  Future<EngineResult> run(Workflow wf, {Map<String, dynamic>? webhookPayload}) async {
    _order = _buildOrder(wf.nodes, wf.connections);
    final trigger = _order.where((n) => n.type == 'trigger').firstOrNull;
    final ctx = _Ctx();
    if (webhookPayload != null) ctx.lastOutput = webhookPayload;
    final results = <String, dynamic>{};
    final start = DateTime.now();

    final tt = trigger == null
        ? ''
        : (trigger.config['triggerType'] ?? 'Manual')
            .toString()
            .toLowerCase()
            .replaceAll(' ', '-');

    if (tt == 'webhook' && webhookPayload == null) {
      onLog?.call('warn', 'Webhook trigger needs a payload on mobile — use "Run with payload".');
    }
    if (tt == 'file-watch' || tt == 'filewatch') {
      onLog?.call('warn', 'File-watch trigger is desktop-only; running once with current state.');
    }
    if (tt == 'mqtt') {
      onLog?.call('warn', 'MQTT trigger is desktop-only; running once with current state.');
    }

    final inLoop = <String>{};
    for (final n in wf.nodes) {
      if (n.type == 'loop') {
        final stack = <String>[n.id];
        while (stack.isNotEmpty) {
          final id = stack.removeLast();
          for (final c in wf.connections) {
            if (c.from == id && !inLoop.contains(c.to)) {
              inLoop.add(c.to);
              stack.add(c.to);
            }
          }
        }
      }
    }
    final body = _order
        .where((n) => n.id != trigger?.id && !inLoop.contains(n.id))
        .toList();
    try {
      for (final node in body) {
        results[node.id] = await _runNode(node, ctx, results);
      }
    } catch (e) {
      return EngineResult(
        status: 'failed',
        lastOutput: ctx.lastOutput,
        durationMs: DateTime.now().difference(start).inMilliseconds,
        results: results,
      );
    }
    return EngineResult(
      status: 'success',
      lastOutput: ctx.lastOutput,
      durationMs: DateTime.now().difference(start).inMilliseconds,
      results: results,
    );
  }

  dynamic _resolve(String name, dynamic item, _Ctx ctx) {
    final parts = name.split('.');
    dynamic v;
    if (parts[0] == 'item') {
      v = item;
    } else if (parts[0] == 'vars') {
      v = ctx.vars;
    } else if (parts[0] == 'data') {
      v = ctx.lastOutput;
    } else {
      v = ctx.vars[name] ?? ctx.lastOutput;
    }
    for (final p in parts.skip(1)) {
      if (v is List && p == 'length') {
        v = v.length;
      } else if (v is Map) {
        v = v[p];
      } else {
        return null;
      }
    }
    return v;
  }

  Future<dynamic> _runNode(FlowNode node, _Ctx ctx, Map<String, dynamic> results) async {
    onNode?.call(node.id, 'running');
    try {
      dynamic out;
      switch (node.type) {
        case 'trigger':
          out = {'triggered': true, 'type': node.config['triggerType']};
          break;
        case 'action':
          out = await _runAction(node, ctx);
          ctx.lastOutput = out;
          break;
        case 'setvar':
          final name = node.config['variable']?.toString() ?? 'var';
          final raw = node.config['value']?.toString() ?? '';
          final val = coerce(interpolate(raw, ctx.lastOutput, ctx.vars));
          ctx.vars[name] = val;
          out = {name: val};
          break;
        case 'loop':
          out = await _runLoop(node, ctx, results);
          break;
        case 'filter':
          out = _runFilter(node, ctx);
          ctx.lastOutput = out;
          break;
        case 'condition':
          final expr = node.config['expression']?.toString() ?? 'true';
          final pass = truthy(ExprEvaluator(expr, (n) => _resolve(n, ctx.lastOutput, ctx)).parse());
          out = {'passed': pass};
          onLog?.call(pass ? 'info' : 'warn',
              '${node.name}: condition ${pass ? 'passed' : 'failed'}');
          ctx.lastOutput = out;
          break;
        case 'transform':
          final expr = node.config['expression']?.toString() ?? 'data';
          final v = ExprEvaluator(expr, (n) => _resolve(n, ctx.lastOutput, ctx)).parse();
          ctx.lastOutput = v;
          out = v;
          break;
        case 'custom':
          out = {'skipped': true, 'reason': 'no-js-runtime-on-mobile'};
          onLog?.call('warn', '${node.name}: Custom JS not executed on mobile.');
          break;
        default:
          out = null;
      }
      results[node.id] = out;
      onNode?.call(node.id, 'success');
      return out;
    } catch (e) {
      onNode?.call(node.id, 'error');
      onLog?.call('error', '${node.name}: $e');
      rethrow;
    }
  }

  Future<dynamic> _runAction(FlowNode node, _Ctx ctx) async {
    final cfg = node.config;
    final type = (cfg['actionType'] ?? '').toString().toLowerCase().trim();
    switch (type) {
      case 'http request':
      case 'http':
        return _http(cfg, ctx);
      case 'delay':
        final ms = int.tryParse(cfg['ms']?.toString() ?? cfg['duration']?.toString() ?? '0') ?? 0;
        await Future.delayed(Duration(milliseconds: ms));
        return {'delayed': ms};
      case 'write file':
      case 'file write':
        final rel = interpolate(cfg['path'] ?? 'output.txt', ctx.lastOutput, ctx.vars);
        final content = interpolate(cfg['content'] ?? '', ctx.lastOutput, ctx.vars);
        final file = File(p.join(baseDir, rel));
        await file.parent.create(recursive: true);
        await file.writeAsString(content);
        return {'written': true, 'path': rel};
      case 'read file':
        final rel = interpolate(cfg['path'] ?? '', ctx.lastOutput, ctx.vars);
        final file = File(p.join(baseDir, rel));
        return file.existsSync() ? file.readAsStringSync() : '';
      case 'notify':
        final msg = interpolate(cfg['message'] ?? '', ctx.lastOutput, ctx.vars);
        onLog?.call('notify', msg);
        return {'notified': true, 'message': msg};
      case 'email':
        return _email(cfg, ctx);
      case 'ai completion':
      case 'ai':
        return _ai(cfg, ctx);
      case 'telegram':
      case 'telegram bot':
        return _telegram(cfg, ctx);
      case 'slack':
      case 'slack message':
        return _slack(cfg, ctx);
      case 'ocr':
        onLog?.call('warn', 'OCR needs the desktop engine (AI vision); skipped on mobile.');
        return {'skipped': true, 'reason': 'desktop-only'};
      case 'pdf generate':
        return _pdfGenerate(cfg, ctx);
      case 'pdf extract':
      case 'database':
        onLog?.call('warn', '$type is desktop-only; skipped on mobile.');
        return {'skipped': true, 'reason': 'desktop-only'};
      default:
        onLog?.call('warn', 'Action "$type" not supported on mobile; skipped.');
        return {'skipped': true, 'reason': 'unsupported-on-mobile'};
    }
  }

  Future<dynamic> _http(Map<String, dynamic> cfg, _Ctx ctx) async {
    final url = interpolate(cfg['url'] ?? '', ctx.lastOutput, ctx.vars);
    if (url.isEmpty) throw Exception('HTTP request requires a URL');
    final method = (cfg['method'] ?? 'GET').toString().toUpperCase();
    final headers = <String, String>{};
    (cfg['headers'] as Map? ?? {}).forEach((k, v) {
      headers[k.toString()] = interpolate(v.toString(), ctx.lastOutput, ctx.vars);
    });
    dynamic body = cfg['body'];
    if (body is String) {
      body = interpolate(body, ctx.lastOutput, ctx.vars);
    } else if (body is Map) {
      body = interpolateMap(Map<String, dynamic>.from(body), ctx.lastOutput, ctx.vars);
    }

    final req = http.Request(method, Uri.parse(url));
    req.headers.addAll(headers);
    if (body != null && method != 'GET' && method != 'HEAD') {
      req.body = body is String ? body : jsonEncode(body);
      req.headers['Content-Type'] = req.headers['Content-Type'] ?? 'application/json';
    }
    final streamed = await req.send();
    final resp = await http.Response.fromStream(streamed);
    dynamic parsed;
    try {
      parsed = jsonDecode(resp.body);
    } catch (_) {
      parsed = resp.body;
    }
    return {
      'status': resp.statusCode,
      'ok': resp.statusCode >= 200 && resp.statusCode < 300,
      'body': parsed,
    };
  }

  Future<dynamic> _ai(Map<String, dynamic> cfg, _Ctx ctx) async {
    final provider = (cfg['provider'] ?? 'openai').toString().toLowerCase();
    final key = secrets['ai_$provider'] ?? secrets['ai_key'] ?? '';
    if (key.isEmpty) {
      onLog?.call('warn', 'No AI key for $provider');
      return {'skipped': true, 'reason': 'no-key'};
    }
    final prompt = interpolate(cfg['prompt'] ?? cfg['input'] ?? '', ctx.lastOutput, ctx.vars);
    if (provider == 'anthropic') {
      final res = await http.post(
        Uri.parse('https://api.anthropic.com/v1/messages'),
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: jsonEncode({
          'model': cfg['model'] ?? 'claude-3-haiku-20240307',
          'max_tokens': int.tryParse(cfg['maxTokens']?.toString() ?? '512') ?? 512,
          'messages': [
            {'role': 'user', 'content': prompt}
          ],
        }),
      );
      final j = jsonDecode(res.body);
      return {'text': j['content']?.first?['text'] ?? '', 'raw': j};
    }
    final res = await http.post(
      Uri.parse('https://api.openai.com/v1/chat/completions'),
      headers: {'authorization': 'Bearer $key', 'content-type': 'application/json'},
      body: jsonEncode({
        'model': cfg['model'] ?? 'gpt-4o-mini',
        'messages': [
          {'role': 'user', 'content': prompt}
        ],
      }),
    );
    final j = jsonDecode(res.body);
    return {'text': j['choices']?[0]?['message']?['content'] ?? '', 'raw': j};
  }

  Future<dynamic> _telegram(Map<String, dynamic> cfg, _Ctx ctx) async {
    final token = secrets['telegram_token'] ?? cfg['token']?.toString() ?? '';
    final chat = secrets['telegram_chat'] ?? cfg['chat']?.toString() ?? '';
    if (token.isEmpty || chat.isEmpty) {
      onLog?.call('warn', 'Telegram needs telegram_token + telegram_chat secrets');
      return {'skipped': true, 'reason': 'no-secrets'};
    }
    final text = interpolate(cfg['message'] ?? cfg['text'] ?? '', ctx.lastOutput, ctx.vars);
    final res = await http.post(
      Uri.parse('https://api.telegram.org/bot$token/sendMessage'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'chat_id': chat, 'text': text}),
    );
    return {'status': res.statusCode, 'ok': res.statusCode == 200};
  }

  Future<dynamic> _slack(Map<String, dynamic> cfg, _Ctx ctx) async {
    final url = secrets['slack_webhook'] ??
        cfg['webhook']?.toString() ??
        cfg['slackWebhook']?.toString() ??
        '';
    if (url.isEmpty) {
      onLog?.call('warn', 'Slack needs slack_webhook secret');
      return {'skipped': true, 'reason': 'no-secret'};
    }
    final text = interpolate(
        cfg['message'] ?? cfg['slackMessage'] ?? cfg['text'] ?? '', ctx.lastOutput, ctx.vars);
    final res = await http.post(
      Uri.parse(url),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({'text': text}),
    );
    return {'status': res.statusCode, 'ok': res.statusCode == 200};
  }

  Future<dynamic> _email(Map<String, dynamic> cfg, _Ctx ctx) async {
    final to = interpolate(cfg['to']?.toString() ?? '', ctx.lastOutput, ctx.vars);
    final subject = interpolate(cfg['subject']?.toString() ?? '', ctx.lastOutput, ctx.vars);
    if (to.isEmpty || subject.isEmpty) throw Exception('Email requires to + subject');
    final host = secrets['smtp_host'] ?? cfg['smtpHost']?.toString() ?? '';
    final user = secrets['smtp_user'] ?? cfg['smtpUser']?.toString() ?? '';
    final pass = secrets['smtp_pass'] ?? cfg['smtpPass']?.toString() ?? '';
    if (host.isEmpty || user.isEmpty || pass.isEmpty) {
      onLog?.call('warn', 'No SMTP secret; skipping email to $to');
      return {'skipped': true, 'reason': 'no-smtp-secret'};
    }
    final port = int.tryParse(secrets['smtp_port'] ?? '') ?? 587;
    final secure = (secrets['smtp_secure'] ?? 'false') == 'true';
    final from = interpolate(cfg['from']?.toString() ?? '', ctx.lastOutput, ctx.vars);
    final text = interpolate(cfg['text']?.toString() ?? '', ctx.lastOutput, ctx.vars);
    final html = interpolate(cfg['html']?.toString() ?? '', ctx.lastOutput, ctx.vars);
    final msg = StringBuffer()
      ..writeln('From: ${from.isEmpty ? user : from}')
      ..writeln('To: $to')
      ..writeln('Subject: $subject')
      ..writeln('MIME-Version: 1.0')
      ..writeln(
          'Content-Type: ${html.isEmpty ? 'text/plain' : 'text/html'}; charset=utf-8')
      ..writeln()
      ..write(html.isEmpty ? text : html);
    final messageId =
        await _smtpSend(host, port, secure, user, pass, to, msg.toString());
    return {'sent': true, 'messageId': messageId};
  }

  Future<String> _smtpSend(String host, int port, bool secure, String user,
      String pass, String to, String message) async {
    Socket socket;
    if (secure) {
      socket = await SecureSocket.connect(host, port,
          timeout: const Duration(seconds: 30));
    } else {
      socket = await Socket.connect(host, port,
          timeout: const Duration(seconds: 30));
    }
    socket.timeout(const Duration(seconds: 60));
    var rd = _SmtpReader(socket);

    Future<String> expect(int code) async {
      final l = await rd.next();
      if (!l.startsWith('$code')) {
        socket.destroy();
        throw Exception('SMTP error (expected $code): $l');
      }
      return l;
    }

    await expect(220);
    socket.write('EHLO maurya.local\r\n');
    final ehlo = <String>[await rd.next()];
    while (ehlo.last.startsWith('250-')) {
      ehlo.add(await rd.next());
    }
    if (!ehlo.last.startsWith('250')) {
      socket.destroy();
      throw Exception('SMTP EHLO failed: ${ehlo.last}');
    }
    if (!secure && ehlo.any((l) => l.toUpperCase().contains('STARTTLS'))) {
      socket.write('STARTTLS\r\n');
      await expect(220);
      socket = await SecureSocket.secure(socket);
      rd = _SmtpReader(socket);
      socket.write('EHLO maurya.local\r\n');
      var l = await rd.next();
      while (l.startsWith('250-')) {
        l = await rd.next();
      }
    }
    socket.write('AUTH LOGIN\r\n');
    await expect(334);
    socket.write('${base64Encode(utf8.encode(user))}\r\n');
    await expect(334);
    socket.write('${base64Encode(utf8.encode(pass))}\r\n');
    await expect(235);
    socket.write('MAIL FROM:<$user>\r\n');
    await expect(250);
    socket.write('RCPT TO:<$to>\r\n');
    await expect(250);
    socket.write('DATA\r\n');
    await expect(354);
    socket.write(
        '${message.replaceAll('\r\n', '\n').replaceAll('\n', '\r\n')}\r\n.\r\n');
    final done = await rd.next();
    String? messageId;
    if (done.startsWith('250')) {
      final m =
          RegExp(r'id=\s*<([^>]+)>', caseSensitive: false).firstMatch(done);
      messageId = m?.group(1);
    }
    socket.write('QUIT\r\n');
    await socket.flush();
    socket.destroy();
    return messageId ?? '';
  }

  Future<dynamic> _pdfGenerate(Map<String, dynamic> cfg, _Ctx ctx) async {
    final title = interpolate(
        cfg['title']?.toString() ??
            cfg['pdfTitle']?.toString() ??
            'Maurya Automation Document',
        ctx.lastOutput,
        ctx.vars);
    final content = interpolate(
        cfg['content']?.toString() ?? cfg['pdfContent']?.toString() ?? '',
        ctx.lastOutput,
        ctx.vars);
    final footerRaw = cfg['footer']?.toString() ?? cfg['pdfFooter']?.toString();
    final footer =
        footerRaw == null ? null : interpolate(footerRaw, ctx.lastOutput, ctx.vars);
    final rel = interpolate(
        cfg['path']?.toString() ?? cfg['pdfPath']?.toString() ?? 'document.pdf',
        ctx.lastOutput,
        ctx.vars);
    final pdf = PdfDocument(title: title, content: content, footer: footer);
    final bytes = pdf.build();
    final file = File(p.join(baseDir, rel));
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes);
    return {'generated': true, 'path': rel, 'bytes': bytes.length};
  }

  Future<dynamic> _runLoop(FlowNode node, _Ctx ctx, Map<String, dynamic> results) async {
    final items = _parseArray(node.config['items'], ctx.lastOutput, ctx.vars);
    final name = node.config['variable']?.toString() ?? 'item';
    final idx = _order.indexWhere((n) => n.id == node.id);
    final bodyNodes = _order.sublist(idx + 1).where((n) => n.type != 'trigger').toList();
    var i = 0;
    for (final item in items) {
      ctx.vars[name] = item;
      ctx.lastOutput = item;
      onLog?.call('info', 'Loop ${i + 1}/${items.length}');
      for (final bn in bodyNodes) {
        results[bn.id] = await _runNode(bn, ctx, results);
      }
      i++;
    }
    return {'iterations': items.length};
  }

  dynamic _runFilter(FlowNode node, _Ctx ctx) {
    final items = _parseArray(node.config['items'], ctx.lastOutput, ctx.vars);
    final expr = node.config['expression']?.toString() ?? 'true';
    final kept = items.where((it) {
      return truthy(ExprEvaluator(expr, (n) => _resolve(n, it, ctx)).parse());
    }).toList();
    final name = node.config['variable']?.toString() ?? 'filtered';
    ctx.vars[name] = kept;
    return {'kept': kept.length, 'items': kept};
  }

  List _parseArray(dynamic raw, dynamic data, Map<String, dynamic> vars) {
    if (raw is List) return raw;
    if (raw is String) {
      final s = interpolate(raw, data, vars);
      try {
        final j = jsonDecode(s);
        return j is List ? j : [j];
      } catch (_) {
        try {
          final v = ExprEvaluator(s, (n) => _resolve(n, data, _Ctx()..vars.addAll(vars))).parse();
          if (v is List) return v;
        } catch (_) {}
        return [s];
      }
    }
    return [];
  }
}

class _SmtpReader {
  final Socket socket;
  final StringBuffer _buf = StringBuffer();
  final List<Completer<String>> _waiters = [];
  bool _started = false;

  _SmtpReader(this.socket);

  void _ensureListening() {
    if (_started) return;
    _started = true;
    socket.listen((chunk) {
      _buf.write(utf8.decode(chunk));
      _pump();
    }, onError: (Object e) {
      _failAll(e);
    }, onDone: () {
      _failAll(StateError('SMTP connection closed'));
    });
  }

  void _failAll(Object e) {
    for (final w in _waiters) {
      if (!w.isCompleted) w.completeError(e);
    }
    _waiters.clear();
  }

  void _pump() {
    while (_waiters.isNotEmpty && _buf.toString().contains('\n')) {
      final all = _buf.toString();
      final idx = all.indexOf('\n');
      final line = all.substring(0, idx).trim();
      _buf.clear();
      _buf.write(all.substring(idx + 1));
      final w = _waiters.removeAt(0);
      w.complete(line);
    }
  }

  Future<String> next() {
    _ensureListening();
    final c = Completer<String>();
    _waiters.add(c);
    _pump();
    return c.future.timeout(const Duration(seconds: 60));
  }
}
