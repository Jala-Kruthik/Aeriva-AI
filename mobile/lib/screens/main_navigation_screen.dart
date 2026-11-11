import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import '../widgets/vitals_cards.dart';
import 'auth_screen.dart';
import 'dashboard1_screen.dart';
import 'dashboard2_screen.dart';
import 'dashboard3_screen.dart';

class MainNavigationScreen extends StatefulWidget {
  final Map<String, dynamic> userProfile;

  const MainNavigationScreen({Key? key, required this.userProfile}) : super(key: key);

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  // Always start on Dashboard 1 (0 = Daily Routine, 1 = What To Do)
  int _activeDashboard = 0;

  int _steps = 8200;
  double _waterL = 1.25;
  int _xp = 120;
  int _activityMins = 0;
  List<dynamic> _todayFoods = [];
  Map<String, dynamic> _exerciseData = {};
  Map<String, dynamic> _nextDaySuggestions = {};

  @override
  void initState() {
    super.initState();
    _loadAllData();
  }

  Future<void> _loadAllData() async {
    final foods = await ApiService.getTodayFoods();
    final exRec = await ApiService.getExerciseRecommendation(steps: _steps);
    final nextDay = await ApiService.getNextDayFoodSuggestions();

    if (mounted) {
      setState(() {
        _todayFoods = foods;
        _exerciseData = exRec;
        _nextDaySuggestions = nextDay;
      });
    }
  }

  void _addWater(double amountL) {
    setState(() {
      _waterL = double.parse((_waterL + amountL).toStringAsFixed(2));
      _xp += 5;
    });
  }

  void _updateSteps(int s) {
    setState(() {
      _steps = s;
      _xp += 15;
    });
    ApiService.getExerciseRecommendation(steps: _steps).then((data) {
      if (mounted) setState(() => _exerciseData = data);
    });
  }

  void _handleWorkoutCompleted(int earnedXP) {
    setState(() {
      _xp += earnedXP;
      _activityMins = _exerciseData['recommended_duration_minutes'] ?? 20;
    });
  }

  // Live Accurate Health Score Calculation (0 - 100%)
  int _computeHealthScore() {
    // 1. Sleep (25 max, default 8h = 25 pts)
    const sleepScore = 25;

    // 2. Hydration (25 max)
    final hydScore = ((_waterL / 2.5) * 25).round().clamp(0, 25);

    // 3. Activity (25 max: up to 18 from steps, 7 from workout)
    final stepScore = ((_steps / 10000.0) * 18).round().clamp(0, 18);
    final workoutScore = _activityMins > 0 ? 7 : 0;
    final actScore = (stepScore + workoutScore).clamp(0, 25);

    // 4. Nutrition (25 max)
    int cals = 0;
    for (var f in _todayFoods) {
      cals += (f['calories'] as num?)?.toInt() ?? 0;
    }
    int nutScore = 15;
    if (cals >= 1400 && cals <= 2400) {
      nutScore = 25;
    } else if (cals >= 800) {
      nutScore = 20;
    } else if (cals > 0) {
      nutScore = 16;
    }

    return (sleepScore + hydScore + actScore + nutScore).clamp(20, 100);
  }

  String _getHealthStatus(int score) {
    if (score >= 88) return "OPTIMAL";
    if (score >= 75) return "GOOD";
    if (score >= 55) return "MODERATE";
    return "NEEDS CARE";
  }

  // Live Accurate Energy Level Calculation (0 - 100%)
  int _computeEnergyLevel() {
    final now = DateTime.now();
    final hour = now.hour + (now.minute / 60.0);

    // Circadian baseline
    double base = 75;
    if (hour >= 6 && hour < 9) {
      base = 70 + ((hour - 6) / 3) * 16;
    } else if (hour >= 9 && hour < 13.5) {
      base = 86 + ((hour - 9) / 4.5) * 7;
    } else if (hour >= 13.5 && hour < 16.5) {
      base = 76 - ((hour - 13.5) / 3) * 8;
    } else if (hour >= 16.5 && hour < 20.5) {
      base = 74 + ((hour - 16.5) / 4) * 8;
    } else if (hour >= 20.5 && hour < 23) {
      base = 70 - ((hour - 20.5) / 2.5) * 30;
    } else {
      base = 28;
    }

    // Hydration recharge
    final hydMod = ((_waterL / 2.5).clamp(0.0, 1.0) * 12) - 4;

    // Food replenishment
    int cals = 0;
    for (var f in _todayFoods) {
      cals += (f['calories'] as num?)?.toInt() ?? 0;
    }
    double foodMod = cals >= 1000 ? 6 : cals >= 350 ? 3 : (hour > 13 ? -5 : 0);

    final total = (base + hydMod + foodMod).round();
    return total.clamp(15, 100);
  }

