import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/app_colors.dart';
import '../../models/models.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  final _sb = Supabase.instance.client;
  List<ServiceModel> _services = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _sb
          .from('services')
          .select('id,name,description,category,duration,price_htg,price_usd,is_active')
          .order('category')
          .order('name');
      if (mounted) {
        setState(() {
          _services = (data as List)
              .map((m) => ServiceModel.fromMap(m))
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Services: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggleActive(String id, bool current) async {
    try {
      await _sb
          .from('services')
          .update({'is_active': !current}).eq('id', id);
      _load();
    } catch (_) {}
  }

  List<ServiceModel> get _filtered {
    if (_search.isEmpty) return _services;
    final q = _search.toLowerCase();
    return _services
        .where((s) =>
            s.name.toLowerCase().contains(q) ||
            (s.category ?? '').toLowerCase().contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Services'),
        actions: [
          IconButton(
              icon: const Icon(Icons.refresh_outlined), onPressed: _load),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              onChanged: (v) => setState(() => _search = v),
              decoration: const InputDecoration(
                hintText: 'Rechercher un service...',
                prefixIcon: Icon(Icons.search, size: 20),
                contentPadding:
                    EdgeInsets.symmetric(vertical: 10, horizontal: 14),
              ),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.accent))
                : _filtered.isEmpty
                    ? const Center(
                        child: Text('Aucun service',
                            style: TextStyle(color: AppColors.textMuted)))
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.accent,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) {
                            final s = _filtered[i];
                            return _ServiceTile(
                              service: s,
                              onToggle: () =>
                                  _toggleActive(s.id, s.isActive),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ServiceTile extends StatelessWidget {
  final ServiceModel service;
  final VoidCallback onToggle;

  const _ServiceTile({required this.service, required this.onToggle});

  @override
  Widget build(BuildContext context) {
    final s = service;
    final fmt = NumberFormat('#,###', 'fr');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            // Category indicator
            Container(
              width: 4,
              height: 48,
              decoration: BoxDecoration(
                color: s.isActive ? AppColors.accent : AppColors.border,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    s.name,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                      color: s.isActive
                          ? AppColors.text
                          : AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (s.category != null) ...[
                        _Tag(s.category!),
                        const SizedBox(width: 6),
                      ],
                      if (s.duration != null)
                        _Tag(s.duration!, icon: Icons.schedule_outlined),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${fmt.format(s.priceHtg.toInt())} G',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.accent,
                  ),
                ),
                if (s.priceUsd != null)
                  Text(
                    '\$${s.priceUsd!.toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textMuted),
                  ),
                const SizedBox(height: 4),
                Transform.scale(
                  scale: 0.8,
                  child: Switch(
                    value: s.isActive,
                    onChanged: (_) => onToggle(),
                    activeColor: AppColors.accent,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String label;
  final IconData? icon;

  const _Tag(this.label, {this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.surfaceVar,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: AppColors.textMuted),
            const SizedBox(width: 3),
          ],
          Text(
            label,
            style: const TextStyle(
                fontSize: 10, color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
