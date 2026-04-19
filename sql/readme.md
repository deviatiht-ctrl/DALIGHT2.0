# DALIGHT Head Spa Japonais - Scripts SQL Supabase

Ce dossier contient tous les scripts SQL nécessaires pour configurer la base de données Supabase du site DALIGHT Head Spa Japonais.

## Ordre d'exécution

**IMPORTANT:** Exécutez les scripts dans cet ordre précis pour éviter les erreurs de dépendances:

1. **`admin.sql`** - Configure la fonction d'administration et les emails admin
2. **`schema.sql`** - Crée toutes les tables et les policies RLS
3. **`storage.sql`** - Configure les buckets de stockage et leurs policies
4. **`follow.sql`** - Ajoute les fonctionnalités sociales (likes, subscribers)
5. **`seed.sql`** - Insère les données initiales (services, créneaux horaires)

## Comment exécuter

1. Ouvrez votre projet Supabase
2. Allez dans **SQL Editor**
3. Copiez-collez le contenu de chaque fichier dans l'ordre ci-dessus
4. Cliquez sur **Run** pour chaque script

## Structure des tables

### Tables principales
- `profiles` - Profils utilisateurs étendus avec rôles
- `reservations` - Réservations de massage
- `services` - Catalogue des services
- `payments` - Historique des paiements

### Tables sociales (Follow)
- `posts` - Publications (vidéos, avis)
- `likes` - Likes sur les posts
- `subscribers` - Abonnés au fil

### Tables support
- `chat_messages` - Messages client-admin
- `notifications` - Notifications utilisateur
- `time_slots` - Créneaux horaires disponibles
- `blocked_dates` - Jours de fermeture
- `promo_codes` - Codes promotionnels
- `reviews` - Avis clients

## Configuration admin

Après avoir exécuté les scripts, modifiez les emails admin dans `admin.sql` selon vos besoins.

## Notes

- Tous les scripts utilisent `IF NOT EXISTS` et `ON CONFLICT DO NOTHING` pour être idempotents
- Les policies RLS sont configurées pour sécuriser l'accès aux données
- Le bucket `videos` est public en lecture pour le streaming
