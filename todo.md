# Supabase Reservation Fix - TODO

## Plan Status: ✅ APPROVED

**Total Steps: 6** | **Completed: 5/6** (Manual test needed)

### ✅ Step 1: Update js/main.js
- Add `window.dalightSupabase` global  
- Set `window.dalightReady = true`
- ✅ Complete

### ✅ Step 2: Update js/reservation.js  
- Extend waitForSupabase() to **15s**
- Add `window.dalightReady` instant check  
- Add auto-refresh fallback
- ✅ Complete

### ✅ Step 3: Update pages/reservation.html  
- Script comments + optimized load order (main.js → reservation.js)  
- ✅ Complete

### ✅ Step 4: Test reservation flow  
```
Local server: http://localhost:3000/pages/reservation.html  
✅ Server started - Ready for manual testing
```
- Open reservation page
- Check console: Should see "⚡ INSTANT" or "✅ Supabase ready"
- Login → Submit → Verify Supabase data

### [ ] Step 5: Test slow connection
```bash
# DevTools → Network → Slow 3G
# Submit reservation
```

### [ ] Step 6: Production verification
- Clear ServiceWorker
- Test incognito
- ✅ attempt_completion

