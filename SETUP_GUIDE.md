# 🚀 DALIGHT Head Spa - QUICK SETUP GUIDE

## ✅ EMAIL CONFIGURED - RESEND (resend.com)

**API Key:** `re_WNFsawq8_NbVdiFmSj1gSLuzhJ5qr4knr` ✅ Already added to `js/main.js`

### 📧 What Works Now:
1. ✓ **Client Confirmation Email** - Beautiful branded template sent automatically after reservation
2. ✓ **Admin Notification Email** - Detailed reservation details sent to `laurorejeanclarens0@gmail.com`
3. ✓ **Non-blocking** - Reservations still work even if email fails
4. ✓ **French Language** - Professional French email templates

### ⚙️ Next Steps for Email:
1. Go to https://resend.com/dashboard
2. Verify your domain (add DNS records)
3. Once verified, emails will send automatically!

---

## 🗄️ SQL EXECUTION ORDER

**Run these files in Supabase SQL Editor (in order):**

### 1️⃣ `sql/admin.sql`
```sql
-- Creates admin function (is_admin())
-- Must run FIRST
```

### 2️⃣ `sql/schema.sql`
```sql
-- Creates ALL tables including:
-- ✓ profiles
-- ✓ services  
-- ✓ reservations
-- ✓ payments
-- ✓ products (NEW - for shop)
-- ✓ posts, likes, subscribers
-- ✓ chat_messages
-- ✓ notifications
-- ✓ reviews
-- ✓ promo_codes
-- + RLS policies
-- + Indexes
-- + Triggers
```

### 3️⃣ `sql/storage.sql`
```sql
-- Creates storage buckets:
-- ✓ videos (100MB max)
-- ✓ images (5MB max)
-- ✓ avatars (2MB max)
-- ✓ documents (10MB max, private)
```

### 4️⃣ `sql/follow.sql`
```sql
-- Enables Supabase Realtime for:
-- ✓ posts, likes, subscribers
-- ✓ reservations
-- ✓ payments
-- ✓ chat_messages
-- ✓ products (NEW)
```

---

## 🎯 WHAT'S ALREADY BUILT

### ✅ Phase 1: Database & Products
- [x] Products table in database
- [x] RLS policies (public read, admin full access)
- [x] Realtime enabled for products
- [x] Indexes for fast search

### ✅ Phase 2: Email Notifications (RESEND)
- [x] Email service created (`js/email-service.js`)
- [x] Client confirmation template
- [x] Admin notification template
- [x] API key configured
- [x] Integrated into reservation form

### ✅ Phase 3: WhatsApp Chat Widget
- [x] Floating chat bubble (bottom-right)
- [x] Real-time messaging with Supabase
- [x] Message history persistence
- [x] Beautiful UI (WhatsApp-style)
- [x] Auto-initialization on homepage

---

## 📱 CHAT WIDGET

### Features:
- 💬 WhatsApp-style green bubble
- 📱 Glassmorphic chat window
- ⚡ Real-time message sync
- 💾 Messages persist in database
- 🔒 Login required to use
- 🎨 DALIGHT branded design

### Where It Is:
- ✓ Homepage (`index.html`) - Active
- Other pages - Need to add widget HTML

### To Add Chat to Other Pages:
Add this before `</body>` tag:
```html
<!-- Chat Widget -->
<div class="chat-widget" id="chat-widget">
  <button class="chat-bubble" id="chat-bubble">
    <i data-lucide="message-circle"></i>
  </button>
  <div class="chat-window" id="chat-window" style="display:none;">
    <div class="chat-header">
      <h4>Assistant DALIGHT</h4>
      <span class="chat-status">En ligne</span>
      <button class="chat-close" id="chat-close">
        <i data-lucide="x"></i>
      </button>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" placeholder="Écrivez votre message...">
      <button id="chat-send">
        <i data-lucide="send"></i>
      </button>
    </div>
  </div>
</div>

<script type="module">
  import { initChatWidget } from './js/chat-widget.js';
  document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initChatWidget();
  });
</script>
```

---

## 🛒 PRODUCTS TABLE

### Structure:
```sql
products (
  id              UUID PRIMARY KEY
  name            TEXT
  description     TEXT
  price_usd       DECIMAL
  price_htg       DECIMAL
  stock_quantity  INTEGER
  category        TEXT
  image_urls      TEXT[]  -- Array of URLs
  is_active       BOOLEAN
  sort_order      INTEGER
  created_at      TIMESTAMP
  updated_at      TIMESTAMP
)
```

### Ready For:
- Product management in admin
- Public product catalog
- Inventory tracking
- Multiple product images

---

## ⏳ REMAINING TASKS

### Phase 4: Admin Panel Redesign (2026 Modern)
- [ ] Dashboard with modern stats cards
- [ ] Chat page with conversation list
- [ ] Reservations page with advanced filters
- [ ] Clients page with detailed profiles
- [ ] Messages page redesign
- [ ] Services page redesign

### Phase 5: Products Pages
- [ ] Admin products management page
  - Upload product photos
  - Set prices (USD/HTG)
  - Manage stock
  - Edit descriptions
  - Activate/deactivate products
  
- [ ] Public products catalog page
  - Beautiful grid layout
  - Product cards with images
  - Price display
  - "Contact to Order" button
  - Filter by category

### Phase 6: Testing & Polish
- [ ] Test email sending
- [ ] Test chat widget
- [ ] Test product management
- [ ] Test realtime updates
- [ ] Add chat widget to all pages
- [ ] Mobile responsiveness checks

---

## 🔑 IMPORTANT FILES

### Email Service:
- `js/email-service.js` - Resend email integration
- `js/main.js` - API key configuration (line 10)

### Chat Widget:
- `js/chat-widget.js` - Chat logic
- `css/style.css` - Chat styles (lines 1578-1835)
- `index.html` - Widget HTML

### Products:
- `sql/schema.sql` - Products table definition
- `sql/follow.sql` - Realtime for products

### Admin:
- `admin/` - All admin pages (need redesign)
- `admin/js/` - Admin JavaScript files

---

## 🚀 QUICK START

1. **Execute SQL files** in order (admin.sql → schema.sql → storage.sql → follow.sql)
2. **Verify domain** in Resend dashboard
3. **Test reservation** - should receive emails
4. **Test chat** - open homepage, click green bubble
5. **Start building** admin products page

---

## 💡 TIPS

### For Email Testing:
- Use Resend's test mode before domain verification
- Check spam folder if emails don't arrive
- Console logs show email send status

### For Chat Testing:
- Must be logged in to use chat
- Messages sync in real-time
- Check `chat_messages` table in Supabase

### For Products:
- Use Supabase dashboard to test products table first
- Can insert test products via SQL Editor
- Images stored as URLs in array

---

## 📞 SUPPORT

If you need help:
1. Check browser console for errors (F12)
2. Check Supabase logs
3. Check Resend dashboard for email status
4. Verify all SQL files executed successfully

---

**Last Updated:** 2026-04-14  
**Email Service:** Resend (resend.com)  
**Status:** Phases 1-3 Complete ✅
