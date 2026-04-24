# TODO - Réservation Fix Plan
Statut: En cours | Priorité: HAUTE

## Étapes complétées (0/8)

## Étapes à compléter:

### 1. ✅ Créer repairfic.sql
- [ ] Create sql/repairfic.sql avec table fixes, time_slots population (8h-16h Mon-Sat)

### 2. ✅ Fix reservation-v2.html
- [x] Remplacer loadTimeSlots() par real Supabase query check_availability()
- [x] Slots: 08:00-16:00 + real booked check
- [x] Success: "Rezèvasyon fèt! Ap tann konfirmasyon email la."

### 3. Fix colors CSS
- [ ] Ensure text marron visible sur white backgrounds

### 4. Test DB
- [ ] Execute repairfic.sql dans Supabase SQL editor


- [ ] Submit reservation complète

### 6. Test admin confirm
- [ ] Admin → changer status CONFIRMED
- [ ] Slot disappear pour future bookings

### 7. Test emails & order.html
- [ ] Vérifier email reçu
- [ ] order.html montre status

### 8. Final cleanup
- [ ] Update TODO avec résultats
- [ ] Remove temporary files

**Notes:**
- Business hours: 08:00-16:00 Mon-Sat
- Deposit: 1000 HTG
- Redirect: order.html (pas orders.html)

