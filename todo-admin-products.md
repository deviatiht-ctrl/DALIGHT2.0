# Admin Products Fix - TODO

## Issues:
- ❌ Design/layout broken
- ❌ Loading spinner forever  
- ❌ "Ajouter produit" button does nothing

**Root cause**: Same **Supabase timing issue** as reservations!

## Plan: [6 Steps]

### [ ] Step 1: admin/js/admin-core.js  
- Add `window.dalightAdminSupabase` + `window.dalightAdminReady`

### [ ] Step 2: admin/js/products.js
- Add `waitForSupabase()` → 15s + global check + auto-refresh
- Fix import → use `window.dalightAdminSupabase`

### [ ] Step 3: admin/products.html
- Script order: core → products
- Add Supabase CDN

### [ ] Step 4: Test normal load  
```
http://localhost:3000/admin/products.html
```

### [ ] Step 5: Test add product modal  
- Click "Ajouter un produit" → Modal opens
- Fill form → Save works

### [ ] Step 6: Production verify
- ✅ Complete