  String _getEnergyStatus(int level) {
    if (level >= 85) return "PEAK";
    if (level >= 65) return "ACTIVE";
    if (level >= 45) return "STEADY";
    return "LOW / REST";
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.userProfile['name'] ?? 'Player';
    final healthScore = _computeHealthScore();
    final healthStatus = _getHealthStatus(healthScore);
    final energyLevel = _computeEnergyLevel();
    final energyStatus = _getEnergyStatus(energyLevel);

    return Scaffold(
      backgroundColor: AppTheme.voidBg,
      body: SafeArea(
        child: Column(
          children: [
            // TOP HUD APP BAR
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
              decoration: const BoxDecoration(
                color: AppTheme.voidBg,
                border: Border(bottom: BorderSide(color: Colors.white10)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Row with Brand, Greeting and XP
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 32,
                            height: 32,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: AppTheme.cyan,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Text("A", style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF020617))),
                          ),
                          const SizedBox(width: 10),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text("AERIVA HEALTH", style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w900, color: AppTheme.cyanLight, letterSpacing: 0.8)),
                              Text("Welcome, $name", style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                            ],
                          ),
                        ],
                      ),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.04),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.white12),
                            ),
                            child: Text("$_xp XP", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: AppTheme.greenLight)),
                          ),
                          const SizedBox(width: 8),
                          InkWell(
                            onTap: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  backgroundColor: const Color(0xFF0F172A),
                                  title: const Text("Logout", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                  content: const Text("Are you sure you want to log out of Aeriva?", style: TextStyle(color: Colors.white70)),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.of(ctx).pop(false),
                                      child: const Text("CANCEL", style: TextStyle(color: Colors.white60)),
                                    ),
                                    TextButton(
                                      onPressed: () => Navigator.of(ctx).pop(true),
                                      child: const Text("LOGOUT", style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                              );
                              if (confirm == true) {
                                await ApiService.logout();
                                if (context.mounted) {
                                  Navigator.of(context).pushAndRemoveUntil(
                                    MaterialPageRoute(builder: (_) => const AuthScreen()),
                                    (route) => false,
                                  );
                                }
                              }
                            },
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.5)),
                              ),
                              child: const Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.power_settings_new_rounded, size: 14, color: Color(0xFFEF4444)),
                                  SizedBox(width: 4),
                                  Text(
                                    "LOGOUT",
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                      color: Color(0xFFEF4444),
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

                  // LEFT-SIDE CORNER DASHBOARD SWITCHER (1 - DAILY ROUTINE / 2 - WHAT TO DO / 3 - PRECAUTIONS)
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        _buildCornerDashTab(
                          number: 1,
                          label: "Daily Routine",
                          isActive: _activeDashboard == 0,
                          onTap: () => setState(() => _activeDashboard = 0),
                        ),
                        const SizedBox(width: 8),
                        _buildCornerDashTab(
                          number: 2,
                          label: "What To Do",
                          isActive: _activeDashboard == 1,
                          onTap: () => setState(() => _activeDashboard = 1),
                        ),
                        const SizedBox(width: 8),
                        _buildCornerDashTab(
                          number: 3,
                          label: "Precautions",
                          isActive: _activeDashboard == 2,
                          onTap: () => setState(() => _activeDashboard = 2),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // DYNAMIC ACCURATE VITALS (HEALTH SCORE & ENERGY LEVEL)
            VitalsCards(
              healthScore: healthScore,
              healthStatus: healthStatus,
              energyLevel: energyLevel,
              energyStatus: energyStatus,
            ),

            // DASHBOARD VIEW CONTAINER
            Expanded(
              child: IndexedStack(
                index: _activeDashboard,
                children: [
                  // 1 - DAILY ROUTINE
                  Dashboard1Screen(
                    todayFoods: _todayFoods,
                    steps: _steps,
                    waterL: _waterL,
                    onAddWater: _addWater,
                    onUpdateSteps: _updateSteps,
                    onFoodLogged: _loadAllData,
                  ),

                  // 2 - WHAT TO DO
                  Dashboard2Screen(
                    exerciseData: _exerciseData,
                    nextDaySuggestions: _nextDaySuggestions,
                    activityMinutes: _activityMins,
                    onWorkoutCompleted: _handleWorkoutCompleted,
                  ),

                  // 3 - PRECAUTIONS & GUIDANCE
                  Dashboard3Screen(
                    todayFoods: _todayFoods,
                    steps: _steps,
                    activityMinutes: _activityMins,
                    nextDaySuggestions: _nextDaySuggestions,
                    onLogFood: () => setState(() => _activeDashboard = 0),
                    onStartExercise: () => setState(() => _activeDashboard = 1),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCornerDashTab({
    required int number,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: isActive ? const Color(0x3306B6D4) : Colors.white.withOpacity(0.04),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isActive ? AppTheme.cyan : Colors.white12,
            width: 1.2,
          ),
          boxShadow: isActive
              ? [BoxShadow(color: AppTheme.cyan.withOpacity(0.3), blurRadius: 10)]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 18,
              height: 18,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isActive ? AppTheme.cyan : Colors.white24,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                "$number",
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: isActive ? const Color(0xFF020617) : Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: isActive ? Colors.white : AppTheme.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

