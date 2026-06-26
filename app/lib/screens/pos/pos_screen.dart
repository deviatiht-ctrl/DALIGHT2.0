import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_colors.dart';
import '../../models/models.dart';
import '../../providers/pos_provider.dart';

class POSScreen extends StatefulWidget {
  const POSScreen({super.key});

  @override
  State<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends State<POSScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final pos = context.read<PosProvider>();
      if (pos.filteredItems.isEmpty && !pos.loading) {
        pos.loadAll();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosProvider>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Point de Vente'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_outlined),
            onPressed: pos.loadAll,
          ),
        ],
      ),
      body: Column(
        children: [
          // Type selector
          _TypeSelector(
            selected: pos.type,
            onSelect: context.read<PosProvider>().setType,
          ),

          // Search
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: TextField(
              controller: _searchCtrl,
              onChanged: pos.setQuery,
              decoration: InputDecoration(
                hintText: 'Rechercher...',
                prefixIcon: const Icon(Icons.search, size: 20),
                suffixIcon: _searchCtrl.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchCtrl.clear();
                          pos.setQuery('');
                        },
                      )
                    : null,
                contentPadding: const EdgeInsets.symmetric(
                    vertical: 10, horizontal: 14),
              ),
            ),
          ),

          // Category filter
          if (pos.categories.length > 1)
            _CategoryBar(
              categories: pos.categories,
              selected: pos.category,
              onSelect: pos.setCategory,
            ),

          // Items grid
          Expanded(
            child: pos.loading
                ? const Center(
                    child: CircularProgressIndicator(
                        color: AppColors.accent))
                : pos.filteredItems.isEmpty
                    ? _EmptyState(type: pos.type)
                    : GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate:
                            const SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: 2,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                          childAspectRatio: 0.85,
                        ),
                        itemCount: pos.filteredItems.length,
                        itemBuilder: (ctx, i) {
                          final item = pos.filteredItems[i];
                          return _ItemCard(
                            item: item,
                            onTap: () => pos.addItem(item),
                          );
                        },
                      ),
          ),
        ],
      ),

      // Cart FAB
      floatingActionButton: pos.cartCount > 0
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/pos/cart'),
              backgroundColor: AppColors.accent,
              foregroundColor: Colors.white,
              icon: Badge(
                label: Text('${pos.cartCount}'),
                child: const Icon(Icons.shopping_cart_outlined),
              ),
              label: Text(
                  '${NumberFormat('#,###', 'fr').format(pos.cartTotal.toInt())} G'),
            )
          : null,
    );
  }
}

// ─── Type Selector ────────────────────────────────────────────────────────────

class _TypeSelector extends StatelessWidget {
  final String selected;
  final void Function(String) onSelect;

  const _TypeSelector({required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final types = [
      ('services', 'Services', Icons.spa_outlined),
      ('products', 'Produits', Icons.inventory_2_outlined),
      ('formations', 'Formations', Icons.school_outlined),
    ];
    return Container(
      color: AppColors.surface,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      child: Row(
        children: types.map((t) {
          final isSelected = selected == t.$1;
          return Expanded(
            child: GestureDetector(
              onTap: () => onSelect(t.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.symmetric(horizontal: 4),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.accent : AppColors.surfaceVar,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(t.$3,
                        size: 16,
                        color: isSelected
                            ? Colors.white
                            : AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      t.$2,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isSelected
                            ? Colors.white
                            : AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

class _CategoryBar extends StatelessWidget {
  final List<String> categories;
  final String selected;
  final void Function(String) onSelect;

  const _CategoryBar({
    required this.categories,
    required this.selected,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) {
          final cat = categories[i];
          final isSelected = cat == selected;
          final label = cat == 'all' ? 'Tous' : cat;
          return FilterChip(
            label: Text(label),
            selected: isSelected,
            onSelected: (_) => onSelect(cat),
            selectedColor: AppColors.accent,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppColors.textMuted,
              fontSize: 12,
              fontWeight:
                  isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          );
        },
      ),
    );
  }
}

// ─── Item Card ────────────────────────────────────────────────────────────────

class _ItemCard extends StatelessWidget {
  final PosItem item;
  final VoidCallback onTap;

  const _ItemCard({required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###', 'fr');
    final isFormation = item.type == 'formation';

    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isFormation
                  ? AppColors.warning.withOpacity(0.4)
                  : AppColors.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category tag
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isFormation
                      ? AppColors.warning.withOpacity(0.12)
                      : AppColors.accentLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  item.category ?? item.type,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color:
                        isFormation ? AppColors.warning : AppColors.accent,
                  ),
                ),
              ),

              const SizedBox(height: 8),

              // Name
              Text(
                item.name,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.text,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),

              if (item.duration != null && item.duration!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  item.duration!,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.textMuted),
                ),
              ],

              const Spacer(),

              // Formation fee breakdown
              if (isFormation && item.priceHtg > 0) ...[
                if (item.fraisInscription > 0)
                  _FeeRow(
                      'Inscription',
                      '${fmt.format(item.fraisInscription)} G'),
                if (item.fraisBlouse > 0)
                  _FeeRow('Blouse',
                      '${fmt.format(item.fraisBlouse)} G'),
                if (item.participation > 0)
                  _FeeRow('Participation',
                      '${fmt.format(item.participation)} G'),
                const Divider(height: 8),
              ],

              // Price
              item.priceHtg > 0
                  ? Text(
                      isFormation
                          ? 'Total: ${fmt.format(item.priceHtg.toInt())} G'
                          : '${fmt.format(item.priceHtg.toInt())} G',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: isFormation
                            ? AppColors.warning
                            : AppColors.accent,
                      ),
                    )
                  : const Text(
                      'Sur demande',
                      style: TextStyle(
                          fontSize: 11,
                          fontStyle: FontStyle.italic,
                          color: AppColors.textMuted),
                    ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeeRow extends StatelessWidget {
  final String label;
  final String value;

  const _FeeRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 10, color: AppColors.textMuted)),
          Text(value,
              style: const TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  final String type;

  const _EmptyState({required this.type});

  @override
  Widget build(BuildContext context) {
    final labels = {
      'services': 'Aucun service',
      'products': 'Aucun produit',
      'formations': 'Aucune formation',
    };
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.inbox_outlined,
              size: 48, color: AppColors.textLight),
          const SizedBox(height: 12),
          Text(
            labels[type] ?? 'Aucun article',
            style: const TextStyle(color: AppColors.textMuted),
          ),
        ],
      ),
    );
  }
}
