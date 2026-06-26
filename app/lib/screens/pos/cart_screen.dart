import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/app_colors.dart';
import '../../models/models.dart';
import '../../providers/pos_provider.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _payChoice = 'full';
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    final pos = context.read<PosProvider>();
    if (pos.order.isEmpty) return;

    setState(() => _saving = true);

    final items =
        pos.order.map((o) => o.toJson()).toList();
    final total = pos.cartTotal;
    final payMethod = pos.payMethod;

    final receiptNo = await pos.confirmOrder(
      clientName: _nameCtrl.text.trim().isEmpty ? null : _nameCtrl.text.trim(),
      clientPhone:
          _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
      payChoice: _payChoice,
    );

    if (!mounted) return;
    setState(() => _saving = false);

    if (receiptNo == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Erreur lors de la sauvegarde'),
          backgroundColor: AppColors.danger,
        ),
      );
      return;
    }

    pos.clearOrder();

    context.go('/pos/receipt', extra: {
      'receiptNo': receiptNo,
      'items': items,
      'total': total,
      'payMethod': payMethod,
      'payChoice': _payChoice,
      'clientName':
          _nameCtrl.text.trim().isEmpty ? null : _nameCtrl.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final pos = context.watch<PosProvider>();
    final fmt = NumberFormat('#,###', 'fr');

    final total = pos.cartTotal;
    final deposit = (total * 0.5).toInt();
    final amountDue = _payChoice == 'deposit' ? deposit : total.toInt();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Commande'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          if (pos.order.isNotEmpty)
            TextButton(
              onPressed: () {
                pos.clearOrder();
                context.pop();
              },
              child: const Text('Vider',
                  style: TextStyle(color: AppColors.danger)),
            ),
        ],
      ),
      body: pos.order.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.shopping_cart_outlined,
                      size: 56, color: AppColors.textLight),
                  SizedBox(height: 12),
                  Text('Panier vide',
                      style: TextStyle(color: AppColors.textMuted)),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Order items
                  _SectionTitle('Articles (${pos.cartCount})'),
                  const SizedBox(height: 8),
                  ...pos.order.map((o) => _OrderItemTile(
                        orderItem: o,
                        onIncrement: () =>
                            pos.updateQty(o.item.id, o.qty + 1),
                        onDecrement: () =>
                            pos.updateQty(o.item.id, o.qty - 1),
                        onRemove: () => pos.removeItem(o.item.id),
                      )),

                  const SizedBox(height: 24),

                  // Client info (optional)
                  _SectionTitle('Client (optionnel)'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Nom du client',
                      prefixIcon: Icon(Icons.person_outline),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _phoneCtrl,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Téléphone',
                      prefixIcon: Icon(Icons.phone_outlined),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Payment method
                  _SectionTitle('Méthode de paiement'),
                  const SizedBox(height: 8),
                  _PayMethodSelector(
                    selected: pos.payMethod,
                    onSelect: pos.setPayMethod,
                  ),

                  const SizedBox(height: 20),

                  // Payment type
                  _SectionTitle('Type de paiement'),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _PayChoiceTile(
                          label: 'Paiement complet',
                          subtitle:
                              '${fmt.format(total.toInt())} G',
                          selected: _payChoice == 'full',
                          onTap: () =>
                              setState(() => _payChoice = 'full'),
                          icon: Icons.check_circle_outline,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _PayChoiceTile(
                          label: 'Acompte 50%',
                          subtitle: '${fmt.format(deposit)} G',
                          selected: _payChoice == 'deposit',
                          onTap: () =>
                              setState(() => _payChoice = 'deposit'),
                          icon: Icons.timelapse_outlined,
                          color: AppColors.warning,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 24),

                  // Total card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Sous-total',
                                style:
                                    TextStyle(color: AppColors.textMuted)),
                            Text('${fmt.format(total.toInt())} G'),
                          ],
                        ),
                        if (_payChoice == 'deposit') ...[
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Acompte (50%)',
                                  style: TextStyle(
                                      color: AppColors.textMuted)),
                              Text('${fmt.format(deposit)} G',
                                  style: const TextStyle(
                                      color: AppColors.warning,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                          Row(
                            mainAxisAlignment:
                                MainAxisAlignment.spaceBetween,
                            children: [
                              const Text('Solde restant',
                                  style: TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12)),
                              Text(
                                  '${fmt.format(total.toInt() - deposit)} G',
                                  style: const TextStyle(
                                      color: AppColors.textMuted,
                                      fontSize: 12)),
                            ],
                          ),
                        ],
                        const Divider(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('À encaisser',
                                style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16)),
                            Text(
                              '${fmt.format(amountDue)} G',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 20,
                                color: AppColors.accent,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Confirm button
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _confirm,
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.check_circle_outline),
                      label: Text(
                          'Confirmer — ${fmt.format(amountDue)} G'),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }
}

