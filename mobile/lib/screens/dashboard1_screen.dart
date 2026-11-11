import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';

class Dashboard1Screen extends StatefulWidget {
  final List<dynamic> todayFoods;
  final int steps;
  final double waterL;
  final Function(double) onAddWater;
  final Function(int) onUpdateSteps;
  final VoidCallback onFoodLogged;

  const Dashboard1Screen({
    Key? key,
    required this.todayFoods,
    required this.steps,
    required this.waterL,
    required this.onAddWater,
    required this.onUpdateSteps,
    required this.onFoodLogged,
  }) : super(key: key);

  @override
  State<Dashboard1Screen> createState() => _Dashboard1ScreenState();
}

class _Dashboard1ScreenState extends State<Dashboard1Screen> {
  void _openAddFoodDialog() {
    final nameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController(text: "1");

    final loggedTypes = widget.todayFoods
        .map((f) => (f['meal_type'] as String? ?? '').toLowerCase())
        .toSet();

    // Default to the first unlogged meal
    String mealType = "Breakfast";
    for (final m in ["Breakfast", "Lunch", "Snack", "Dinner"]) {
      if (!loggedTypes.contains(m.toLowerCase())) {
        mealType = m;
        break;
      }
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: AppTheme.cardBg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: const BorderSide(color: AppTheme.borderCyan),
          ),
          title: const Text("+ LOG FOOD EATEN", style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.cyanLight, fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                value: mealType,
                dropdownColor: AppTheme.cardBg,
                decoration: const InputDecoration(labelText: "Meal Type", labelStyle: TextStyle(color: AppTheme.textMuted)),
                items: ["Breakfast", "Lunch", "Snack", "Dinner"].map((m) {
                  final isLogged = loggedTypes.contains(m.toLowerCase());
                  return DropdownMenuItem(
                    value: m,
                    child: Text(
                      isLogged ? "$m (✓ Logged)" : m,
                      style: TextStyle(
                        color: isLogged ? AppTheme.greenLight : Colors.white,
                        fontSize: 13,
                        fontWeight: isLogged ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: (v) => setDlgState(() => mealType = v ?? "Breakfast"),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameCtrl,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: "Food Item (e.g. 2 Idlis with Sambar)",
                  labelStyle: TextStyle(color: AppTheme.textMuted),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: qtyCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  labelText: "Quantity (Servings)",
                  labelStyle: TextStyle(color: AppTheme.textMuted),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text("CANCEL", style: TextStyle(color: AppTheme.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.green),
              onPressed: () async {
                final name = nameCtrl.text.trim();
                final qty = double.tryParse(qtyCtrl.text.trim()) ?? 1.0;
                if (name.isNotEmpty) {
                  Navigator.pop(ctx);
                  final ok = await ApiService.logFoodBatch(mealType, [
                    {'food_name': name, 'quantity': qty}
                  ]);
                  if (ok) {
                    widget.onFoodLogged();
                  }
                }
              },
              child: const Text("SAVE MEAL", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF020617))),
            ),
          ],
        ),
      ),
    );
  }

