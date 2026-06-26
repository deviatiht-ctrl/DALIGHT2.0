# DALIGHT Admin — Application Mobile Flutter

Application mobile native pour la gestion du salon DALIGHT.

## Fonctionnalités
- **Login sécurisé** — Accès réservé aux admins
- **Dashboard** — Statistiques du jour (réservations, ventes, clients)
- **POS** — Point de Vente (Services, Produits, Formations) avec reçu
- **Réservations** — Liste + confirmation/annulation
- **Services** — Catalogue avec activation/désactivation
- **Clients** — Liste des clients

---

## Installation

### 1. Prérequis
- Flutter SDK ≥ 3.3.0 → https://flutter.dev/docs/get-started/install
- Dart SDK ≥ 3.3.0 (inclus avec Flutter)
- Android Studio ou VS Code avec extension Flutter

### 2. Créer le projet Flutter de base
```bash
# Dans le dossier DALIGHT/
flutter create app --project-name dalight_admin --org com.dalight
```

> ⚠️ Ne pas écraser les fichiers `lib/` — copier uniquement les dossiers
> `android/`, `ios/`, `windows/`, `macos/`, `web/`, `linux/` générés.

### 3. Copier le logo
```
Copier assets/images/logodaligth.png depuis la racine du projet DALIGHT
vers app/assets/images/logodaligth.png
```

### 4. Installer les dépendances
```bash
cd app
flutter pub get
```

### 5. Lancer l'application
```bash
# Android (émulateur ou device)
flutter run

# Build APK
flutter build apk --release
```

---

## Structure
```
app/lib/
├── main.dart                    # Point d'entrée
├── core/
│   ├── app_colors.dart          # Couleurs DALIGHT
│   ├── app_theme.dart           # Thème Material 3
│   └── router.dart              # Navigation go_router
├── models/
│   └── models.dart              # PosItem, OrderItem, Reservation, Client
├── providers/
│   ├── auth_provider.dart       # Authentification Supabase
│   └── pos_provider.dart        # État POS
└── screens/
    ├── auth/login_screen.dart
    ├── shell/app_shell.dart
    ├── dashboard/dashboard_screen.dart
    ├── pos/
    │   ├── pos_screen.dart      # Catalogue items
    │   ├── cart_screen.dart     # Panier + checkout
    │   └── receipt_screen.dart  # Reçu final
    ├── reservations/reservations_screen.dart
    ├── services/services_screen.dart
    └── clients/clients_screen.dart
```

---

## Comptes Admin
- `laurorejeanclarens0@gmail.com`
- `dalightbeauty15mai@gmail.com`

---

## Supabase
- URL: `https://rbwoiejztrkghfkpxquo.supabase.co`
- Projet: DALIGHT Production
