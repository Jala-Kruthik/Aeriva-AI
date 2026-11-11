import 'package:flutter/material.dart';

class AppTheme {
  static const Color voidBg = Color(0xFF020617);
  static const Color cardBg = Color(0xFF0C1220);
  static const Color cardSurface = Color(0xFF0F172A);
  static const Color cyan = Color(0xFF06B6D4);
  static const Color cyanLight = Color(0xFF67E8F9);
  static const Color green = Color(0xFF10B981);
  static const Color greenLight = Color(0xFF34D399);
  static const Color amber = Color(0xFFF59E0B);
  static const Color amberLight = Color(0xFFFCD34D);
  static const Color rose = Color(0xFFF43F5E);
  static const Color textLight = Color(0xFFF8FAFC);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color borderCyan = Color(0x3306B6D4);
  static const Color borderGreen = Color(0x3310B981);
  static const Color borderSubtle = Color(0x1AFFFFFF);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: voidBg,
      primaryColor: cyan,
      colorScheme: const ColorScheme.dark(
        primary: cyan,
        secondary: green,
        surface: cardBg,
        background: voidBg,
      ),
      fontFamily: 'Inter',
      appBarTheme: const AppBarTheme(
        backgroundColor: voidBg,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardTheme(
        color: cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: borderCyan, width: 1),
        ),
        elevation: 0,
      ),
    );
  }
}

