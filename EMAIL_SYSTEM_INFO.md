# 📧 DALIGHT - Email Notification System

## ✅ Status: Configured but Requires Backend

### Current Setup

The email notification system is **already implemented** in the codebase:

1. **Email Service**: `js/email-service.js` - Uses Resend API
2. **Integration**: `js/reservation.js` (lines 262-279)
3. **API Key**: Configured in `js/main.js` (line 10)

### How It Works

When a user creates a reservation:

```javascript
// In js/reservation.js (line 278-279)
sendReservationEmail(emailData, false); // Sends to client
sendReservationEmail(emailData, true);  // Sends to admin
```

**Two emails are sent automatically:**

1. **Client Confirmation Email**
   - Sent to: User's email
   - From: DALIGHT Head Spa <concierge@dalight.com>
   - Subject: "✓ Confirmation de Réservation - DALIGHT Head Spa"
   - Contains: Service details, date, time, location, notes

2. **Admin Notification Email**
   - Sent to: laurorejeanclarens0@gmail.com
   - From: DALIGHT Reservations <noreply@dalight.com>
   - Subject: "🔔 Nouvelle Réservation Reçue"
   - Contains: Client info, reservation details, total amount

### ⚠️ Important: Backend Required

**The Resend API cannot be called directly from the browser for security reasons:**

- **Problem**: API key would be exposed to users
- **Solution**: Need a backend server (Node.js, PHP, etc.)

### Current Behavior

Without a backend:
- ✅ Email data is prepared correctly
- ✅ All reservation info is captured
- ❌ API call will fail (CORS/security)
- ✅ Reservation is still saved to Supabase
- ✅ User is redirected to orders.html

### 🔧 To Enable Email Notifications

You have 3 options:

#### Option 1: Use Supabase Edge Functions (Recommended)
```bash
# Create a Supabase Edge Function
supabase functions new send-email

# Deploy
supabase functions deploy send-email
```

#### Option 2: Use a Simple Backend
Create `api/send-email.js` with Node.js + Express:
```javascript
const express = require('express');
const router = express.Router();

router.post('/send-email', async (req, res) => {
  // Call Resend API here
  // API key stays on server
});
```

#### Option 3: Use Email.js Service (Temporary)
For now, reservations work without emails:
- ✅ Data saved in Supabase
- ✅ Admin can see reservations in dashboard
- ✅ Client can see in orders.html
- ❌ No email notifications yet

### 📊 Where to See Reservations

**Admin Panel:**
- URL: `admin/dashboard.html`
- View all reservations
- See status, client info, details

**Client Panel:**
- URL: `pages/orders.html`
- See own reservations
- Chat with admin

**Database:**
- Table: `reservations` in Supabase
- All data is saved immediately

### Summary

✅ **What Works:**
- Reservation form submission
- Data saved to Supabase
- Admin can view reservations
- Client can view own reservations
- Chat widget available

⚠️ **What Needs Backend:**
- Email notifications (Resend API)
- Automatic confirmations

🔒 **Why:**
- API keys cannot be exposed in browser
- Security best practice
- Requires server-side code

### Next Steps

To enable emails, you need to:
1. Set up Supabase Edge Functions OR
2. Create a simple Node.js/PHP backend OR
3. Use a serverless function (Vercel, Netlify, etc.)

For now, the system works perfectly without emails - all data is saved and accessible in the admin dashboard and orders page.
