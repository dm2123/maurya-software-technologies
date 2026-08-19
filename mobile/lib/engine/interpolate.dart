import 'dart:convert';

String interpolate(String input, dynamic data, Map<String, dynamic> vars) {
  if (input.isEmpty) return input;
  return input.replaceAllMapped(RegExp(r'\{\{\s*([\w.]+)\s*\}\}'), (m) {
    final parts = m[1]!.split('.');
    final rootName = parts[0];
    dynamic root = rootName == 'vars' ? vars : data;
    dynamic v = root;
    for (final p in parts.skip(1)) {
      if (v is Map) {
        v = v[p];
      } else {
        v = null;
        break;
      }
    }
    if (v == null) return '';
    if (v is String) return v;
    if (v is Map || v is List) return jsonEncode(v);
    return v.toString();
  });
}

Map<String, dynamic> interpolateMap(Map<String, dynamic> map, dynamic data, Map<String, dynamic> vars) {
  return map.map((k, v) {
    if (v is String) return MapEntry(k, interpolate(v, data, vars));
    if (v is Map) return MapEntry(k, interpolateMap(Map<String, dynamic>.from(v), data, vars));
    if (v is List) return MapEntry(k, v.map((e) => e is String ? interpolate(e, data, vars) : e).toList());
    return MapEntry(k, v);
  });
}

dynamic coerce(dynamic v) {
  if (v is bool || v is num) return v;
  if (v is String) {
    final n = num.tryParse(v);
    if (n != null) return n;
    if (v == 'true') return true;
    if (v == 'false') return false;
  }
  return v;
}

bool truthy(dynamic v) {
  if (v == null) return false;
  if (v is bool) return v;
  if (v is num) return v != 0;
  if (v is String) return v.isNotEmpty;
  if (v is List) return v.isNotEmpty;
  if (v is Map) return v.isNotEmpty;
  return true;
}
