import 'dart:io';
import 'dart:convert';

/// Local HTTP server that receives webhook POSTs (like the desktop app).
/// Each workflow with a Webhook trigger gets its own server on its port.
class WebhookServer {
  HttpServer? _server;
  String? _url;

  bool get running => _server != null;
  String? get url => _url;
  int get port => _server?.port ?? 0;

  Future<bool> start({
    required int port,
    required String path,
    required String method,
    required Future<Map<String, dynamic>?> Function(Map<String, dynamic> body)
        handler,
  }) async {
    if (_server != null) return true;
    try {
      final server = await HttpServer.bind(InternetAddress.anyIPv4, port);
      _server = server;
      server.listen((req) async {
        if (req.method.toUpperCase() != method.toUpperCase() ||
            !_matches(req.uri.path, path)) {
          req.response.statusCode = 404;
          req.response.write('Not found');
          await req.response.close();
          return;
        }
        final bodyText = await utf8.decoder.bind(req).join();
        Map<String, dynamic>? payload;
        try {
          final j = jsonDecode(bodyText);
          payload = j is Map ? Map<String, dynamic>.from(j) : {'raw': j};
        } catch (_) {
          payload = bodyText.trim().isEmpty ? null : {'raw': bodyText};
        }
        try {
          final result = await handler(payload ?? {});
          req.response
            ..headers.contentType = ContentType.json
            ..write(jsonEncode(result ?? {'ok': true}))
            ..close();
        } catch (e) {
          req.response.statusCode = 500;
          req.response
            ..headers.contentType = ContentType.json
            ..write(jsonEncode({'error': e.toString()}))
            ..close();
        }
      });
      _url = 'http://${await _localIp()}:${server.port}$path';
      return true;
    } catch (_) {
      return false;
    }
  }

  bool _matches(String uriPath, String expected) {
    var p = expected;
    if (!p.startsWith('/')) p = '/$p';
    if (p.endsWith('/')) p = p.substring(0, p.length - 1);
    var u = uriPath;
    if (u.endsWith('/')) u = u.substring(0, u.length - 1);
    return u == p;
  }

  Future<String> _localIp() async {
    try {
      final interfaces = await NetworkInterface.list(
          type: InternetAddressType.IPv4, includeLoopback: false);
      for (final i in interfaces) {
        for (final a in i.addresses) {
          if (!a.isLoopback) return a.address;
        }
      }
    } catch (_) {}
    return '127.0.0.1';
  }

  Future<void> stop() async {
    await _server?.close(force: true);
    _server = null;
    _url = null;
  }
}