import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Current local network IP of your Mac: 172.20.108.19
  // (Works for physical phones connected to same Wi-Fi and emulators)
  static String defaultBaseUrl = "http://172.20.108.19:8000";
  static String baseUrl = defaultBaseUrl;

  static const Duration _timeout = Duration(seconds: 5);

  static Future<String> getBaseUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final customUrl = prefs.getString('aeriva_api_url');
    if (customUrl != null && customUrl.trim().isNotEmpty) {
      baseUrl = customUrl.trim().replaceAll(RegExp(r'/+$'), '');
    } else {
      baseUrl = defaultBaseUrl;
    }
    return baseUrl;
  }

  static Future<void> setBaseUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    final clean = url.trim().replaceAll(RegExp(r'/+$'), '');
    await prefs.setString('aeriva_api_url', clean);
    baseUrl = clean;
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('aeriva_token');
  }

  static Future<void> setToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('aeriva_token', token);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('aeriva_token');
    await prefs.remove('aeriva_user_name');
  }

  static Future<Map<String, dynamic>> login(String email, String password) async {
    final host = await getBaseUrl();
    try {
      final res = await http
          .post(
            Uri.parse('$host/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(_timeout);

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 && data['access_token'] != null) {
        await setToken(data['access_token']);
        return {'success': true, 'data': data};
      }
      return {'success': false, 'message': data['detail'] ?? 'Invalid credentials'};
    } catch (e) {
      return {
        'success': false,
        'isConnectionError': true,
        'message': 'Cannot reach server at $host.\nMake sure backend is running or use Offline Mode.'
      };
    }
  }

  static Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String password,
    required int age,
    required double height,
    required double weight,
    required String goal,
  }) async {
    final host = await getBaseUrl();
    try {
      final res = await http
          .post(
            Uri.parse('$host/register'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name,
              'email': email,
              'password': password,
              'age': age,
              'height': height,
              'weight': weight,
              'health_goal': goal,
            }),
          )
          .timeout(_timeout);

      final data = jsonDecode(res.body);
      if (res.statusCode == 200 || res.statusCode == 201) {
        return {'success': true, 'data': data};
      }
      return {'success': false, 'message': data['detail'] ?? 'Registration failed'};
    } catch (e) {
      return {
        'success': false,
        'isConnectionError': true,
        'message': 'Cannot reach server at $host.\nMake sure backend is running or use Offline Mode.'
      };
    }
  }

  static Future<Map<String, dynamic>?> getProfile() async {
    final host = await getBaseUrl();
    final token = await getToken();
    try {
      final res = await http
          .get(
            Uri.parse('$host/me'),
            headers: {
              if (token != null) 'Authorization': 'Bearer $token',
            },
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (_) {}
    return null;
  }

  static Future<List<dynamic>> getTodayFoods() async {
    final host = await getBaseUrl();
    final token = await getToken();
    try {
      final res = await http
          .get(
            Uri.parse('$host/food/log/today'),
            headers: {
              if (token != null) 'Authorization': 'Bearer $token',
            },
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (_) {}
    return [];
  }

  static Future<bool> logFoodBatch(String mealType, List<Map<String, dynamic>> items) async {
    final host = await getBaseUrl();
    final token = await getToken();
    if (token == null) return false;
    try {
      final res = await http
          .post(
            Uri.parse('$host/food/log/batch'),
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $token',
            },
            body: jsonEncode({
              'meal_type': mealType,
              'items': items,
            }),
          )
          .timeout(_timeout);

      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<Map<String, dynamic>> getExerciseRecommendation({int steps = 0, double? calories}) async {
    final host = await getBaseUrl();
    final token = await getToken();
    try {
      final payload = <String, dynamic>{'steps': steps};
      if (calories != null) payload['daily_calories'] = calories;

      final res = await http
          .post(
            Uri.parse('$host/exercise/recommend'),
            headers: {
              'Content-Type': 'application/json',
              if (token != null) 'Authorization': 'Bearer $token',
            },
            body: jsonEncode(payload),
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (_) {}
    return {};
  }

  static Future<Map<String, dynamic>> getNextDayFoodSuggestions() async {
    final host = await getBaseUrl();
    final token = await getToken();
    try {
      final res = await http
          .get(
            Uri.parse('$host/food/suggestions/next-day'),
            headers: {
              if (token != null) 'Authorization': 'Bearer $token',
            },
          )
          .timeout(_timeout);

      if (res.statusCode == 200) {
        return jsonDecode(res.body);
      }
    } catch (_) {}
    return {};
  }
}
