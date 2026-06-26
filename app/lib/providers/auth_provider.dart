import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const _kAdminEmails = [
  'laurorejeanclarens0@gmail.com',
  'dalightbeauty15mai@gmail.com',
];

class AuthProvider extends ChangeNotifier {
  final _client = Supabase.instance.client;

  String? _error;
  bool _loading = false;

  String? get error => _error;
  bool get loading => _loading;
  User? get currentUser => _client.auth.currentUser;
  bool get isLoggedIn => currentUser != null;

  Future<bool> signIn(String email, String password) async {
    _error = null;
    _loading = true;
    notifyListeners();

    try {
      final res = await _client.auth.signInWithPassword(
        email: email.trim(),
        password: password,
      );

      if (res.user == null) {
        _error = 'Connexion échouée';
        _loading = false;
        notifyListeners();
        return false;
      }

      if (!_kAdminEmails.contains(res.user!.email?.toLowerCase())) {
        await _client.auth.signOut();
        _error = 'Accès réservé aux administrateurs';
        _loading = false;
        notifyListeners();
        return false;
      }

      _loading = false;
      notifyListeners();
      return true;
    } on AuthException catch (e) {
      _error = e.message;
      _loading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Erreur inattendue';
      _loading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
    notifyListeners();
  }
}
