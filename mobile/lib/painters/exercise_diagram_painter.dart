import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ExerciseDiagramPainter extends CustomPainter {
  final String exerciseKey;
  final String exerciseName;

  ExerciseDiagramPainter({required this.exerciseKey, required this.exerciseName});

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()..color = const Color(0xFF020617);
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(16)), bgPaint);

    final key = exerciseKey.toLowerCase();
    final name = exerciseName.toLowerCase();

    if (key.contains("cat_cow") || name.contains("cat") || name.contains("spine")) {
      _drawCatCow(canvas, size);
    } else if (key.contains("surya") || name.contains("surya") || name.contains("salutation")) {
      _drawSuryaNamaskar(canvas, size);
    } else if (key.contains("glute") || name.contains("bridge") || name.contains("bird")) {
      _drawGluteBridge(canvas, size);
    } else if (key.contains("child") || name.contains("child") || name.contains("hip")) {
      _drawChildPose(canvas, size);
    } else {
      _drawUniversalMovement(canvas, size);
    }
  }

  void _drawCatCow(Canvas canvas, Size size) {
    final cyanPaint = Paint()
      ..color = AppTheme.cyanLight
      ..strokeWidth = 3.5
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final greenPaint = Paint()
      ..color = AppTheme.greenLight
      ..strokeWidth = 4.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final whitePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    final floorPaint = Paint()
      ..color = const Color(0x3306B6D4)
      ..strokeWidth = 2.0;

    // Floor line
    final floorY = size.height * 0.82;
    canvas.drawLine(Offset(size.width * 0.1, floorY), Offset(size.width * 0.9, floorY), floorPaint);

    // Hands and Knees
    final armX = size.width * 0.70;
    final legX = size.width * 0.30;
    canvas.drawLine(Offset(armX, size.height * 0.52), Offset(armX, floorY), whitePaint);
    canvas.drawLine(Offset(legX, size.height * 0.62), Offset(legX, floorY), whitePaint);
    // Feet
    canvas.drawLine(Offset(legX, floorY), Offset(legX - 25, floorY), whitePaint);

    // Head
    canvas.drawCircle(Offset(armX + 10, size.height * 0.45), 9, Paint()..color = AppTheme.cyanLight);

    // Cow drop curve (Green)
    final cowPath = Path()
      ..moveTo(legX, size.height * 0.62)
      ..quadraticBezierTo(size.width * 0.50, size.height * 0.72, armX, size.height * 0.52);
    canvas.drawPath(cowPath, greenPaint);

    // Cat arch curve (Dashed Cyan)
    final catPath = Path()
      ..moveTo(legX, size.height * 0.62)
      ..quadraticBezierTo(size.width * 0.50, size.height * 0.36, armX, size.height * 0.52);
    canvas.drawPath(catPath, cyanPaint);

    // Text labels
    _drawText(canvas, "▲ EXHALE: ROUND SPINE (CAT)", Offset(size.width * 0.5, size.height * 0.22), AppTheme.cyanLight, 10, true);
    _drawText(canvas, "▼ INHALE: DROP BELLY & LIFT CHIN (COW)", Offset(size.width * 0.5, size.height * 0.88), AppTheme.greenLight, 10, true);
  }

  void _drawSuryaNamaskar(Canvas canvas, Size size) {
    final whitePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round;

    final goldPaint = Paint()
      ..color = AppTheme.amberLight
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    final floorY = size.height * 0.82;
    canvas.drawLine(Offset(size.width * 0.1, floorY), Offset(size.width * 0.9, floorY), Paint()..color = Colors.white24..strokeWidth = 2);

    // Sun Icon
    canvas.drawCircle(Offset(size.width * 0.5, size.height * 0.22), 12, goldPaint);

    // 1. Prayer Pose
    final pX = size.width * 0.22;
    canvas.drawCircle(Offset(pX, size.height * 0.38), 6, Paint()..color = Colors.white);
    canvas.drawLine(Offset(pX, size.height * 0.44), Offset(pX, size.height * 0.66), whitePaint);
    canvas.drawLine(Offset(pX, size.height * 0.66), Offset(pX, floorY), whitePaint);
    _drawText(canvas, "1. PRAYER", Offset(pX, floorY + 12), AppTheme.textMuted, 9, true);

    // 2. Forward Fold
    final fX = size.width * 0.50;
    canvas.drawCircle(Offset(fX - 8, size.height * 0.64), 6, Paint()..color = Colors.white);
    canvas.drawLine(Offset(fX, floorY), Offset(fX, size.height * 0.54), whitePaint);
    canvas.drawLine(Offset(fX, size.height * 0.54), Offset(fX - 8, size.height * 0.64), whitePaint);
    _drawText(canvas, "2. FOLD", Offset(fX, floorY + 12), AppTheme.textMuted, 9, true);

    // 3. Cobra Pose
    final cX = size.width * 0.78;
    canvas.drawCircle(Offset(cX + 12, size.height * 0.52), 6, Paint()..color = AppTheme.cyanLight);
    canvas.drawLine(Offset(cX - 30, floorY), Offset(cX, floorY - 4), whitePaint);
    canvas.drawLine(Offset(cX, floorY - 4), Offset(cX + 12, size.height * 0.52), Paint()..color = AppTheme.greenLight..strokeWidth = 3.5..strokeCap = StrokeCap.round);
    _drawText(canvas, "3. COBRA", Offset(cX, floorY + 12), AppTheme.greenLight, 9, true);
  }

  void _drawGluteBridge(Canvas canvas, Size size) {
    final greenPaint = Paint()
      ..color = AppTheme.greenLight
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;
    final whitePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;

    final floorY = size.height * 0.82;
    canvas.drawLine(Offset(size.width * 0.1, floorY), Offset(size.width * 0.9, floorY), Paint()..color = Colors.white24..strokeWidth = 2);

    // Head on ground
    final hX = size.width * 0.22;
    canvas.drawCircle(Offset(hX, floorY - 10), 8, Paint()..color = AppTheme.cyanLight);
    // Shoulders
    canvas.drawLine(Offset(hX, floorY - 6), Offset(hX + 30, floorY - 6), whitePaint);

    // Elevated Hips & Torso (Green bridge)
    final hipX = size.width * 0.55;
    final hipY = size.height * 0.48;
    canvas.drawLine(Offset(hX + 30, floorY - 6), Offset(hipX, hipY), greenPaint);
    canvas.drawLine(Offset(hipX, hipY), Offset(hipX + 35, hipY), greenPaint);

    // Thighs to Feet
    final footX = size.width * 0.75;
    canvas.drawLine(Offset(hipX + 35, hipY), Offset(footX, floorY), whitePaint);

    // Force arrows
    final arrowPaint = Paint()..color = AppTheme.greenLight..strokeWidth = 2.0;
    canvas.drawLine(Offset(hipX + 15, floorY - 10), Offset(hipX + 15, hipY + 12), arrowPaint);

    _drawText(canvas, "▲ DRIVE HIPS & SQUEEZE GLUTES ▲", Offset(size.width * 0.5, size.height * 0.32), AppTheme.greenLight, 10, true);
    _drawText(canvas, "Hold 2s at peak · Feet flat hip-width", Offset(size.width * 0.5, floorY + 12), AppTheme.textMuted, 9, false);
  }

  void _drawChildPose(Canvas canvas, Size size) {
    final whitePaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round;
    final cyanPaint = Paint()
      ..color = AppTheme.cyanLight
      ..strokeWidth = 4.0
      ..strokeCap = StrokeCap.round;

    final floorY = size.height * 0.82;
    canvas.drawLine(Offset(size.width * 0.1, floorY), Offset(size.width * 0.9, floorY), Paint()..color = const Color(0x3306B6D4)..strokeWidth = 2);

    // Hips resting on heels
    final heelX = size.width * 0.28;
    canvas.drawLine(Offset(heelX - 25, floorY), Offset(heelX, floorY), whitePaint);
    canvas.drawLine(Offset(heelX, floorY), Offset(heelX + 15, floorY - 16), whitePaint);

    // Torso folded forward
    final headX = size.width * 0.65;
    canvas.drawLine(Offset(heelX + 15, floorY - 16), Offset(headX, floorY - 10), cyanPaint);
    canvas.drawCircle(Offset(headX, floorY - 10), 8, Paint()..color = AppTheme.cyanLight);

    // Arms extended along ground
    canvas.drawLine(Offset(heelX + 25, floorY - 10), Offset(headX + 45, floorY), Paint()..color = AppTheme.greenLight..strokeWidth = 3.5..strokeCap = StrokeCap.round);

    _drawText(canvas, "REST HIPS ON HEELS · REACH FINGERS FORWARD", Offset(size.width * 0.5, size.height * 0.35), AppTheme.cyanLight, 10, true);
    _drawText(canvas, "Slow deep breathing decompresses lumbar spine", Offset(size.width * 0.5, size.height * 0.50), AppTheme.textMuted, 9, false);
  }

  void _drawUniversalMovement(Canvas canvas, Size size) {
    final cyanPaint = Paint()..color = AppTheme.cyanLight..strokeWidth = 3.5..strokeCap = StrokeCap.round;
    final greenPaint = Paint()..color = AppTheme.greenLight..strokeWidth = 3.5..strokeCap = StrokeCap.round;
    final whitePaint = Paint()..color = Colors.white..strokeWidth = 3.5..strokeCap = StrokeCap.round;

    final midX = size.width * 0.5;
    final floorY = size.height * 0.82;
    canvas.drawLine(Offset(size.width * 0.1, floorY), Offset(size.width * 0.9, floorY), Paint()..color = Colors.white24..strokeWidth = 2);

    // Standing active figure
    canvas.drawCircle(Offset(midX, size.height * 0.32), 9, Paint()..color = AppTheme.cyanLight);
    canvas.drawLine(Offset(midX, size.height * 0.40), Offset(midX, size.height * 0.62), whitePaint);
    canvas.drawLine(Offset(midX, size.height * 0.46), Offset(midX - 30, size.height * 0.34), cyanPaint);
    canvas.drawLine(Offset(midX, size.height * 0.46), Offset(midX + 30, size.height * 0.34), cyanPaint);
    canvas.drawLine(Offset(midX, size.height * 0.62), Offset(midX - 22, floorY), greenPaint);
    canvas.drawLine(Offset(midX, size.height * 0.62), Offset(midX + 22, floorY), greenPaint);

    _drawText(canvas, "ACTIVE POSTURE & CONTROLLED CADENCE", Offset(midX, size.height * 0.18), AppTheme.amberLight, 10, true);
    _drawText(canvas, "Move through full range of motion with steady breath", Offset(midX, floorY + 12), AppTheme.textMuted, 9, false);
  }

  void _drawText(Canvas canvas, String text, Offset center, Color color, double fontSize, bool bold) {
    final textSpan = TextSpan(
      text: text,
      style: TextStyle(
        color: color,
        fontSize: fontSize,
        fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
        letterSpacing: 0.3,
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();
    textPainter.paint(canvas, Offset(center.dx - textPainter.width / 2, center.dy - textPainter.height / 2));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