  void _openStepDialog() {
    final stepCtrl = TextEditingController(text: "${widget.steps}");
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.borderCyan),
        ),
        title: const Text("👟 LOG TODAY'S STEPS", style: TextStyle(fontWeight: FontWeight.w900, color: AppTheme.cyanLight, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: stepCtrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
              decoration: const InputDecoration(
                labelText: "Total Steps Walked",
                labelStyle: TextStyle(color: AppTheme.textMuted),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: [5000, 8000, 10000, 12000].map((preset) => ActionChip(
                backgroundColor: Colors.white10,
                label: Text("$preset", style: const TextStyle(color: AppTheme.cyanLight, fontSize: 11)),
                onPressed: () => stepCtrl.text = "$preset",
              )).toList(),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("CANCEL", style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.cyan),
            onPressed: () {
              final s = int.tryParse(stepCtrl.text.trim()) ?? widget.steps;
              Navigator.pop(ctx);
              widget.onUpdateSteps(s);
            },
            child: const Text("SAVE STEPS", style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF020617))),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    int totalCals = 0;
    for (var f in widget.todayFoods) {
      totalCals += (f['calories'] as num?)?.toInt() ?? 0;
    }

    final km = (widget.steps * 0.00075).toStringAsFixed(1);
    final burnCals = (widget.steps * 0.04).round();
    final stepPct = (widget.steps / 10000.0).clamp(0.0, 1.0);
    final waterPct = (widget.waterL / 2.5).clamp(0.0, 1.0);

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. TODAY'S SCHEDULE TIMELINE
          _buildCardHeader("TODAY'S SCHEDULE", "Daily Routine", null),
          _buildRoutineTimeline(),
          const SizedBox(height: 16),

          // 2. WHAT FOOD WE EAT
          _buildCardHeader("NUTRITION INTAKE", "What Food We Eat", "$totalCals kcal"),
          _buildFoodCard(totalCals),
          const SizedBox(height: 16),

          // 3. STEPS WALKED
          _buildCardHeader("ACTIVITY & STEPS", "Steps Walked", "${widget.steps.toString()} / 10,000"),
          _buildStepsCard(km, burnCals, stepPct),
          const SizedBox(height: 16),

          // 4. WATER WE DRANK
          _buildCardHeader("HYDRATION TRACKER", "Water We Drank", "${widget.waterL.toStringAsFixed(2)} L / 2.5 L"),
          _buildWaterCard(waterPct),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildCardHeader(String kicker, String title, String? statBadge) {
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
          if (statBadge != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0x2606B6D4),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.cyanLight.withOpacity(0.3)),
              ),
              child: Text(statBadge, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppTheme.cyanLight)),
            ),
        ],
      ),
    );
  }

  Widget _buildRoutineTimeline() {
    final loggedTypes = widget.todayFoods
        .map((f) => (f['meal_type'] as String? ?? '').toLowerCase())
        .toSet();

    final routines = [
      {"time": "07:00 – 07:30", "title": "Morning Wakeup & Hydration", "tag": "ROUTINE", "color": AppTheme.cyanLight},
      {
        "time": "08:30 – 09:00",
        "title": loggedTypes.contains("breakfast") ? "Breakfast (✓ Logged)" : "Breakfast & Nutrition Fuel",
        "tag": loggedTypes.contains("breakfast") ? "✓ LOGGED" : "MEAL",
        "color": loggedTypes.contains("breakfast") ? AppTheme.greenLight : AppTheme.amberLight
      },
      {
        "time": "13:00 – 13:45",
        "title": loggedTypes.contains("lunch") ? "Lunch (✓ Logged)" : "Lunch Fuel & Midday Reset",
        "tag": loggedTypes.contains("lunch") ? "✓ LOGGED" : "MEAL",
        "color": loggedTypes.contains("lunch") ? AppTheme.greenLight : AppTheme.amberLight
      },
      {"time": "17:30 – 17:50", "title": "Scheduled Exercise Window", "tag": "WORKOUT", "color": AppTheme.greenLight},
      {
        "time": "20:30 – 21:00",
        "title": loggedTypes.contains("dinner") ? "Dinner (✓ Logged)" : "Dinner & Wind-Down",
        "tag": loggedTypes.contains("dinner") ? "✓ LOGGED" : "MEAL",
        "color": loggedTypes.contains("dinner") ? AppTheme.greenLight : AppTheme.rose
      },
    ];

    return Container(
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderSubtle),
      ),
      child: Column(
        children: routines.map((r) => ListTile(
          dense: true,
          leading: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: (r['color'] as Color).withOpacity(0.15),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(r['tag'] as String, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: r['color'] as Color)),
          ),
          title: Text(r['title'] as String, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: Colors.white)),
          trailing: Text(r['time'] as String, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
        )).toList(),
      ),
    );
  }

  Widget _buildFoodCard(int totalCals) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderCyan),
      ),
      child: Column(
        children: [
          if (widget.todayFoods.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16.0),
              child: Text("No meals logged yet today. Click below to add.", style: TextStyle(color: AppTheme.textMuted, fontSize: 12)),
            )
          else
            ...widget.todayFoods.map((f) => Padding(
              padding: const EdgeInsets.only(bottom: 10.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      const Text("🍱 ", style: TextStyle(fontSize: 18)),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(f['food_name'] ?? 'Meal', style: const TextStyle(fontWeight: FontWeight.w700, color: Colors.white, fontSize: 13)),
                          Text("${f['meal_type'] ?? 'Meal'} · Qty: ${f['quantity'] ?? 1}", style: const TextStyle(fontSize: 11, color: AppTheme.textMuted)),
                        ],
                      ),
                    ],
                  ),
                  Text("${f['calories'] ?? 0} kcal", style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.greenLight, fontSize: 13)),
                ],
              ),
            )),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0x2606B6D4),
                foregroundColor: AppTheme.cyanLight,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: const BorderSide(color: AppTheme.cyan)),
              ),
              icon: const Icon(Icons.add, size: 18),
              label: const Text("+ LOG MEAL", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12)),
              onPressed: _openAddFoodDialog,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepsCard(String km, int burnCals, double pct) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderCyan),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text("$km km walked", style: const TextStyle(color: AppTheme.textMuted, fontSize: 12)),
              Text("~$burnCals kcal burned", style: const TextStyle(color: AppTheme.amberLight, fontSize: 12, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: Colors.white10,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.cyan),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.cyanLight,
                side: const BorderSide(color: AppTheme.borderCyan),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              onPressed: _openStepDialog,
              child: const Text("UPDATE / LOG STEPS", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWaterCard(double pct) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderCyan),
      ),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: Colors.white10,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.cyan),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.cyan,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () => widget.onAddWater(0.25),
                  child: const Text("+250 ML QUICK ADD", style: TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF020617), fontSize: 11)),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppTheme.textMuted,
                  side: const BorderSide(color: Colors.white24),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => widget.onAddWater(0.50),
                child: const Text("+500 ML", style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

