import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/workflow.dart';

class CloudFile {
  final String gistId;
  final String filename;
  final String content;
  final String? url;
  final String? updatedAt;

  CloudFile({
    required this.gistId,
    required this.filename,
    required this.content,
    this.url,
    this.updatedAt,
  });
}

class CloudSyncService {
  static const String _api = 'https://api.github.com/gists';

  Map<String, String> _headers(String token) => {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
      };

  Future<List<CloudFile>> list(String token) async {
    final res = await http.get(Uri.parse(_api), headers: _headers(token));
    if (res.statusCode != 200) {
      throw Exception('GitHub returned ${res.statusCode}: ${res.body}');
    }
    final j = jsonDecode(res.body) as List? ?? [];
    final out = <CloudFile>[];
    for (final g in j) {
      final files = (g['files'] as Map? ?? {});
      files.forEach((name, meta) {
        if (name.toString().endsWith('.maurya.json')) {
          out.add(CloudFile(
            gistId: g['id'].toString(),
            filename: name.toString(),
            content: (meta['content'] ?? '').toString(),
            url: g['html_url']?.toString(),
            updatedAt: g['updated_at']?.toString(),
          ));
        }
      });
    }
    return out;
  }

  Future<CloudFile> push(String token, String? gistId, Workflow wf) async {
    final fileName =
        '${wf.name.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}.maurya.json';
    final content = jsonEncode(wf.toJson());
    if (gistId != null) {
      final res = await http.patch(
        Uri.parse('$_api/$gistId'),
        headers: _headers(token),
        body: jsonEncode({'files': {fileName: {'content': content}}}),
      );
      if (res.statusCode != 200) throw Exception('Gist update failed (${res.statusCode})');
      return CloudFile(gistId: gistId, filename: fileName, content: content);
    }
    final res = await http.post(
      Uri.parse(_api),
      headers: _headers(token),
      body: jsonEncode({
        'public': false,
        'description': 'Maurya Automation workflow',
        'files': {fileName: {'content': content}}
      }),
    );
    if (res.statusCode != 201) throw Exception('Gist create failed (${res.statusCode})');
    final j = jsonDecode(res.body) as Map;
    return CloudFile(
      gistId: j['id'].toString(),
      filename: fileName,
      content: content,
      url: j['html_url']?.toString(),
    );
  }
}
