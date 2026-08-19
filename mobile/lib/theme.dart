import 'package:flutter/material.dart';

class AppTheme {
  static const Color primary = Color(0xFF1F7A4D);
  static const Color accent = Color(0xFF2D6CDF);

  static ThemeData light = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: primary,
    brightness: Brightness.light,
  );

  static ThemeData dark = ThemeData(
    useMaterial3: true,
    colorSchemeSeed: primary,
    brightness: Brightness.dark,
  );
}
