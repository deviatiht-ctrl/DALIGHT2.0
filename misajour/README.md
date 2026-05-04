# DALIGHT — Dosye SQL Misajour

## Lòd Ekzekisyon (nan Supabase SQL Editor)

Kouri yo **youn pa youn** nan lòd sa:

| # | Fichye | Sa li fè |
|---|--------|----------|
| 1 | `01_categorie_produit.sql` | Kreye/fikse tab `product_categories` + lye ak `products` |
| 2 | `02_services_fix.sql` | **Retire constraint** `services_category_check` ki koz erreur |
| 3 | `03_headspa_prix_cheveux.sql` | Ajoute pri pa tip cheve pou Head Spa |
| 4 | `04_creneaux_fix.sql` | Fix blokaj kreno pa tip sèvis + Realtime sync |

## Aprè SQL yo — Chanjman Kòd

1. **Admin Services** → Admin ka chwazi nenpòt kategori ki nan baz la
2. **Admin Formations** → Kolòn: FORMATION | FRAIS INSCRIPTION | BLOUSE/DOCS | PARTICIPATION | DURÉE | TOTAL | STATUT | ACTION
3. **Admin Réservations** → Blokaj pa tip sèvis (headspa vs massage)
4. **Shop.html** → 2 prodwi pa kolòn, klik ale sou paj detay
5. **Réservation client** → Sync tan reyèl ak Supabase Realtime
