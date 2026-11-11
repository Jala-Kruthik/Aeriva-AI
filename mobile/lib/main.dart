import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/app_theme.dart';
import 'services/api_service.dart';
import 'screens/auth_screen.dart';
import 'screens/main_navigation_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppTheme.voidBg,
    ),
  );

  // Initialize active API server URL
  await ApiService.getBaseUrl();

  final token = await ApiService.getToken();
  Map<String, dynamic>? profile;
  if (token != null) {
    profile = await ApiService.getProfile();
  }

  runApp(AerivaMobileApp(initialProfile: profile));
}

class AerivaMobileApp extends StatelessWidget {
  final Map<String, dynamic>? initialProfile;

  const AerivaMobileApp({Key? key, this.initialProfile}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AERIVA AI',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: initialProfile != null
          ? MainNavigationScreen(userProfile: initialProfile!)
          : const AuthScreen(),
    );
  }
}

