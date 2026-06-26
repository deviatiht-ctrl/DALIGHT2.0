import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/app_colors.dart';
import '../../providers/auth_provider.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _sb = Supabase.instance.client;

  int _todayReservations = 0;
  int _pendingReservations = 0;
  int _totalClients = 0;
  double _todayRevenue = 0;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    if (!mounted) return;
    setState(() => _loading = true);

    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

    try {
      final todayRes = await _sb
          .from('reservations')
          .select('id')
          .eq('date', today);
      _todayReservations = (todayRes as List).length;
    } catch (_) {}

    try {
      final pendingRes = await _sb
          .from('reservations')
          .select('id')
          .eq('status', 'PENDING');
      _pendingReservations = (pendingRes as List).length;
    } catch (_) {}

    try {
      final clientsRes = await _sb.from('profiles').select('id');
      _totalClients = (clientsRes as List).length;
    } catch (_) {}

    try {
      final salesRes = await _sb
          .from('pos_sales')
          .select('total_htg, amount_due_htg')
          .gte('created_at', '${today}T00:00:00')
          .lte('created_at', '${today}T23:59:59');
      double rev = 0;
      for (final s in (salesRes as List)) {
        rev += (s['amount_due_htg'] as num? ?? 0).toDouble();
      }
      _todayRevenue = rev;
    } catch (_) {}

    if (mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final fmtNum = NumberFormat('#,###', 'fr');
    final today = DateFormat('EEEE d MMMM yyyy', 'fr_FR').format(DateTime.now());

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: _loadStats,
            tooltip: 'Actualiser',
          ),
          PopupMenuButton<String>(
            onSelected: (v) {
              if (v == 'logout') auth.signOut();
            },
            itemBuilder: (_) => [
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18, color: AppColors.danger),
                    SizedBox(width: 8),
                    Text('Déconnexion',
                        style: TextStyle(color: AppColors.danger)),
                  ],
                ),
              ),
            ],
            icon: CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.accentLight,
              child: Text(
                (auth.currentUser?.email ?? 'A')[0].toUpperCase(),
                style: const TextStyle(
                    color: AppColors.accent,
                    fontWeight: FontWeight.bold,
                    fontSize: 13),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadStats,
              color: AppColors.accent,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Greeting
                    const Text(
                      'Bienvenue 👑',
                      style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: AppColors.text),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      today,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textMuted),
                    ),

                    const SizedBox(height: 28),

                    // Stats grid
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                      childAspectRatio: 1.35,
                      children: [
                        _StatCard(
                          label: "Réservations aujourd'hui",
                          value: '$_todayReservations',
                          icon: Icons.calendar_today_outlined,
                          color: AppColors.info,
                        ),
                        _StatCard(
                          label: 'Ventes du jour',
                          value: '${fmtNum.format(_todayRevenue.toInt())} G',
                          icon: Icons.point_of_sale_outlined,
                          color: AppColors.accent,
                        ),
                        _StatCard(
                          label: 'En attente',
                          value: '$_pendingReservations',
                          icon: Icons.hourglass_empty_outlined,
                          color: AppColors.warning,
                        ),
                        _StatCard(
                          label: 'Total clients',
                          value: '$_totalClients',
                          icon: Icons.people_outline,
                          color: AppColors.success,
                        ),
                      ],
                    ),

                    const SizedBox(height: 28),

                    // Quick actions
                    Text(
                      'Actions rapides',
                      style: Theme.of(context)
                          .textTheme
                          .titleMedium
                          ?.copyWith(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 14),

                    Row(
                      children: [
                        Expanded(
                          child: _QuickAction(
                            label: 'Nouvelle vente',
                            icon: Icons.add_shopping_cart_outlined,
                            color: AppColors.accent,
                            onTap: () => context.findAncestorStateOfType<NavigatorState>(),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _QuickAction(
                            label: 'Réservations',
                            icon: Icons.event_note_outlined,
                            color: AppColors.info,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: AppColors.text,
                  ),
                ),
                Text(
                  label,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;

  const _QuickAction({
    required this.label,
    required this.icon,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Row(
          children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                    fontSize: 13, color: color, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
