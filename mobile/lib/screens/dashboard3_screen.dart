import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class Dashboard3Screen extends StatefulWidget {
  final List<dynamic> todayFoods;
  final int steps;
  final int activityMinutes;
  final Map<String, dynamic> nextDaySuggestions;
  final VoidCallback onLogFood;
  final VoidCallback onStartExercise;

  const Dashboard3Screen({
    Key? key,
    required this.todayFoods,
    required this.steps,
    required this.activityMinutes,
    required this.nextDaySuggestions,
    required this.onLogFood,
    required this.onStartExercise,
  }) : super(key: key);

  @override
  State<Dashboard3Screen> createState() => _Dashboard3ScreenState();
}

class _Dashboard3ScreenState extends State<Dashboard3Screen> {
  @override
  Widget build(BuildContext context) {
    final nextMeals = (widget.nextDaySuggestions['meals'] as List<dynamic>?) ?? [];
    final nextStatus = widget.nextDaySuggestions['status'] ?? 'BALANCED FUELING';
    final nextRationale = widget.nextDaySuggestions['rationale'] ??
        'Personalized nutrition formulated from your recent meal logs.';

    // Calculate Food Precautions dynamically
    final bool hasFood = widget.todayFoods.isNotEmpty;
    final int totalCalories = widget.todayFoods.fold<int>(0, (sum, item) {
      final cals = (item['calories'] as num?)?.toInt() ?? 0;
      return sum + cals;
    });

    String foodStatus = "OPTIMAL";
    String foodBadge = "PROPER FUELING";
    Color foodColor = AppTheme.greenLight;
    String foodMsg = "Your meal logs indicate healthy, regular fueling today.";
    String foodRec = "Maintain balanced portions and stay hydrated with 2.5L+ water.";

    if (!hasFood) {
      foodStatus = "CRITICAL";
      foodBadge = "NO FOOD LOGGED";
      foodColor = const Color(0xFFEF4444);
      foodMsg = "You haven't logged any meals today! Skipping food causes acute blood sugar drops, cognitive fatigue, and metabolism slowdown.";
      foodRec = "Consume a wholesome meal containing whole grains, dal/protein, and vegetables immediately.";
    } else if (totalCalories < 800) {
      foodStatus = "WARNING";
      foodBadge = "CALORIE DEFICIT";
      foodColor = const Color(0xFFF59E0B);
      foodMsg = "Logged intake is only $totalCalories kcal. Prolonged under-fueling puts stress on your nervous system and muscles.";
      foodRec = "Add nutrient-dense snacks like nuts, curd, lentils, or fruit to reach your daily energy requirement.";
    }

    // Calculate Rest Precautions
    const String restBadge = "7-8 HRS REQUIRED";
    const Color restColor = Color(0xFFF59E0B);
    const String restMsg = "Adequate sleep and scheduled rest intervals are vital for cellular repair, immunity, and mental acuity.";
    const String restRec = "Wind down 30 minutes earlier tonight, dim bright screens, and maintain a consistent sleep schedule.";

    // Calculate Exercise Precautions
    String exBadge = "ACTIVE";
    Color exColor = AppTheme.greenLight;
    String exMsg = "Good movement logged! Physical activity protects heart health and insulin sensitivity.";
    String exRec = "Do post-activity static stretches to keep muscles supple.";

    if (widget.steps < 3500 && widget.activityMinutes == 0) {
      exBadge = "SEDENTARY WARNING";
      exColor = const Color(0xFFEF4444);
      exMsg = "You have only logged ${widget.steps} steps and 0 exercise minutes today. Prolonged sitting causes vascular stiffness and low energy.";
      exRec = "Stand up and complete a 15-minute brisk walk or launch our guided workout mode.";
    } else if (widget.steps < 6000 && widget.activityMinutes < 15) {
      exBadge = "MODERATE MOVEMENT NEEDED";
      exColor = const Color(0xFFF59E0B);
      exMsg = "Daily movement is slightly below target (${widget.steps} steps, ${widget.activityMinutes} mins).";
      exRec = "Take a 10-minute walk or do a quick round of Surya Namaskar / mobility exercises.";
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. HEADER
          _buildHeader("AI CLINICAL INTELLIGENCE", "Precautions & Guidance", "SHIELD ACTIVE"),
          const SizedBox(height: 12),

          // 2. OVERARCHING SHIELD STATUS BANNER
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.cardBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF06B6D4).withOpacity(0.4)),
              boxShadow: [
                BoxShadow(color: const Color(0xFF06B6D4).withOpacity(0.08), blurRadius: 16, spreadRadius: 1),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF06B6D4).withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Text("🛡️", style: TextStyle(fontSize: 20)),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Proactive Health Safety Shield",
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Colors.white),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            !hasFood || widget.steps < 3500
                                ? "Action Required: Precautions detected for meals or physical activity."
                                : "All systems stable. Keep up this healthy daily routine!",
                            style: const TextStyle(fontSize: 11, color: AppTheme.textMuted),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 3. FOOD PRECAUTION CARD
          _buildPillarCard(
            icon: "🥗",
            title: "Food & Nutrition",
            sub: "Daily Meal Intake",
            badge: foodBadge,
            badgeColor: foodColor,
            message: foodMsg,
            recommendation: foodRec,
            actionLabel: "+ LOG MEAL NOW",
            onAction: widget.onLogFood,
          ),

          const SizedBox(height: 14),

          // 4. REST & SLEEP PRECAUTION CARD
          _buildPillarCard(
            icon: "🌙",
            title: "Rest & Recovery",
            sub: "Sleep & Downtime",
            badge: restBadge,
            badgeColor: restColor,
            message: restMsg,
            recommendation: restRec,
            actionLabel: "VIEW ROUTINE",
            onAction: () {},
          ),

          const SizedBox(height: 14),

          // 5. EXERCISE PRECAUTION CARD
          _buildPillarCard(
            icon: "⚡",
            title: "Physical Exercise",
            sub: "Steps & Movement",
            badge: exBadge,
            badgeColor: exColor,
            message: exMsg,
            recommendation: exRec,
            actionLabel: "⚡ START WORKOUT",
            onAction: widget.onStartExercise,
          ),

          const SizedBox(height: 24),

          // 6. MOVED SECTION: NEXT-DAY MEAL SUGGESTIONS (ACCORDING TO TODAY)
          _buildHeader("NEXT-DAY NUTRITION", "What Food To Eat Tomorrow", nextStatus),
          const SizedBox(height: 4),
          Text(
            "Balanced Indian meals for tomorrow specifically formulated based on your food logs from today.",
            style: TextStyle(fontSize: 11.5, color: AppTheme.textMuted.withOpacity(0.9), height: 1.3),
          ),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.cardBg,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.borderGreen),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  nextRationale,
                  style: const TextStyle(fontSize: 12, color: AppTheme.textMuted, height: 1.4),
                ),
                const SizedBox(height: 14),

                if (nextMeals.isEmpty)
                  const Text("Log today's meals to calculate tailored next-day suggestions.", style: TextStyle(fontSize: 12, color: AppTheme.textMuted))
                else
                  for (var m in nextMeals)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10.0),
                      child: Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.02),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text("🍱 ${m['meal_type'] ?? 'Meal'}", style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.cyanLight, fontSize: 11)),
                                Text("${m['calories'] ?? 0} kcal", style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.greenLight, fontSize: 11)),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(m['food_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w800, color: Colors.white, fontSize: 13)),
                            const SizedBox(height: 2),
                            Text("Portion: ${m['portion'] ?? '1 serving'}", style: const TextStyle(fontSize: 10.5, color: AppTheme.textMuted)),
                            const SizedBox(height: 4),
                            Text("💡 ${m['reason'] ?? ''}", style: const TextStyle(fontSize: 11, color: AppTheme.amberLight, fontStyle: FontStyle.italic)),
                          ],
                        ),
                      ),
                    ),
              ],
            ),
          ),
          const SizedBox(height: 28),
        ],
      ),
    );
  }

  Widget _buildPillarCard({
    required String icon,
    required String title,
    required String sub,
    required String badge,
    required Color badgeColor,
    required String message,
    required String recommendation,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: badgeColor.withOpacity(0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Text(icon, style: const TextStyle(fontSize: 16)),
                  ),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: Colors.white)),
                      Text(sub, style: const TextStyle(fontSize: 9.5, color: AppTheme.textMuted, letterSpacing: 0.4)),
                    ],
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: badgeColor.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: badgeColor.withOpacity(0.4)),
                ),
                child: Text(
                  badge,
                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: badgeColor, letterSpacing: 0.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            message,
            style: const TextStyle(fontSize: 12, color: Colors.white70, height: 1.4),
          ),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.3),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    "💡 $recommendation",
                    style: const TextStyle(fontSize: 11, color: AppTheme.cyanLight, height: 1.35),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: AppTheme.cyanLight.withOpacity(0.5)),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                backgroundColor: AppTheme.cyanLight.withOpacity(0.08),
              ),
              onPressed: onAction,
              child: Text(
                actionLabel,
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.cyanLight, letterSpacing: 0.5),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(String kicker, String title, String badge) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
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
}

