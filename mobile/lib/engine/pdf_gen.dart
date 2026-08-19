import 'dart:convert';

/// Minimal dependency-free PDF generator (text pages, A4, Helvetica).
/// Mirrors the desktop "PDF Generate" action so the same workflow files
/// produce a real PDF on mobile too.
class PdfDocument {
  final String title;
  final String content;
  final String? footer;

  PdfDocument({required this.title, this.content = '', this.footer});

  static const double _w = 595.28;
  static const double _h = 841.89;
  static const double _lm = 50.0;
  static const int _linesPerPage = 44;

  List<String> get _lines {
    final out = <String>[];
    final t = _clean(title);
    if (t.isNotEmpty) out.add(t);
    out.add('');
    for (final line in content.split('\n')) {
      out.addAll(_wrap(_clean(line), 92));
    }
    final f = footer;
    if (f != null && f.trim().isNotEmpty) {
      out.add('');
      out.addAll(_wrap(_clean(f), 92));
    }
    if (out.isEmpty) out.add('');
    return out;
  }

  String _clean(String s) =>
      s.replaceAll(RegExp(r'[^\x20-\x7E]'), '?').trim();

  List<String> _wrap(String s, int max) {
    final words = s.split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    final lines = <String>[];
    var cur = '';
    for (final w in words) {
      if ('$cur $w'.trim().length > max) {
        if (cur.isNotEmpty) lines.add(cur);
        cur = w;
      } else {
        cur = '$cur $w'.trim();
      }
    }
    if (cur.isNotEmpty) lines.add(cur);
    return lines;
  }

  String _esc(String s) => s
      .replaceAll('\\', r'\\')
      .replaceAll('(', r'\(')
      .replaceAll(')', r'\)');

  List<int> build() {
    final lines = _lines;
    final pageCount = (lines.length / _linesPerPage).ceil();
    final streams = <String>[];
    for (var p = 0; p < pageCount; p++) {
      final pageLines = lines.sublist(
          p * _linesPerPage,
          (p + 1) * _linesPerPage > lines.length
              ? lines.length
              : (p + 1) * _linesPerPage);
      final cs = StringBuffer();
      cs.writeln(
          'BT /F1 16 Tf 1 0 0 1 $_lm ${_h - _lm - 24} Tm (${_esc(pageLines.first)}) Tj ET');
      if (pageLines.length > 1) {
        cs.writeln('BT /F1 11 Tf 1 0 0 1 $_lm ${_h - _lm - 54} Tm 14 TL');
        for (final l in pageLines.sublist(1)) {
          cs.writeln('(${_esc(l)}) Tj T*');
        }
        cs.writeln('ET');
      }
      cs.writeln('showpage');
      streams.add(cs.toString());
    }

    final out = StringBuffer();
    final offsets = <int>[];

    out.writeln('%PDF-1.4');
    offsets.add(out.length);
    out.writeln('1 0 obj');
    out.writeln('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    out.writeln('endobj');
    offsets.add(out.length);
    out.writeln('2 0 obj');
    out.writeln('<< /Type /Catalog /Pages 3 0 R >>');
    out.writeln('endobj');
    final kids =
        List.generate(pageCount, (i) => '${4 + 2 * i} 0 R').join(' ');
    offsets.add(out.length);
    out.writeln('3 0 obj');
    out.writeln('<< /Type /Pages /Kids [$kids] /Count $pageCount >>');
    out.writeln('endobj');
    for (var i = 0; i < pageCount; i++) {
      offsets.add(out.length);
      out.writeln('${4 + 2 * i} 0 obj');
      out.writeln(
          '<< /Type /Page /Parent 3 0 R /MediaBox [0 0 $_w $_h] '
          '/Resources << /Font << /F1 1 0 R >> >> /Contents ${5 + 2 * i} 0 R >>');
      out.writeln('endobj');
      final bytes = latin1.encode(streams[i]);
      offsets.add(out.length);
      out.writeln('${5 + 2 * i} 0 obj');
      out.writeln('<< /Length ${bytes.length} >>');
      out.writeln('stream');
      out.writeln(streams[i]);
      out.writeln('endstream');
      out.writeln('endobj');
    }
    final xrefPos = out.length;
    out.writeln('xref');
    out.writeln('0 ${offsets.length + 1}');
    out.writeln('0000000000 65535 f ');
    for (final o in offsets) {
      out.writeln('${o.toString().padLeft(10, '0')} 00000 n ');
    }
    out.writeln('trailer');
    out.writeln('<< /Size ${offsets.length + 1} /Root 2 0 R >>');
    out.writeln('startxref');
    out.writeln(xrefPos);
    out.writeln('%%EOF');
    return latin1.encode(out.toString());
  }
}