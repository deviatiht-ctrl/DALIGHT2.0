import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../screens/auth/login_screen.dart';
import '../screens/shell/app_shell.dart';
import '../screens/dashboard/dashboard_screen.dart';
import '../screens/pos/pos_screen.dart';
import '../screens/pos/cart_screen.dart';
import '../screens/pos/receipt_screen.dart';
import '../screens/reservations/reservations_screen.dart';
import '../screens/services/services_screen.dart';
import '../screens/clients/clients_screen.dart';

class _AuthListenable extends ChangeNotifier {
  late final StreamSubscription<AuthState> _sub;

  _AuthListenable() {
    _sub = Supabase.instance.client.auth.onAuthStateChange.listen((_) {
      notifyListeners();
    });
  }

  @override
  void dispose() {
    _sub.cancel();
    super.dispose();
  }
}

final _authListenable = _AuthListenable();

final appRouter = GoRouter(
  initialLocation: '/dashboard',
  refreshListenable: _authListenable,
  redirect: (context, state) {
    final session = Supabase.instance.client.auth.currentSession;
    final isLoggedIn = session != null;
    final isLoginRoute = state.matchedLocation == '/login';

    if (!isLoggedIn && !isLoginRoute) return '/login';
    if (isLoggedIn && isLoginRoute) return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/pos/cart',
      builder: (context, state) => const CartScreen(),
    ),
    GoRoute(
      path: '/pos/receipt',
      builder: (context, state) {
        final data = state.extra as Map<String, dynamic>? ?? {};
        return ReceiptScreen(
          receiptNo: data['receiptNo'] as String? ?? '',
          items: data['items'] as List<Map<String, dynamic>>? ?? [],
          total: (data['total'] as num?)?.toDouble() ?? 0,
          payMethod: data['payMethod'] as String? ?? 'cash',
          payChoice: data['payChoice'] as String? ?? 'full',
          clientName: data['clientName'] as String?,
        );
      },
    ),
    ShellRoute(
      builder: (context, state, child) => AppShell(
        location: state.matchedLocation,
        child: child,
      ),
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/pos',
          builder: (context, state) => const POSScreen(),
        ),
        GoRoute(
          path: '/reservations',
          builder: (context, state) => const ReservationsScreen(),
        ),
        GoRoute(
          path: '/services',
          builder: (context, state) => const ServicesScreen(),
        ),
        GoRoute(
          path: '/clients',
          builder: (context, state) => const ClientsScreen(),
        ),
      ],
    ),
  ],
);
