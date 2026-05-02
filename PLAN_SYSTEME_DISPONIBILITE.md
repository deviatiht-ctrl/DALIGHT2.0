# PLAN SISTÈM AVILABILITE REZÈVASYON

## 1. ESTRUKTIRI TAB (SQL)

### Tab: `availability_rules` (Règ jeneral avilabilite)
```sql
CREATE TABLE IF NOT EXISTS availability_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Dimanch, 6=Samdi
    time_slot TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    max_capacity INTEGER DEFAULT 1, -- Kantite rezèvasyon max pou tan sa
    service_type TEXT DEFAULT 'all', -- 'all' oswa id servis espesifik
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(day_of_week, time_slot)
);
```

### Tab: `availability_exceptions` (Eksepsyon - jou espesifik bloke)
```sql
CREATE TABLE IF NOT EXISTS availability_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exception_date DATE NOT NULL,
    time_slot TIME, -- NULL si tout jou a bloke
    is_blocked BOOLEAN DEFAULT true,
    max_capacity INTEGER, -- Override kantite si pa bloke
    reason TEXT, -- Rezon bloke (opsyonèl)
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(exception_date, time_slot)
);
```

### Tab: `reservations` (Modifye - ajoute verification)
```sql
-- Tab rezèvasyon egzistan, verifye l kolòn yo kòrèk
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));
```

## 2. DONNE INITIAL (Règ default)

```sql
-- Règ default: Samdi 9h-17h disponib, Dimanch fèmen
INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity) VALUES
-- Samdi (6)
(6, '09:00', true, 2),
(6, '10:00', true, 2),
(6, '11:00', true, 2),
(6, '12:00', true, 1), -- Midi - mwens kapasite
(6, '13:00', true, 2),
(6, '14:00', true, 2),
(6, '15:00', true, 2),
(6, '16:00', true, 2),
(6, '17:00', true, 1),
-- Lòt jou - fèmen (oubyen ou ka ouvri si ou vle)
(0, '00:00', false, 0); -- Dimanch fèmen
```

## 3. FONKSYON POU KONTWOLE AVILABILITE

```sql
-- Fonksyon pou verifye si yon dat/tan disponib
CREATE OR REPLACE FUNCTION check_availability(
    p_date DATE,
    p_time TIME,
    p_service_id UUID DEFAULT NULL
)
RETURNS TABLE (
    is_available BOOLEAN,
    remaining_slots INTEGER,
    total_capacity INTEGER,
    current_bookings INTEGER
) AS $$
DECLARE
    v_day_of_week INTEGER;
    v_rule RECORD;
    v_exception RECORD;
    v_current_bookings INTEGER;
BEGIN
    v_day_of_week := EXTRACT(DOW FROM p_date);
    
    -- 1. Tcheke si gen eksepsyon pou dat/tan sa
    SELECT * INTO v_exception
    FROM availability_exceptions
    WHERE exception_date = p_date
      AND (time_slot = p_time OR time_slot IS NULL);
      
    IF FOUND THEN
        IF v_exception.is_blocked THEN
            RETURN QUERY SELECT false, 0, 0, 0;
            RETURN;
        ELSE
            -- Eksepsyon ki modifye kapasite
            SELECT COUNT(*) INTO v_current_bookings
            FROM reservations
            WHERE reservation_date = p_date
              AND reservation_time = p_time
              AND status NOT IN ('cancelled');
              
            RETURN QUERY SELECT 
                true,
                GREATEST(0, v_exception.max_capacity - v_current_bookings),
                v_exception.max_capacity,
                v_current_bookings;
            RETURN;
        END IF;
    END IF;
    
    -- 2. Tcheke règ jeneral
    SELECT * INTO v_rule
    FROM availability_rules
    WHERE day_of_week = v_day_of_week
      AND time_slot = p_time;
      
    IF NOT FOUND OR NOT v_rule.is_available THEN
        RETURN QUERY SELECT false, 0, 0, 0;
        RETURN;
    END IF;
    
    -- 3. Konte rezèvasyon ki egziste deja
    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations
    WHERE reservation_date = p_date
      AND reservation_time = p_time
      AND status NOT IN ('cancelled');
    
    RETURN QUERY SELECT 
        v_current_bookings < v_rule.max_capacity,
        GREATEST(0, v_rule.max_capacity - v_current_bookings),
        v_rule.max_capacity,
        v_current_bookings;
END;
$$ LANGUAGE plpgsql;

-- Fonksyon pou jere kolizyon rezèvasyon
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
DECLARE
    v_available RECORD;
    v_existing INTEGER;
BEGIN
    -- Verifye avilabilite
    SELECT * INTO v_available
    FROM check_availability(NEW.reservation_date, NEW.reservation_time);
    
    IF NOT v_available.is_available OR v_available.remaining_slots <= 0 THEN
        RAISE EXCEPTION 'Tan sa pa disponib oswa konplè: % %', 
            NEW.reservation_date, NEW.reservation_time;
    END IF;
    
    -- Verifikasyon final anvan ensèsyon
    SELECT COUNT(*) INTO v_existing
    FROM reservations
    WHERE reservation_date = NEW.reservation_date
      AND reservation_time = NEW.reservation_time
      AND status NOT IN ('cancelled')
      AND (NEW.id IS NULL OR id != NEW.id); -- Eksepte update nan menm rezèvasyon
    
    IF v_existing >= v_available.total_capacity THEN
        RAISE EXCEPTION 'Tan sa fen ranpli. Chwazi yon lòt tan.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplike triggè a
DROP TRIGGER IF EXISTS check_availability_trigger ON reservations;
CREATE TRIGGER check_availability_trigger
    BEFORE INSERT OR UPDATE ON reservations
    FOR EACH ROW
    EXECUTE FUNCTION prevent_double_booking();
```

