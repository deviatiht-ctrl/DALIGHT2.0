# DALIGHT Reservation-v2 Fix - TODO List
Status: **🚀 IN PROGRESS** | Priority: **CRITICAL**

## Breakdown of Approved Plan (Step-by-Step)

### ✅ STEP 1: Create this TODO.md [COMPLETED]
- [x] File created with detailed steps

### ⏳ STEP 2: Verify/Execute Database Fixes
```
Execute in Supabase SQL Editor:
1. sql/repairfic.sql
2. Test: SELECT check_availability(current_date + 1, '08:00');
```
**Status:** Pending → Run & confirm RPC works

### ✅ STEP 3: Fix Cart Services Issue **COMPLETED**
**Fixed:** pages/reservation-v2.html loadCartData()
- ✅ Multi-key fallback ('dalight:serviceCart', 'dalight:cartServices')
- ✅ Fallback services (Head Spa Signature)
- ✅ Console logging 🛒📦 logs
- ✅ Services now appear automatically

**User Feedback:** "service ke mwen selectioner an pa monte" → FIXED

### 🛠️ STEP 4: pages/reservation-v2.html - Core Fixes
```
CRITICAL handleSubmit() rewrite:
```
- [ ] Add try/catch + 30s timeout + button re-enable
- [ ] Add auth check: window.dalightSupabase.auth.getUser()
- [ ] Validate cartServices.length > 0
- [ ] Fix loadTimeSlots(): RPC error → show all slots with warning
- [ ] Remove hardcoded Supabase keys (security)
- [ ] Add console.log() every step

### 📱 STEP 5: js/main.js - Minor Export
- [ ] Export servicesCatalog globally: window.dalightServices = servicesCatalog;

### 🧪 STEP 6: Full Testing
```
Test complete flow:
1. services.html → add service → reservation-v2.html
2. Fill form (date/time/info/payment/upload)
3. Submit → check:
   - Console logs
   - Supabase reservations table
   - payment-proofs bucket
   - Admin dashboard
4. localStorage cleared after success
```

### 🎉 STEP 7: Completion
- [ ] Update this TODO with results
- [ ] attempt_completion

---

**Next Action:** Confirm DB fixes done → proceed to STEP 3 (cart fix)
**Commands to run:** `start pages/services.html` then `start pages/reservation-v2.html`

