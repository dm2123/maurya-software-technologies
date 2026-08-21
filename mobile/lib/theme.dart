import 'package:flutter/material.dart';

class AppTheme {
  static const Color navy = Color(0xFF0B1220);
  static const Color surfaceDark = Color(0xFF121B2F);
  static const Color primary = Color(0xFF2563EB);
  static const Color cyanAccent = Color(0xFF22D3EE);
  static const Color violet = Color(0xFF8B5CF6);

  static ThemeData light = _base(Brightness.light);
  static ThemeData dark = _base(Brightness.dark);

  static ThemeData _base(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final scheme = ColorScheme.fromSeed(seedColor: primary, brightness: brightness)
        .copyWith(
      primary: primary,
      secondary: isDark ? cyanAccent : const Color(0xFF0891B2),
      tertiary: violet,
      surface: isDark ? surfaceDark : Colors.white,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: isDark ? navy : const Color(0xFFF5F7FB),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark ? navy : primary,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 2,
      ),
      floatingActionButtonTheme: FloatingActionButtonThemeData(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      dividerColor: isDark ? const Color(0xFF22304D) : const Color(0xFFE4E9F2),
      snackBarTheme:
          const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    );
  }
}