import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/app_colors.dart';
import '../../models/models.dart';

class ReservationsScreen extends StatefulWidget {
  const ReservationsScreen({super.key});

  @override
  State<ReservationsScreen> createState() => _ReservationsScreenState();
}

class _ReservationsScreenState extends State<ReservationsScreen> {
  final _sb = Supabase.instance.client;
  List<ReservationModel> _all = [];
  String _statusFilter = 'all';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      var query = _sb
          .from('reservations')
          .select('id,name,email,phone,service,date,time,status,total_price')
          .order('date', ascending: false)
          .order('time', ascending: false);

      final data = await query;
      if (mounted) {
        setState(() {
          _all = (data as List)
              .map((m) => ReservationModel.fromMap(m))
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Reservations: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      await _sb
          .from('reservations')
          .update({'status': status}).eq('id', id);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('Erreur: $e'),
              backgroundColor: AppColors.danger),
        );
      }
    }
  }

  List<ReservationModel> get _filtered {
    if (_statusFilter == 'all') return _all;
    return _all
        .where((r) => r.status.toUpperCase() == _statusFilter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Réservations'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh_outlined), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          // Status filter
          SizedBox(
            height: 50,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              children: [
                _FilterChip('all', 'Toutes', _statusFilter, _setFilter),
                const SizedBox(width: 8),
                _FilterChip(
                    'PENDING', 'En attente', _statusFilter, _setFilter),
                const SizedBox(width: 8),
                _FilterChip(
                    'CONFIRMED', 'Confirmées', _statusFilter, _setFilter),
                const SizedBox(width: 8),
                _FilterChip(
                    'COMPLETED', 'Terminées', _statusFilter, _setFilter),
                const SizedBox(width: 8),
                _FilterChip(
                    'CANCELLED', 'Annulées', _statusFilter, _setFilter),
              ],
            ),
          ),

          // List
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.accent))
                : _filtered.isEmpty
                    ? const Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.event_busy_outlined,
                                size: 48, color: AppColors.textLight),
                            SizedBox(height: 12),
                            Text('Aucune réservation',
                                style: TextStyle(
                                    color: AppColors.textMuted)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.accent,
                        child: ListView.separated(
                          padding: const EdgeInsets.all(16),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 10),
                          itemBuilder: (_, i) => _ReservationCard(
                            reservation: _filtered[i],
                            onUpdateStatus: _updateStatus,
                          ),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  void _setFilter(String s) => setState(() => _statusFilter = s);
}

class _FilterChip extends StatelessWidget {
  final String value;
  final String label;
  final String selected;
  final void Function(String) onSelect;

  const _FilterChip(this.value, this.label, this.selected, this.onSelect);

  @override
  Widget build(BuildContext context) {
    final isSelected = selected == value;
    return GestureDetector(
      onTap: () => onSelect(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.accent : AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
              color: isSelected ? AppColors.accent : AppColors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : AppColors.textMuted,
          ),
        ),
      ),
    );
  }
}

class _ReservationCard extends StatelessWidget {
  final ReservationModel reservation;
  final Future<void> Function(String, String) onUpdateStatus;

  const _ReservationCard({
    required this.reservation,
    required this.onUpdateStatus,
  });

  @override
  Widget build(BuildContext context) {
    final r = reservation;
    final fmt = NumberFormat('#,###', 'fr');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    r.name ?? 'Client inconnu',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: r.statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    r.statusLabel,
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: r.statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            if (r.service != null)
              Text(r.service!,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.textMuted)),
            const SizedBox(height: 4),
            Row(
              children: [
                const Icon(Icons.calendar_today_outlined,
                    size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  '${r.date ?? ''} ${r.time != null ? '· ${r.time}' : ''}',
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textMuted),
                ),
                const Spacer(),
                if (r.totalPrice != null)
                  Text(
                    '${fmt.format(r.totalPrice!.toInt())} G',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.accent),
                  ),
              ],
            ),
            if (r.phone != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.phone_outlined,
                      size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(r.phone!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ],

            // Status actions
            if (r.status.toUpperCase() == 'PENDING') ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () =>
                          onUpdateStatus(r.id, 'CONFIRMED'),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.success,
                          side: const BorderSide(
                              color: AppColors.success),
                          padding:
                              const EdgeInsets.symmetric(vertical: 8)),
                      child: const Text('Confirmer',
                          style: TextStyle(fontSize: 12)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () =>
                          onUpdateStatus(r.id, 'CANCELLED'),
                      style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.danger,
                          side: const BorderSide(
                              color: AppColors.danger),
                          padding:
                              const EdgeInsets.symmetric(vertical: 8)),
                      child: const Text('Annuler',
                          style: TextStyle(fontSize: 12)),
                    ),
                  ),
                ],
              ),
            ] else if (r.status.toUpperCase() == 'CONFIRMED') ...[
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () =>
                      onUpdateStatus(r.id, 'COMPLETED'),
                  style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.info,
                      side:
                          const BorderSide(color: AppColors.info),
                      padding:
                          const EdgeInsets.symmetric(vertical: 8)),
                  child: const Text('Marquer comme terminée',
                      style: TextStyle(fontSize: 12)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
