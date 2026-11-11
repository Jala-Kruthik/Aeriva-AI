import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../widgets/exercise_popup_modal.dart';

class Dashboard2Screen extends StatefulWidget {
  final Map<String, dynamic> exerciseData;
  final Map<String, dynamic> nextDaySuggestions;
  final int activityMinutes;
  final Function(int xpEarned) onWorkoutCompleted;

  const Dashboard2Screen({
    Key? key,
    required this.exerciseData,
    required this.nextDaySuggestions,
    required this.activityMinutes,
    required this.onWorkoutCompleted,
  }) : super(key: key);

  @override
  State<Dashboard2Screen> createState() => _Dashboard2ScreenState();
}

class _Dashboard2ScreenState extends State<Dashboard2Screen> {
  List<Map<String, dynamic>> _getExercises() {
    final raw = widget.exerciseData['exercises'] as List<dynamic>?;
    if (raw != null && raw.isNotEmpty) {
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    // Default fallback matching routine
    return [
      {
        "name": "Cat-Cow & Spine Decompression",
        "key": "cat_cow",
        "duration": "4 mins",
        "reps": "Controlled breathing",
        "target_muscles": "Spine, Neck & Core",
        "instructions": [
          "Start on hands and knees with wrists directly under shoulders.",
          "Inhale: Gently drop belly toward mat, look forward/up (Cow Pose).",
          "Exhale: Round spine up toward ceiling, tucking chin (Cat Pose).",
          "Flow continuously with deep, rhythmic breaths for 4 minutes."
        ]
      },
      {
        "name": "Surya Namaskar (Sun Salutations)",
        "key": "surya_namaskar",
        "duration": "8 mins",
        "reps": "6 slow rounds",
        "target_muscles": "Hamstrings, Chest & Full Body",
        "instructions": [
          "1. Stand tall with palms joined in prayer at heart center.",
          "2. Inhale: Sweep arms overhead, arching back gently.",
          "3. Exhale: Fold forward from hips to touch ankles or floor.",
          "4. Step back to plank, lower to cobra, press into downward dog.",
          "5. Step forward and return to prayer. Complete 6 smooth rounds."
        ]
      },
      {
        "name": "Glute Bridges & Bird-Dog Core",
        "key": "glute_bridges",
        "duration": "5 mins",
        "reps": "3 sets x 12 reps",
        "target_muscles": "Glutes, Lower Back & Core",
        "instructions": [
          "Lie flat on back with knees bent and feet flat hip-width apart.",
          "Drive through heels to hoist pelvis into a straight bridge line.",
          "Squeeze glutes at apex for 2 seconds, then lower smoothly.",
          "Transition into Bird-Dog extensions for 12 reps per set."
        ]
      },
      {
        "name": "Child's Pose & Deep Hip Openers",
        "key": "childs_pose",
        "duration": "3 mins",
        "reps": "Restorative stretches",
        "target_muscles": "Hips, Lower Lumbar & Lats",
        "instructions": [
          "Kneel on mat with big toes touching and knees spread wide.",
          "Sink hips back onto heels and reach arms straight forward.",
          "Rest forehead on mat and lengthen spine with each exhale.",
          "Hold for 3 minutes to relieve lumbar tension."
        ]
      },
    ];
  }

  void _openExercisePopup() {
    ExercisePopupModal.show(
      context,
      exercises: _getExercises(),
      onWorkoutCompleted: widget.onWorkoutCompleted,
    );
  }

  @override
  Widget build(BuildContext context) {
    final exList = _getExercises();
    final freeSlot = widget.exerciseData['free_time_slot'] ?? "17:30 – 17:50";
    final freeWindow = widget.exerciseData['full_free_window'] ?? "17:30 – 22:30";
    final dailyCals = widget.exerciseData['daily_calories'] ?? 610;
    final stepBurn = widget.exerciseData['steps_calories_burned'] ?? 480;
    final targetBurn = widget.exerciseData['target_calories_to_burn'] ?? 140;
    final workoutName = widget.exerciseData['workout_name'] ?? "Active Recovery, Mobility & Core Flow";
    final workoutMins = widget.exerciseData['recommended_duration_minutes'] ?? 20;

    final nextMeals = (widget.nextDaySuggestions['meals'] as List<dynamic>?) ?? [];
    final nextRationale = widget.nextDaySuggestions['rationale'] ?? "Curated Indian nutrition plan to balance today's caloric and macronutrient intake.";
    final nextStatus = widget.nextDaySuggestions['status'] ?? "BALANCED FUELING";

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. EXERCISE MODE OVERVIEW CARD
          _buildHeader("2 · WHAT TO DO", "Exercise Mode & Movement", "${widget.activityMinutes} min"),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.cardBg,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.borderCyan),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Free schedule window tag
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text("🕒 FREE SCHEDULE WINDOW", style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.cyanLight)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white10,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text("$freeSlot (Window: $freeWindow)", style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: Colors.white)),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Metrics row: Food Intake, Steps Burn, Target Burn
                Row(
                  children: [
                    _buildMetricBox("FOOD INTAKE", "$dailyCals kcal", AppTheme.rose),
                    const SizedBox(width: 8),
                    _buildMetricBox("STEPS BURN", "~$stepBurn kcal", AppTheme.amberLight),
                    const SizedBox(width: 8),
                    _buildMetricBox("TARGET BURN", "~$targetBurn kcal", AppTheme.greenLight),
                  ],
                ),
                const SizedBox(height: 16),

                // Routine title & description
                Row(
                  children: [
                    const Text("🌿 ", style: TextStyle(fontSize: 16)),
                    Expanded(
                      child: Text(
                        "$workoutName ($workoutMins min)",
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                const Text(
                  "A gentle mobility and core routine scheduled during your free window flushes lactic acid and protects posture.",
                  style: TextStyle(fontSize: 11.5, color: AppTheme.textMuted, height: 1.4),
                ),
                const SizedBox(height: 14),

                // List of exercises preview
                for (var ex in exList)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: InkWell(
                      onTap: _openExercisePopup,
                      borderRadius: BorderRadius.circular(10),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.03),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Text("▸ ", style: TextStyle(color: AppTheme.cyanLight, fontWeight: FontWeight.bold, fontSize: 13)),
                                Text(ex['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 12)),
                              ],
                            ),
                            Text("${ex['duration']} · ${ex['reps']}", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.amberLight)),
                          ],
                        ),
                      ),
                    ),
                  ),

                const SizedBox(height: 8),

                // PROMINENT HERO BUTTON TO LAUNCH POPUP MODE
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.cyan,
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 4,
                      shadowColor: AppTheme.cyan.withOpacity(0.4),
                    ),
                    onPressed: _openExercisePopup,
                    child: const Text(
                      "⚡ START EXERCISE MODE (OPEN STEP-BY-STEP POPUP)",
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF020617), letterSpacing: 0.4),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildHeader(String kicker, String title, String badge) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(kicker, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.cyanLight, letterSpacing: 0.8)),
              Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
            ],
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0x2610B981),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppTheme.greenLight.withOpacity(0.3)),
            ),
            child: Text(badge, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: AppTheme.greenLight)),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricBox(String label, String val, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.03),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.white10),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppTheme.textMuted)),
            const SizedBox(height: 4),
            Text(val, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w900, color: color)),
          ],
        ),
      ),
    );
  }
}

