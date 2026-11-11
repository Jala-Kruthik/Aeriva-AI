import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../services/api_service.dart';
import 'main_navigation_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({Key? key}) : super(key: key);

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  bool _isLoading = false;
  String _errorMsg = "";
  bool _isConnectionError = false;

  // Controllers
  final _emailCtrl = TextEditingController(text: "kruthik@example.com");
  final _passCtrl = TextEditingController(text: "password123");
  final _nameCtrl = TextEditingController(text: "Kruthik");
  final _ageCtrl = TextEditingController(text: "24");
  final _heightCtrl = TextEditingController(text: "175");
  final _weightCtrl = TextEditingController(text: "68");
  String _goal = "Maintain health";
  String _activeBaseUrl = ApiService.defaultBaseUrl;

  @override
  void initState() {
    super.initState();
    ApiService.getBaseUrl().then((url) {
      if (mounted) setState(() => _activeBaseUrl = url);
    });
  }

  void _showServerConfigDialog() {
    final urlCtrl = TextEditingController(text: _activeBaseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.cardBg,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppTheme.borderCyan),
        ),
        title: const Row(
          children: [
            Icon(Icons.dns_rounded, color: AppTheme.cyan, size: 20),
            SizedBox(width: 8),
            Text("API Server Settings", style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "To access your API 24/7 with computer OFF, deploy the backend to a cloud host (Render/Railway) and enter the URL below:",
              style: TextStyle(color: AppTheme.textMuted, fontSize: 11.5, height: 1.4),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: urlCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 13),
              decoration: InputDecoration(
                labelText: "Backend Base URL",
                labelStyle: const TextStyle(color: AppTheme.textMuted, fontSize: 12),
                hintText: "https://aeriva-backend.onrender.com",
                hintStyle: TextStyle(color: Colors.white.withOpacity(0.2)),
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ActionChip(
                  label: const Text("Local Mac (172.20.108.19)", style: TextStyle(fontSize: 10)),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: AppTheme.cyan),
                  onPressed: () => urlCtrl.text = "http://172.20.108.19:8000",
                ),
                ActionChip(
                  label: const Text("Android Emulator (10.0.2.2)", style: TextStyle(fontSize: 10)),
                  backgroundColor: const Color(0xFF1E293B),
                  labelStyle: const TextStyle(color: AppTheme.cyan),
                  onPressed: () => urlCtrl.text = "http://10.0.2.2:8000",
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Cancel", style: TextStyle(color: AppTheme.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.cyan),
            onPressed: () async {
              final newUrl = urlCtrl.text.trim();
              if (newUrl.isNotEmpty) {
                await ApiService.setBaseUrl(newUrl);
                if (mounted) setState(() => _activeBaseUrl = newUrl);
              }
              Navigator.of(ctx).pop();
            },
            child: const Text("Save & Connect", style: TextStyle(color: Color(0xFF020617), fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _isLoading = true;
      _errorMsg = "";
      _isConnectionError = false;
    });

    if (_isLogin) {
      final res = await ApiService.login(_emailCtrl.text.trim(), _passCtrl.text);
      if (res['success'] == true) {
        final profile = await ApiService.getProfile() ?? {'name': 'Player'};
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => MainNavigationScreen(userProfile: profile)),
          );
        }
      } else {
        setState(() {
          _errorMsg = res['message'] ?? 'Login failed';
          _isConnectionError = res['isConnectionError'] == true;
          _isLoading = false;
        });
      }
    } else {
      final res = await ApiService.register(
        name: _nameCtrl.text.trim(),
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text,
        age: int.tryParse(_ageCtrl.text) ?? 25,
        height: double.tryParse(_heightCtrl.text) ?? 172.0,
        weight: double.tryParse(_weightCtrl.text) ?? 68.0,
        goal: _goal,
      );
      if (res['success'] == true) {
        // Auto login
        final loginRes = await ApiService.login(_emailCtrl.text.trim(), _passCtrl.text);
        if (loginRes['success'] == true) {
          final profile = await ApiService.getProfile() ?? {'name': _nameCtrl.text.trim()};
          if (mounted) {
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(builder: (_) => MainNavigationScreen(userProfile: profile)),
            );
          }
          return;
        }
      }
      setState(() {
        _errorMsg = res['message'] ?? 'Registration failed';
        _isConnectionError = res['isConnectionError'] == true;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.voidBg,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
            child: Container(
              padding: const EdgeInsets.all(24.0),
              decoration: BoxDecoration(
                color: AppTheme.cardBg,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppTheme.borderCyan, width: 1.2),
                boxShadow: const [
                  BoxShadow(color: Color(0x3306B6D4), blurRadius: 24, spreadRadius: 0),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Logo
                  Center(
                    child: Container(
                      width: 52,
                      height: 52,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppTheme.cyan,
                        borderRadius: BorderRadius.circular(14),
                        boxShadow: const [
                          BoxShadow(color: Color(0x6606B6D4), blurRadius: 16),
                        ],
                      ),
                      child: const Text("A", style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF020617))),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Center(
                    child: Text(
                      "AERIVA AI",
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: 1.2),
                    ),
                  ),
                  const Center(
                    child: Text(
                      "Dual Dashboard Mobile Health Companion",
                      style: TextStyle(fontSize: 11.5, color: AppTheme.textMuted),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Switcher Tabs
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _isLogin = true),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: _isLogin ? AppTheme.cyan : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                "LOGIN",
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  color: _isLogin ? const Color(0xFF020617) : AppTheme.textMuted,
                                ),
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: InkWell(
                            onTap: () => setState(() => _isLogin = false),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: !_isLogin ? AppTheme.cyan : Colors.transparent,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                "REGISTER",
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 12,
                                  color: !_isLogin ? const Color(0xFF020617) : AppTheme.textMuted,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // Error text with smart offline recovery
                  if (_errorMsg.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.all(12.0),
                      margin: const EdgeInsets.only(bottom: 14.0),
                      decoration: BoxDecoration(
                        color: AppTheme.rose.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.rose.withOpacity(0.35)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _errorMsg,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppTheme.rose, fontSize: 11.5, fontWeight: FontWeight.w600, height: 1.3),
                          ),
                          if (_isConnectionError) ...[
                            const SizedBox(height: 10),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.cyan,
                                padding: const EdgeInsets.symmetric(vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: const Icon(Icons.offline_bolt_rounded, size: 16, color: Color(0xFF020617)),
                              label: const Text(
                                "⚡ Continue in Offline Mode Anyway",
                                style: TextStyle(color: Color(0xFF020617), fontSize: 11, fontWeight: FontWeight.w900),
                              ),
                              onPressed: () {
                                final enteredName = _nameCtrl.text.trim().isNotEmpty
                                    ? _nameCtrl.text.trim()
                                    : (_emailCtrl.text.split('@').first.isNotEmpty
                                        ? _emailCtrl.text.split('@').first
                                        : "Player");
                                Navigator.of(context).pushReplacement(
                                  MaterialPageRoute(
                                    builder: (_) => MainNavigationScreen(
                                      userProfile: {
                                        'name': enteredName,
                                        'email': _emailCtrl.text.trim(),
                                      },
                                    ),
                                  ),
                                );
                              },
                            ),
                          ],
                        ],
                      ),
                    ),

                  if (!_isLogin) ...[
                    TextField(
                      controller: _nameCtrl,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(labelText: "Full Name", labelStyle: TextStyle(color: AppTheme.textMuted)),
                    ),
                    const SizedBox(height: 10),
                  ],

                  TextField(
                    controller: _emailCtrl,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Email Address", labelStyle: TextStyle(color: AppTheme.textMuted)),
                  ),
                  const SizedBox(height: 10),

                  TextField(
                    controller: _passCtrl,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: const InputDecoration(labelText: "Password", labelStyle: TextStyle(color: AppTheme.textMuted)),
                  ),
                  const SizedBox(height: 10),

                  if (!_isLogin) ...[
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _ageCtrl,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(labelText: "Age", labelStyle: TextStyle(color: AppTheme.textMuted)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _heightCtrl,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(labelText: "Height (cm)", labelStyle: TextStyle(color: AppTheme.textMuted)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _weightCtrl,
                            keyboardType: TextInputType.number,
                            style: const TextStyle(color: Colors.white),
                            decoration: const InputDecoration(labelText: "Weight (kg)", labelStyle: TextStyle(color: AppTheme.textMuted)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    DropdownButtonFormField<String>(
                      value: _goal,
                      dropdownColor: AppTheme.cardBg,
                      decoration: const InputDecoration(labelText: "Health Goal", labelStyle: TextStyle(color: AppTheme.textMuted)),
                      items: ["Maintain health", "Fat loss", "Muscle gain", "Increase stamina"]
                          .map((g) => DropdownMenuItem(value: g, child: Text(g, style: const TextStyle(color: Colors.white))))
                          .toList(),
                      onChanged: (v) => setState(() => _goal = v ?? "Maintain health"),
                    ),
                    const SizedBox(height: 10),
                  ],

                  const SizedBox(height: 14),

                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.green,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _isLoading ? null : _submit,
                    child: _isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Color(0xFF020617), strokeWidth: 2))
                        : Text(
                            _isLogin ? "LOGIN → ENTER DASHBOARD" : "CREATE ACCOUNT → START",
                            style: const TextStyle(fontWeight: FontWeight.w900, color: Color(0xFF020617)),
                          ),
                  ),

                  const SizedBox(height: 12),

                  // Offline / Standalone mode button (works when computer is OFF)
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppTheme.cyanLight,
                      side: const BorderSide(color: AppTheme.borderCyan),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    icon: const Icon(Icons.offline_bolt_rounded, size: 16),
                    onPressed: () {
                      Navigator.of(context).pushReplacement(
                        MaterialPageRoute(
                          builder: (_) => const MainNavigationScreen(userProfile: {'name': 'Player (Offline)'}),
                        ),
                      );
                    },
                    label: const Text(
                      "⚡ USE OFFLINE (NO COMPUTER NEEDED)",
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                  ),

                  const SizedBox(height: 10),

                  // Server config button (Local Wi-Fi vs Cloud 24/7)
                  TextButton.icon(
                    onPressed: _showServerConfigDialog,
                    icon: const Icon(Icons.settings_ethernet_rounded, size: 14, color: AppTheme.textMuted),
                    label: Text(
                      "Server: $_activeBaseUrl",
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: AppTheme.textMuted,
                        decoration: TextDecoration.underline,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

