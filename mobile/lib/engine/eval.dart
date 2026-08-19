import 'interpolate.dart';

/// Minimal expression evaluator for condition / transform / filter nodes.
/// Supports: numbers, 'strings', true/false/null, dotted identifiers
/// (item.x, vars.x, data.x), operators + - * / % , comparisons == != < > <= >=,
/// `contains`, logical && ||, unary ! and parentheses.
class ExprEvaluator {
  final List<_Tok> _toks;
  int _pos = 0;
  final dynamic Function(String) _resolve;

  ExprEvaluator(String src, this._resolve) : _toks = _tokenize(src);

  dynamic parse() {
    if (_toks.isEmpty) return true;
    final v = _or();
    return v;
  }

  bool get _ok => _pos < _toks.length;

  _Tok get _peek => _toks[_pos];
  _Tok _next() => _toks[_pos++];

  bool _is(String t) => _ok && _peek.type == t;

  dynamic _or() {
    var v = _and();
    while (_is('or')) {
      _next();
      final r = _and();
      v = truthy(v) || truthy(r);
    }
    return v;
  }

  dynamic _and() {
    var v = _equality();
    while (_is('and')) {
      _next();
      final r = _equality();
      v = truthy(v) && truthy(r);
    }
    return v;
  }

  dynamic _equality() {
    var v = _rel();
    while (_is('eq') || _is('ne') || _is('contains')) {
      final op = _next().type;
      final r = _rel();
      if (op == 'eq') {
        v = _equal(v, r);
      } else if (op == 'ne') {
        v = !_equal(v, r);
      } else {
        v = _contains(v, r);
      }
    }
    return v;
  }

  dynamic _rel() {
    var v = _add();
    while (_is('gt') || _is('lt') || _is('ge') || _is('le')) {
      final op = _next().type;
      final r = _add();
      final a = _num(v), b = _num(r);
      if (op == 'gt') v = a > b;
      if (op == 'lt') v = a < b;
      if (op == 'ge') v = a >= b;
      if (op == 'le') v = a <= b;
    }
    return v;
  }

  dynamic _add() {
    var v = _mul();
    while (_is('add') || _is('sub')) {
      final op = _next().type;
      final r = _mul();
      v = op == 'add'
          ? (_str(v) + _str(r))
          : (_num(v) + _num(r));
    }
    return v;
  }

  dynamic _mul() {
    var v = _unary();
    while (_is('mul') || _is('div') || _is('mod')) {
      final op = _next().type;
      final r = _unary();
      final a = _num(v), b = _num(r);
      if (op == 'mul') v = a * b;
      if (op == 'div') v = b == 0 ? 0 : a / b;
      if (op == 'mod') v = b == 0 ? 0 : a % b;
    }
    return v;
  }

  dynamic _unary() {
    if (_is('not')) {
      _next();
      return !truthy(_unary());
    }
    if (_is('neg')) {
      _next();
      return -_num(_unary());
    }
    return _primary();
  }

  dynamic _primary() {
    final t = _next();
    if (t.type == 'lparen') {
      final v = _or();
      if (_is('rparen')) _next();
      return v;
    }
    if (t.type == 'num') return double.parse(t.value).toDouble();
    if (t.type == 'str') return t.value;
    if (t.type == 'bool') return t.value == 'true';
    if (t.type == 'null') return null;
    if (t.type == 'neg') return -_num(_primary());
    if (t.type == 'ident') {
      final parts = t.value.split('.');
      dynamic v = _resolve(parts[0]);
      for (final p in parts.skip(1)) {
        if (v is Map) v = v[p];
        else return null;
      }
      return v;
    }
    return null;
  }

  bool _equal(dynamic a, dynamic b) {
    if (a is num && b is num) return a == b;
    return a?.toString() == b?.toString();
  }

  bool _contains(dynamic a, dynamic b) {
    if (a is String) return a.contains(b?.toString() ?? '');
    if (a is List) return a.any((e) => e?.toString() == b?.toString());
    if (a is Map) return a.containsKey(b?.toString());
    return false;
  }

  double _num(dynamic v) {
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v) ?? 0;
    return 0;
  }

  String _str(dynamic v) => v == null ? '' : v.toString();
}

