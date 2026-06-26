import 'package:flutter/material.dart';

// ─── POS Item ────────────────────────────────────────────────────────────────

class PosItem {
  final String id;
  final String name;
  final String type; // service | product | formation
  final String? category;
  final String? duration;
  final double priceHtg;
  final double? priceUsd;
  final int fraisInscription;
  final int fraisBlouse;
  final int participation;

  const PosItem({
    required this.id,
    required this.name,
    required this.type,
    this.category,
    this.duration,
    required this.priceHtg,
    this.priceUsd,
    this.fraisInscription = 0,
    this.fraisBlouse = 0,
    this.participation = 0,
  });

  factory PosItem.fromService(Map<String, dynamic> m) {
    final raw = (m['price_htg'] as num? ?? 0).toDouble();
    return PosItem(
      id: m['id'].toString(),
      name: m['name'] as String,
      type: 'service',
      category: m['category'] as String?,
      duration: m['duration'] as String?,
      priceHtg: (raw * 1.03).roundToDouble(),
      priceUsd: m['price_usd'] != null
          ? (((m['price_usd'] as num).toDouble() * 1.03) * 100).roundToDouble() / 100
          : null,
    );
  }

  factory PosItem.fromProduct(Map<String, dynamic> m) {
    final raw = ((m['sale_price'] ?? m['price']) as num? ?? 0).toDouble();
    return PosItem(
      id: m['id'].toString(),
      name: m['name'] as String,
      type: 'product',
      category: 'Produit',
      priceHtg: (raw * 1.03).roundToDouble(),
    );
  }

  factory PosItem.fromFormation(Map<String, dynamic> m) {
    final inscription = (m['price_inscription'] as num? ?? 0).toInt();
    final blouse = (m['price_blouse'] as num? ?? 0).toInt();
    final part = ((m['price_cosmetique'] ??
            m['price_corporel'] ??
            m['price_decoration'] ??
            m['price_massage'] ??
            0) as num)
        .toInt();
    return PosItem(
      id: m['id'].toString(),
      name: m['name'] as String,
      type: 'formation',
      category: 'Formation',
      duration: m['duration'] as String?,
      priceHtg: (inscription + blouse + part).toDouble(),
      fraisInscription: inscription,
      fraisBlouse: blouse,
      participation: part,
    );
  }
}

// ─── Order Item ──────────────────────────────────────────────────────────────

class OrderItem {
  final PosItem item;
  int qty;

  OrderItem({required this.item, this.qty = 1});

  double get total => item.priceHtg * qty;

  Map<String, dynamic> toJson() => {
        'id': item.id,
        'name': item.name,
        'type': item.type,
        'qty': qty,
        'price_htg': item.priceHtg.toInt(),
        'total_htg': total.toInt(),
      };
}

// ─── Reservation ─────────────────────────────────────────────────────────────

class ReservationModel {
  final String id;
  final String? name;
  final String? email;
  final String? phone;
  final String? service;
  final String? date;
  final String? time;
  final String status;
  final double? totalPrice;

  const ReservationModel({
    required this.id,
    this.name,
    this.email,
    this.phone,
    this.service,
    this.date,
    this.time,
    required this.status,
    this.totalPrice,
  });

  factory ReservationModel.fromMap(Map<String, dynamic> m) => ReservationModel(
        id: m['id'].toString(),
        name: m['name'] as String?,
        email: m['email'] as String?,
        phone: m['phone'] as String?,
        service: m['service'] as String?,
        date: m['date'] as String?,
        time: m['time'] as String?,
        status: (m['status'] as String?) ?? 'PENDING',
        totalPrice: (m['total_price'] as num?)?.toDouble(),
      );

  Color get statusColor {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return const Color(0xFF16A34A);
      case 'COMPLETED':
        return const Color(0xFF2563EB);
      case 'CANCELLED':
        return const Color(0xFFDC2626);
      default:
        return const Color(0xFFD97706);
    }
  }

  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return 'Confirmée';
      case 'COMPLETED':
        return 'Terminée';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return 'En attente';
    }
  }
}

// ─── Client ──────────────────────────────────────────────────────────────────

class ClientModel {
  final String id;
  final String? fullName;
  final String? email;
  final String? phone;
  final String? avatarUrl;
  final String? createdAt;

  const ClientModel({
    required this.id,
    this.fullName,
    this.email,
    this.phone,
    this.avatarUrl,
    this.createdAt,
  });

  factory ClientModel.fromMap(Map<String, dynamic> m) => ClientModel(
        id: m['id'].toString(),
        fullName: m['full_name'] as String?,
        email: m['email'] as String?,
        phone: m['phone'] as String?,
        avatarUrl: m['avatar_url'] as String?,
        createdAt: m['created_at'] as String?,
      );

  String get initials {
    final n = fullName?.trim() ?? email ?? '?';
    final parts = n.split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return n.isNotEmpty ? n[0].toUpperCase() : '?';
  }
}

// ─── Service (for Services screen) ───────────────────────────────────────────

class ServiceModel {
  final String id;
  final String name;
  final String? description;
  final String? category;
  final String? duration;
  final double priceHtg;
  final double? priceUsd;
  final bool isActive;

  const ServiceModel({
    required this.id,
    required this.name,
    this.description,
    this.category,
    this.duration,
    required this.priceHtg,
    this.priceUsd,
    this.isActive = true,
  });

  factory ServiceModel.fromMap(Map<String, dynamic> m) => ServiceModel(
        id: m['id'].toString(),
        name: m['name'] as String,
        description: m['description'] as String?,
        category: m['category'] as String?,
        duration: m['duration'] as String?,
        priceHtg: (m['price_htg'] as num? ?? 0).toDouble(),
        priceUsd: (m['price_usd'] as num?)?.toDouble(),
        isActive: m['is_active'] as bool? ?? true,
      );
}
