import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/models.dart';

class PosProvider extends ChangeNotifier {
  final _client = Supabase.instance.client;

  List<PosItem> _services = [];
  List<PosItem> _products = [];
  List<PosItem> _formations = [];
  final List<OrderItem> _order = [];

  String _type = 'services';
  String _category = 'all';
  String _query = '';
  String _payMethod = 'cash';
  bool _loading = false;

  bool get loading => _loading;
  String get type => _type;
  String get category => _category;
  String get payMethod => _payMethod;
  List<OrderItem> get order => List.unmodifiable(_order);
  int get cartCount => _order.fold(0, (s, it) => s + it.qty);
  double get cartTotal => _order.fold(0.0, (s, it) => s + it.total);

  List<PosItem> get filteredItems {
    final src = _type == 'services'
        ? _services
        : _type == 'products'
            ? _products
            : _formations;
    return src.where((item) {
      final matchCat =
          _category == 'all' || (item.category ?? '') == _category;
      final matchQ = _query.isEmpty ||
          item.name.toLowerCase().contains(_query.toLowerCase());
      return matchCat && matchQ;
    }).toList();
  }

  List<String> get categories {
    final src = _type == 'services'
        ? _services
        : _type == 'products'
            ? _products
            : _formations;
    final cats = <String>{};
    for (final item in src) {
      if (item.category != null && item.category!.isNotEmpty) {
        cats.add(item.category!);
      }
    }
    return ['all', ...cats];
  }

  void setType(String t) {
    _type = t;
    _category = 'all';
    _query = '';
    notifyListeners();
  }

  void setCategory(String c) {
    _category = c;
    notifyListeners();
  }

  void setQuery(String q) {
    _query = q;
    notifyListeners();
  }

  void setPayMethod(String m) {
    _payMethod = m;
    notifyListeners();
  }

  void addItem(PosItem item) {
    for (final o in _order) {
      if (o.item.id == item.id) {
        o.qty++;
        notifyListeners();
        return;
      }
    }
    _order.add(OrderItem(item: item));
    notifyListeners();
  }

  void removeItem(String id) {
    _order.removeWhere((o) => o.item.id == id);
    notifyListeners();
  }

  void updateQty(String id, int qty) {
    if (qty <= 0) {
      removeItem(id);
      return;
    }
    for (final o in _order) {
      if (o.item.id == id) {
        o.qty = qty;
        notifyListeners();
        return;
      }
    }
  }

  void clearOrder() {
    _order.clear();
    _payMethod = 'cash';
    notifyListeners();
  }

  Future<void> loadAll() async {
    _loading = true;
    notifyListeners();

    try {
      final data = await _client
          .from('services')
          .select('id,name,category,duration,price_htg,price_usd')
          .eq('is_active', true)
          .order('category')
          .order('name');
      _services = data.map((m) => PosItem.fromService(m)).toList();
    } catch (e) {
      debugPrint('POS services: $e');
    }

    try {
      final data = await _client
          .from('products')
          .select('id,name,price,sale_price')
          .eq('is_active', true)
          .order('name');
      _products = data.map((m) => PosItem.fromProduct(m)).toList();
    } catch (e) {
      debugPrint('POS products: $e');
    }

    try {
      final data = await _client
          .from('formations')
          .select(
              'id,name,duration,price_inscription,price_blouse,price_cosmetique,price_corporel,price_decoration,price_massage,order_index')
          .eq('is_active', true)
          .order('order_index');
      _formations = data.map((m) => PosItem.fromFormation(m)).toList();
    } catch (e) {
      debugPrint('POS formations: $e');
    }

    _loading = false;
    notifyListeners();
  }

  Future<String?> confirmOrder({
    String? clientName,
    String? clientPhone,
    String payChoice = 'full',
  }) async {
    try {
      final now = DateTime.now();
      String pad(int n) => n.toString().padLeft(2, '0');
      final receiptNo =
          'REC-${now.year}${pad(now.month)}${pad(now.day)}-${1000 + (now.millisecondsSinceEpoch % 9000)}';

      final items = _order.map((o) => o.toJson()).toList();
      final total = cartTotal.toInt();
      final deposit = (total * 0.5).toInt();
      final amountDue = payChoice == 'deposit' ? deposit : total;
      final balance = payChoice == 'deposit' ? total - deposit : 0;

      final user = _client.auth.currentUser;
      await _client.from('pos_sales').insert({
        'receipt_no': receiptNo,
        'client_name': clientName,
        'client_phone': clientPhone,
        'items': items,
        'subtotal_htg': total,
        'deposit_htg': payChoice == 'deposit' ? deposit : 0,
        'amount_due_htg': amountDue,
        'balance_htg': balance,
        'payment_method': _payMethod,
        'payment_choice': payChoice,
        'admin_id': user?.id,
        'admin_email': user?.email,
        'status': 'completed',
      });

      return receiptNo;
    } catch (e) {
      debugPrint('POS confirmOrder: $e');
      return null;
    }
  }
}
