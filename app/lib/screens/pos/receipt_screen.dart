import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/app_colors.dart';

class ReceiptScreen extends StatelessWidget {
  final String receiptNo;
  final List<Map<String, dynamic>> items;
  final double total;
  final String payMethod;
  final String payChoice;
  final String? clientName;

  const ReceiptScreen({
    super.key,
    required this.receiptNo,
    required this.items,
    required this.total,
    required this.payMethod,
    required this.payChoice,
    this.clientName,
  });

  static const _payLabels = {
    'cash': 'Cash',
    'moncash': 'MonCash',
    'natcash': 'NatCash',
    'bank': 'Virement bancaire',
  };

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###', 'fr');
    final deposit = (total * 0.5).toInt();
    final amountDue = payChoice == 'deposit' ? deposit : total.toInt();
    final balance = payChoice == 'deposit' ? total.toInt() - deposit : 0;
    final now = DateTime.now();
    final dateStr = DateFormat('dd/MM/yyyy HH:mm', 'fr_FR').format(now);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Reçu'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.go('/pos'),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.share_outlined),
            onPressed: () {
              // Share receipt text
              final text = _buildReceiptText(fmt, dateStr, amountDue, balance);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(text.split('\n').first)),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            // Receipt card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.04),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Header
                  const Text(
                    'DALIGHT',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.accent,
                      letterSpacing: 4,
                    ),
                  ),
                  const Text(
                    "L'Art du Bien-Être",
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(height: 4),
                  const Text(
                    'Delmas 65, Faustin Premier Durandise #10',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                  const Text(
                    '+509 47 47 72 21',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),

                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(),
                  ),

                  // Receipt info
                  _InfoRow('Reçu N°', receiptNo),
                  _InfoRow('Date', dateStr),
                  if (clientName != null) _InfoRow('Client', clientName!),
                  _InfoRow('Paiement', _payLabels[payMethod] ?? payMethod),

                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(),
                  ),

                  // Items
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Articles',
                      style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: AppColors.textMuted),
                    ),
                  ),
                  const SizedBox(height: 8),

                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${item['name']} × ${item['qty']}',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            Text(
                              '${fmt.format(item['total_htg'] as int)} G',
                              style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      )),

                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(),
                  ),

                  // Totals
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Sous-total',
                          style: TextStyle(color: AppColors.textMuted)),
                      Text('${fmt.format(total.toInt())} G'),
                    ],
                  ),

                  if (payChoice == 'deposit') ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Acompte versé',
                            style: TextStyle(color: AppColors.textMuted)),
                        Text('${fmt.format(amountDue)} G',
                            style: const TextStyle(
                                color: AppColors.warning,
                                fontWeight: FontWeight.w600)),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Solde restant',
                            style: TextStyle(
                                color: AppColors.textMuted, fontSize: 12)),
                        Text('${fmt.format(balance)} G',
                            style: const TextStyle(
                                color: AppColors.danger, fontSize: 12)),
                      ],
                    ),
                  ],

                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppColors.accentLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'TOTAL ENCAISSÉ',
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: AppColors.accent),
                        ),
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
                  ),

                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(),
                  ),

                  // Footer
                  const Text(
                    'Merci de votre visite !',
                    style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: AppColors.text),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '@dalightbeauty  ·  TikTok: @dalightbeauty',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                  const Text(
                    'dalightbeauty15mai@gmail.com',
                    style: TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ce reçu est votre preuve d\'achat. Conservez-le.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        fontSize: 10,
                        color: AppColors.textLight,
                        fontStyle: FontStyle.italic),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // Actions
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/pos'),
                    icon: const Icon(Icons.add_shopping_cart_outlined),
                    label: const Text('Nouvelle vente'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => context.go('/dashboard'),
                    icon: const Icon(Icons.home_outlined),
                    label: const Text('Dashboard'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _buildReceiptText(NumberFormat fmt, String dateStr, int amountDue, int balance) {
    final lines = [
      'DALIGHT — Reçu $receiptNo',
      'Date: $dateStr',
      if (clientName != null) 'Client: $clientName',
      '---',
      ...items.map((i) => '${i['name']} x${i['qty']} = ${fmt.format(i['total_htg'])} G'),
      '---',
      'TOTAL: ${fmt.format(amountDue)} G',
      'Paiement: ${_payLabels[payMethod] ?? payMethod}',
    ];
    return lines.join('\n');
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.textMuted)),
          Text(value,
              style: const TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