class _Tok {
  final String type;
  final String value;
  _Tok(this.type, this.value);
}

List<_Tok> _tokenize(String s) {
  final tokens = <_Tok>[];
  int i = 0;
  bool isDigit(String c) => c.compareTo('0') >= 0 && c.compareTo('9') <= 0;
  bool isIdentStart(String c) =>
      (c.toUpperCase().compareTo('A') >= 0 && c.toUpperCase().compareTo('Z') <= 0) || c == '_';
  bool isIdentPart(String c) => isIdentStart(c) || isDigit(c);

  while (i < s.length) {
    final c = s[i];
    if (c == ' ' || c == '\n' || c == '\t' || c == '\r') { i++; continue; }
    if (c == '(') { tokens.add(_Tok('lparen', '(')); i++; continue; }
    if (c == ')') { tokens.add(_Tok('rparen', ')')); i++; continue; }
    if (c == '&' && i + 1 < s.length && s[i + 1] == '&') { tokens.add(_Tok('and', '&&')); i += 2; continue; }
    if (c == '|' && i + 1 < s.length && s[i + 1] == '|') { tokens.add(_Tok('or', '||')); i += 2; continue; }
    if (c == '=' && i + 1 < s.length && s[i + 1] == '=') { tokens.add(_Tok('eq', '==')); i += 2; continue; }
    if (c == '!' && i + 1 < s.length && s[i + 1] == '=') { tokens.add(_Tok('ne', '!=')); i += 2; continue; }
    if (c == '>') {
      if (i + 1 < s.length && s[i + 1] == '=') { tokens.add(_Tok('ge', '>=')); i += 2; }
      else { tokens.add(_Tok('gt', '>')); i++; }
      continue;
    }
    if (c == '<') {
      if (i + 1 < s.length && s[i + 1] == '=') { tokens.add(_Tok('le', '<=')); i += 2; }
      else { tokens.add(_Tok('lt', '<')); i++; }
      continue;
    }
    if (c == '+') { tokens.add(_Tok('add', '+')); i++; continue; }
    if (c == '*') { tokens.add(_Tok('mul', '*')); i++; continue; }
    if (c == '/') { tokens.add(_Tok('div', '/')); i++; continue; }
    if (c == '%') { tokens.add(_Tok('mod', '%')); i++; continue; }
    if (c == '!') { tokens.add(_Tok('not', '!')); i++; continue; }
    if (c == '-') {
      if (tokens.isEmpty || _isOp(tokens.last.type)) { tokens.add(_Tok('neg', '-')); i++; }
      else { tokens.add(_Tok('sub', '-')); i++; }
      continue;
    }
    if (c == '"' || c == "'") {
      final q = c;
      i++;
      final sb = StringBuffer();
      while (i < s.length && s[i] != q) { sb.write(s[i]); i++; }
      i++; // closing quote
      tokens.add(_Tok('str', sb.toString()));
      continue;
    }
    if (isDigit(c) || (c == '.' && i + 1 < s.length && isDigit(s[i + 1]))) {
      final sb = StringBuffer();
      while (i < s.length && (isDigit(s[i]) || s[i] == '.')) { sb.write(s[i]); i++; }
      tokens.add(_Tok('num', sb.toString()));
      continue;
    }
    if (isIdentStart(c)) {
      final sb = StringBuffer();
      while (i < s.length && isIdentPart(s[i])) { sb.write(s[i]); i++; }
      final w = sb.toString();
      if (w == 'true') { tokens.add(_Tok('bool', 'true')); }
      else if (w == 'false') { tokens.add(_Tok('bool', 'false')); }
      else if (w == 'null') { tokens.add(_Tok('null', 'null')); }
      else if (w == 'contains') { tokens.add(_Tok('contains', 'contains')); }
      else { tokens.add(_Tok('ident', w)); }
      continue;
    }
    i++; // skip unknown
  }
  return tokens;
}

bool _isOp(String t) =>
    const {'add', 'sub', 'mul', 'div', 'mod', 'eq', 'ne', 'gt', 'lt', 'ge', 'le', 'and', 'or', 'not', 'lparen'}
        .contains(t);