## 4. API POU ADMIN (Fonksyon RPC)

```sql
-- Fonksyon pou admin kreye/modifye règ
CREATE OR REPLACE FUNCTION admin_set_availability(
    p_day_of_week INTEGER,
    p_time_slot TIME,
    p_is_available BOOLEAN,
    p_max_capacity INTEGER,
    p_admin_id UUID
)
RETURNS JSONB AS $$
BEGIN
    -- Verifye si moun nan admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Akse refize: Seul admin ka modifye avilabilite';
    END IF;
    
    INSERT INTO availability_rules (day_of_week, time_slot, is_available, max_capacity)
    VALUES (p_day_of_week, p_time_slot, p_is_available, p_max_capacity)
    ON CONFLICT (day_of_week, time_slot) 
    DO UPDATE SET 
        is_available = EXCLUDED.is_available,
        max_capacity = EXCLUDED.max_capacity,
        updated_at = NOW();
        
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Règ avilabilite aktyalize'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonksyon pou admin bloke yon dat espesifik
CREATE OR REPLACE FUNCTION admin_block_date(
    p_date DATE,
    p_time_slot TIME, -- NULL pou tout jou
    p_reason TEXT,
    p_is_blocked BOOLEAN DEFAULT true,
    p_max_capacity INTEGER DEFAULT NULL,
    p_admin_id UUID
)
RETURNS JSONB AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_admin_id AND role = 'admin') THEN
        RAISE EXCEPTION 'Akse refize';
    END IF;
    
    INSERT INTO availability_exceptions (exception_date, time_slot, is_blocked, max_capacity, reason, created_by)
    VALUES (p_date, p_time_slot, p_is_blocked, p_max_capacity, p_reason, p_admin_id)
    ON CONFLICT (exception_date, time_slot)
    DO UPDATE SET 
        is_blocked = EXCLUDED.is_blocked,
        max_capacity = EXCLUDED.max_capacity,
        reason = EXCLUDED.reason;
        
    RETURN jsonb_build_object('success', true, 'blocked', p_is_blocked);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonksyon pou jere tout disponiblite yon mwa
CREATE OR REPLACE FUNCTION get_month_availability(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
    date DATE,
    time_slot TIME,
    is_available BOOLEAN,
    max_capacity INTEGER,
    current_bookings INTEGER,
    remaining_slots INTEGER
) AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_current_date DATE;
    v_slot TIME;
BEGIN
    v_start_date := make_date(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;
    
    RETURN QUERY
    WITH date_range AS (
        SELECT generate_series(v_start_date, v_end_date, '1 day'::INTERVAL)::DATE as d
    ),
    time_slots AS (
        SELECT DISTINCT time_slot FROM availability_rules WHERE is_available = true
    ),
    all_combinations AS (
        SELECT d.d as date, t.time_slot
        FROM date_range d
        CROSS JOIN time_slots t
    ),
    booking_counts AS (
        SELECT reservation_date, reservation_time, COUNT(*) as cnt
        FROM reservations
        WHERE reservation_date BETWEEN v_start_date AND v_end_date
          AND status NOT IN ('cancelled')
        GROUP BY reservation_date, reservation_time
    )
    SELECT 
        ac.date,
        ac.time_slot,
        (check_availability(ac.date, ac.time_slot)).is_available,
        (check_availability(ac.date, ac.time_slot)).total_capacity,
        COALESCE(bc.cnt, 0),
        (check_availability(ac.date, ac.time_slot)).remaining_slots
    FROM all_combinations ac
    LEFT JOIN booking_counts bc ON ac.date = bc.reservation_date AND ac.time_slot = bc.reservation_time
    ORDER BY ac.date, ac.time_slot;
END;
$$ LANGUAGE plpgsql;
```

