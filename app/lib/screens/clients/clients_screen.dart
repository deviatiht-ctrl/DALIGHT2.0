import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/app_colors.dart';
import '../../models/models.dart';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _sb = Supabase.instance.client;
  List<ClientModel> _clients = [];
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
          .from('profiles')
          .select('id,full_name,email,phone,avatar_url,created_at')
          .order('full_name');
      if (mounted) {
        setState(() {
          _clients = (data as List)
              .map((m) => ClientModel.fromMap(m))
              .toList();
          _loading = false;
        });
      }
    } catch (e) {
      debugPrint('Clients: $e');
      if (mounted) setState(() => _loading = false);
    }
  }

  List<ClientModel> get _filtered {
    if (_search.isEmpty) return _clients;
    final q = _search.toLowerCase();
    return _clients
        .where((c) =>
            (c.fullName ?? '').toLowerCase().contains(q) ||
            (c.email ?? '').toLowerCase().contains(q) ||
            (c.phone ?? '').contains(q))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text('Clients (${_clients.length})'),
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
                hintText: 'Rechercher un client...',
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
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.people_outline,
                                size: 48, color: AppColors.textLight),
                            SizedBox(height: 12),
                            Text('Aucun client trouvé',
                                style: TextStyle(
                                    color: AppColors.textMuted)),
                          ],
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        color: AppColors.accent,
                        child: ListView.separated(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 4),
                          itemCount: _filtered.length,
                          separatorBuilder: (_, __) =>
                              const SizedBox(height: 8),
                          itemBuilder: (_, i) =>
                              _ClientTile(client: _filtered[i]),
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ClientTile extends StatelessWidget {
  final ClientModel client;

  const _ClientTile({required this.client});

  @override
  Widget build(BuildContext context) {
    final c = client;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            // Avatar
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.accentLight,
              backgroundImage: c.avatarUrl != null
                  ? NetworkImage(c.avatarUrl!)
                  : null,
              child: c.avatarUrl == null
                  ? Text(
                      c.initials,
                      style: const TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    c.fullName ?? 'Sans nom',
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  if (c.email != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      c.email!,
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (c.phone != null) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        const Icon(Icons.phone_outlined,
                            size: 11, color: AppColors.textMuted),
                        const SizedBox(width: 3),
                        Text(
                          c.phone!,
                          style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textMuted),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const Icon(Icons.chevron_right,
                color: AppColors.textLight),
          ],
        ),
      ),
    );
  }
}
