import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../painters/exercise_diagram_painter.dart';

class ExercisePopupModal extends StatefulWidget {
  final List<Map<String, dynamic>> exercises;
  final Function(int xpEarned) onWorkoutCompleted;

  const ExercisePopupModal({
    Key? key,
    required this.exercises,
    required this.onWorkoutCompleted,
  }) : super(key: key);

  static void show(BuildContext context, {
    required List<Map<String, dynamic>> exercises,
    required Function(int xpEarned) onWorkoutCompleted,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ExercisePopupModal(
        exercises: exercises,
        onWorkoutCompleted: onWorkoutCompleted,
      ),
    );
  }

  @override
  State<ExercisePopupModal> createState() => _ExercisePopupModalState();
}

class _ExercisePopupModalState extends State<ExercisePopupModal> {
  int _currentStep = 0;
  final List<int> _completedSteps = [];
  bool _isFinished = false;

  Timer? _timer;
  int _timerSeconds = 60;
  bool _isTimerRunning = false;

  @override
  void initState() {
    super.initState();
    _initTimerForStep();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _initTimerForStep() {
    _timer?.cancel();
    _isTimerRunning = false;
    if (widget.exercises.isEmpty) return;

    final cur = widget.exercises[_currentStep];
    final durStr = cur['duration'] ?? '1 min';
    int mins = 1;
    try {
      final m = int.tryParse(durStr.toString().split(' ')[0]);
      if (m != null && m > 0) mins = m;
    } catch (_) {}
    setState(() {
      _timerSeconds = mins * 60;
    });
  }

  void _toggleTimer() {
    if (_isTimerRunning) {
      _timer?.cancel();
      setState(() => _isTimerRunning = false);
    } else {
      setState(() => _isTimerRunning = true);
      _timer = Timer.periodic(const Duration(seconds: 1), (t) {
        if (_timerSeconds > 0) {
          setState(() => _timerSeconds--);
        } else {
          t.cancel();
          setState(() => _isTimerRunning = false);
        }
      });
    }
  }

  void _resetTimer() {
    _initTimerForStep();
  }

  String _formatTime(int sec) {
    final m = sec ~/ 60;
    final s = sec % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  String _getOrdinal(int n) {
    if (n == 1) return "1st";
    if (n == 2) return "2nd";
    if (n == 3) return "3rd";
    return "${n}th";
  }

  void _handleStepCompleted() {
    _timer?.cancel();
    setState(() {
      if (!_completedSteps.contains(_currentStep)) {
        _completedSteps.add(_currentStep);
      }
      if (_currentStep + 1 >= widget.exercises.length) {
        _isFinished = true;
        widget.onWorkoutCompleted(25);
      } else {
        _currentStep++;
        _initTimerForStep();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final total = widget.exercises.length;
    final pct = total > 0 ? (_completedSteps.length / total) : 0.0;

    return Container(
      height: MediaQuery.of(context).size.height * 0.90,
      decoration: const BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        border: Border(top: BorderSide(color: AppTheme.borderCyan, width: 1.5)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 44,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      "⚡ GUIDED EXERCISE MODE",
                      style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.cyanLight,
                        letterSpacing: 0.8,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      "Daily Exercise Routine",
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppTheme.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),

          // Progress bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 4.0),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _isFinished ? "ALL STEPS COMPLETED" : "STEP ${_currentStep + 1} OF $total",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.cyanLight),
                    ),
                    Text(
                      "${(pct * 100).round()}% COMPLETED",
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.greenLight),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct,
                    minHeight: 6,
                    backgroundColor: Colors.white10,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.green),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Content: Active step OR Celebration card
          Expanded(
            child: _isFinished ? _buildCelebrationView() : _buildActiveStepView(),
          ),
        ],
      ),
    );
  }

  Widget _buildCelebrationView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text("🏆", style: TextStyle(fontSize: 54)),
            const SizedBox(height: 12),
            const Text(
              "Daily Workout Complete!",
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              "Outstanding effort! You completed all ${widget.exercises.length} prescribed exercises today (+25 XP earned).",
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: AppTheme.textMuted, height: 1.5),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.green,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () => Navigator.of(context).pop(),
              child: const Text("✓ DONE / RETURN TO DASHBOARD", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF020617))),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveStepView() {
    final curEx = widget.exercises[_currentStep];
    final isLastStep = _currentStep == widget.exercises.length - 1;
    final ordinal = _getOrdinal(_currentStep + 1);

    final instructions = (curEx['instructions'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [
      "Begin in proper posture with core actively engaged.",
      "Perform controlled movements through full range of motion.",
      "Breathe rhythmically without holding your breath."
    ];

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Step badge & Timing
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0x2606B6D4),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppTheme.cyanLight.withOpacity(0.4)),
                ),
                child: Text(
                  "⚡ ${ordinal.toUpperCase()} EXERCISE · ACTIVE",
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.cyanLight),
                ),
              ),
              Text(
                "${curEx['duration']} · ${curEx['reps']}",
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.amberLight),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // ILLUSTRATION IMAGE / DIAGRAM OF EXERCISE
          Container(
            height: 170,
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderCyan, width: 1.2),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: CustomPaint(
                painter: ExerciseDiagramPainter(
                  exerciseKey: curEx['key'] ?? '',
                  exerciseName: curEx['name'] ?? '',
                ),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Exercise Name
          Text(
            curEx['name'] ?? 'Exercise Name',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white),
          ),

          const SizedBox(height: 8),

          // Pills: duration, reps, target muscles
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _buildPill("⏱️ ${curEx['duration'] ?? '1 min'}"),
              _buildPill("⚡ ${curEx['reps'] ?? 'Reps'}"),
              _buildPill("🎯 ${curEx['target_muscles'] ?? 'Mobility & Core'}"),
            ],
          ),

          const SizedBox(height: 14),

          // How to do it instructions
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF070D18),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "📋 HOW TO PERFORM (PROPER FORM):",
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.cyanLight),
                ),
                const SizedBox(height: 8),
                for (int i = 0; i < instructions.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6.0),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("${i + 1}. ", style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.greenLight, fontSize: 12)),
                        Expanded(
                          child: Text(instructions[i], style: const TextStyle(fontSize: 12, color: AppTheme.textLight, height: 1.4)),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Exercise Timer box
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0x1A06B6D4),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.cyan.withOpacity(0.3)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text("TIMER", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: AppTheme.textMuted)),
                    Text(
                      _formatTime(_timerSeconds),
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: AppTheme.cyanLight, letterSpacing: 1.5),
                    ),
                  ],
                ),
                Row(
                  children: [
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.cyan,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _toggleTimer,
                      child: Text(_isTimerRunning ? "⏸ PAUSE" : "▶ START", style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF020617))),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppTheme.textMuted,
                        side: const BorderSide(color: Colors.white24),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _resetTimer,
                      child: const Text("RESET"),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Action button: COMPLETED ONLY AFTER WHICH NEXT EXERCISE COMES IN SAME FORMAT
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 4,
                shadowColor: AppTheme.green.withOpacity(0.5),
              ),
              onPressed: _handleStepCompleted,
              child: Text(
                isLastStep
                    ? "🎉 COMPLETE FINAL EXERCISE (+25 XP)"
                    : "✓ ${ordinal.toUpperCase()} EXERCISE COMPLETED → NEXT EXERCISE",
                style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: Color(0xFF020617), letterSpacing: 0.5),
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Next preview
          Center(
            child: Text(
              !isLastStep && _currentStep + 1 < widget.exercises.length
                  ? "Next up: Step ${_currentStep + 2} · ${widget.exercises[_currentStep + 1]['name']}"
                  : "Final step! Completing will finish today's scheduled routine.",
              style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
            ),
          ),

          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildPill(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white12),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textLight)),
    );
  }
}