## 5. LOJIK FRONTEND

### Paj Admin (`/admin/availability.html`)
- **Kalandryè vizyèl**: Wè tout tan ak koulè (vèt=disponib, rouj=bloke, jòn=ranpli)
- **Klike sou tan**: Modal pou modifye:
  - Toggle disponib/indenisp
  - Chanje kantite max rezèvasyon
  - Blokaj espesyal pou jou sa a sèlman
- **Bouton "Bloke Jou"**: Pou bloke tout yon jou espesifik
- **Sovgade**: Bouton pou anrejistre tout chanjman yo

### Paj Rezèvasyon (Modifye)
- **Chaje tan disponib sèlman**: Sèvi ak fonksyon `check_availability`
- **Afiche plas ki rete**: "2 plas ki rete" oswa "Konplè"
- **Disable tan ranpli**: Bouton pa klike si pa gen plas
- **Koulè diferen**: Vèt (disponib), Jòn (MWENS plas), Rouj (konplè)

## 6. RLS (Row Level Security)

```sql
-- Admin ka li/modifye tout
CREATE POLICY "Admins can manage availability" ON availability_rules
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Piblik ka wè sèlman
CREATE POLICY "Public can view availability" ON availability_rules
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Menm bagay pou exceptions
CREATE POLICY "Admins can manage exceptions" ON availability_exceptions
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public can view exceptions" ON availability_exceptions
    FOR SELECT
    TO anon, authenticated
    USING (true);
```

## 7. FLOW KI MACHE

### Flow Kliyan:
1. Kliyan al sou paj rezèvasyon
2. Chwazi dat → Requet ajaks pou tan disponib
3. Chwazi tan ki gen plas → Afiche "X plas ki rete"
4. Ranpli fòm → Soumèt
5. Triggè verifikasyon → Si tan an gen plas, anrejistre
6. Si tan an fen ranpli, montre erè: "Tan sa fen ranpli"

### Flow Admin:
1. Admin konekte → Admin/Availability
2. Wè kalandryè ak tout tan ak koulè
3. Klike sou tan pou modifye:
   - Bloke/Debloke tan an
   - Chanje kantite max
   - Ajoute eksepsyon pou jou sa
4. Sovgade → SQL update
5. Nouvo kliyan wè chanjman an direk

## 8. EKZEMP ITILIZASYON

```javascript
// Frontend: Chaje tan disponib pou yon dat
const { data, error } = await supabase
    .rpc('get_month_availability', { 
        p_year: 2025, 
        p_month: 1 
    });

// Frontend: Verifikasyon avan rezèvasyon
const { data } = await supabase
    .rpc('check_availability', {
        p_date: '2025-01-15',
        p_time: '14:00:00'
    });
// Retounen: { is_available: true, remaining_slots: 1, ... }

// Admin: Bloke yon tan
const { data } = await supabase
    .rpc('admin_block_date', {
        p_date: '2025-01-20',
        p_time_slot: '10:00:00',
        p_reason: 'Fèt admin',
        p_is_blocked: true,
        p_admin_id: user.id
    });
```