// ─── Order Item Tile ──────────────────────────────────────────────────────────

class _OrderItemTile extends StatelessWidget {
  final OrderItem orderItem;
  final VoidCallback onIncrement;
  final VoidCallback onDecrement;
  final VoidCallback onRemove;

  const _OrderItemTile({
    required this.orderItem,
    required this.onIncrement,
    required this.onDecrement,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###', 'fr');
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(orderItem.item.name,
                      style: const TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600)),
                  Text(
                      '${fmt.format(orderItem.item.priceHtg.toInt())} G × ${orderItem.qty}',
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.textMuted)),
                ],
              ),
            ),
            Text(
              '${fmt.format(orderItem.total.toInt())} G',
              style: const TextStyle(
                  fontWeight: FontWeight.bold, color: AppColors.accent),
            ),
            const SizedBox(width: 8),
            // Qty controls
            Row(
              children: [
                _QtyBtn(Icons.remove, onDecrement),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text('${orderItem.qty}',
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
                _QtyBtn(Icons.add, onIncrement),
              ],
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 18, color: AppColors.danger),
              onPressed: onRemove,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            ),
          ],
        ),
      ),
    );
  }
}

class _QtyBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _QtyBtn(this.icon, this.onTap);

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, size: 16),
      ),
    );
  }
}

// ─── Payment Method ───────────────────────────────────────────────────────────

class _PayMethodSelector extends StatelessWidget {
  final String selected;
  final void Function(String) onSelect;

  const _PayMethodSelector(
      {required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    final methods = [
      ('cash', 'Cash', Icons.payments_outlined),
      ('moncash', 'MonCash', Icons.phone_android_outlined),
      ('natcash', 'NatCash', Icons.phone_android_outlined),
      ('bank', 'Virement', Icons.account_balance_outlined),
    ];
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: methods.map((m) {
        final isSelected = selected == m.$1;
        return GestureDetector(
          onTap: () => onSelect(m.$1),
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color:
                  isSelected ? AppColors.accent : AppColors.surface,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                  color: isSelected
                      ? AppColors.accent
                      : AppColors.border),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(m.$3,
                    size: 16,
                    color:
                        isSelected ? Colors.white : AppColors.textMuted),
                const SizedBox(width: 6),
                Text(
                  m.$2,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color:
                        isSelected ? Colors.white : AppColors.text,
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _PayChoiceTile extends StatelessWidget {
  final String label;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;
  final IconData icon;
  final Color color;

  const _PayChoiceTile({
    required this.label,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    required this.icon,
    this.color = AppColors.accent,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: selected ? color.withOpacity(0.08) : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: selected ? color : AppColors.border, width: selected ? 2 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 20, color: selected ? color : AppColors.textMuted),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: selected ? color : AppColors.text)),
            Text(subtitle,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: selected ? color : AppColors.textMuted)),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  final String text;

  const _SectionTitle(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: AppColors.text),
    );
  }
}
