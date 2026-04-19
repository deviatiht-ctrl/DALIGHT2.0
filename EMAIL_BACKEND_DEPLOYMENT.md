# 🚀 Email Backend Deployment Guide

## ✅ What's Been Created

### 1. Supabase Edge Function
📁 Location: `supabase/functions/send-email/index.ts`

This function securely handles email sending using your Resend API key.

### 2. Updated Email Service
📁 Location: `js/email-service.js`

Now uses the Edge Function instead of direct API calls.

### 3. Chat Widget Fixes
📁 Location: `js/chat-widget.js`

- ✅ Modal now opens correctly on all pages
- ✅ Messages load properly
- ✅ Added console logging for debugging
- ✅ Exported `window.ChatWidget` for external access

---

## 📋 Deployment Steps

### Step 1: Install Supabase CLI

**For Windows (choose ONE method):**

#### Method 1: Winget (Recommended - Easiest)
```powershell
winget install Supabase.CLI
```

#### Method 2: Scoop
```powershell
# Install scoop first (if you don't have it):
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
irm get.scoop.sh | iex

# Then install Supabase:
scoop install supabase
```

#### Method 3: Manual Download
1. Go to: https://github.com/supabase/cli/releases
2. Download the Windows version (supabase_cli_windows_amd64.zip)
3. Extract it
4. Add to your PATH

**⚠️ DO NOT use:** `npm install -g supabase` (this is NOT supported)

**Verify installation:**
```powershell
supabase --version
```

### Step 2: Login to Supabase

```powershell
supabase login
```

A browser window will open. Login with your Supabase account.

### Step 3: Link Your Project

```powershell
cd c:\Users\HACKER\Videos\DALIGHT
supabase link --project-ref rbwoiejztrkghfkpxquo
```

### Step 4: Set Resend API Key Secret

```powershell
supabase secrets set RESEND_API_KEY=re_WNFsawq8_NbVdiFmSj1gSLuzhJ5qr4knr
```

This stores your API key securely on Supabase (not in the code).

### Step 5: Deploy the Edge Function

```powershell
supabase functions deploy send-email
```

You should see:
```
Deployed function send-email on project rbwoiejztrkghfkpxquo
```

### Step 6: Test the Function

The function is now live at:
```
https://rbwoiejztrkghfkpxquo.supabase.co/functions/v1/send-email
```

---

## 🧪 Testing

### Test 1: Create a Reservation

1. Go to: `pages/reservation.html`
2. Fill out the form
3. Submit
4. Check:
   - ✅ Reservation saved in Supabase
   - ✅ Email sent to client
   - ✅ Email sent to admin (laurorejeanclarens0@gmail.com)

### Test 2: Chat Widget

1. Open any page (services, about, shop, orders, etc.)
2. Click the chat bubble (💬)
3. Check:
   - ✅ Modal opens
   - ✅ Messages load (if any exist)
   - ✅ You can send messages

### Test 3: View Logs

In Supabase Dashboard:
1. Go to your project
2. Click "Edge Functions" in the left sidebar
3. Select "send-email"
4. Click "Logs" tab
5. You'll see all email sending attempts

---

## 🐛 Troubleshooting

### Problem: Edge Function not deploying

**Solution:**
```powershell
# Check if you're logged in
supabase status

# If not, login again
supabase login

# Then try deploying again
supabase functions deploy send-email
```

### Problem: Emails not sending

**Check:**
1. Edge Function logs in Supabase Dashboard
2. Console errors in browser (F12)
3. Verify API key is set:
   ```powershell
   supabase secrets list
   ```

### Problem: Chat modal not opening

**Check:**
1. Browser console for errors (F12)
2. Verify `initChatWidget()` is called
3. Check if chat widget HTML exists in the page

### Problem: Messages not loading

**Check:**
1. Browser console - should see "Loading messages..."
2. Verify user is logged in
3. Check Supabase `chat_messages` table has data
4. Verify RLS policies allow reading messages

---

## 📊 How It Works

### Email Flow:

```
User submits reservation
    ↓
js/reservation.js prepares email data
    ↓
js/email-service.js calls Edge Function
    ↓
Supabase Edge Function (send-email)
    ↓
Resend API (with secure API key)
    ↓
Email delivered to client & admin
```

### Chat Flow:

```
User clicks chat bubble
    ↓
initChatWidget() opens modal
    ↓
initializeChat() loads user session
    ↓
loadMessages() fetches from Supabase
    ↓
Messages displayed in chat window
    ↓
Real-time updates via Supabase subscription
```

---

## 🎯 What's Fixed

### ✅ Email Backend
- [x] Created Supabase Edge Function
- [x] Secure API key management
- [x] CORS enabled
- [x] Error handling
- [x] TypeScript code ready for deployment

### ✅ Chat Widget
- [x] Modal opens on all 7 pages
- [x] Messages load correctly
- [x] Better error messages
- [x] Console logging for debugging
- [x] External access via `window.ChatWidget`
- [x] Works with orders page

### ✅ Pages Updated
- [x] index.html
- [x] pages/services.html
- [x] pages/about.html
- [x] pages/shop.html
- [x] pages/orders.html
- [x] pages/reservation.html
- [x] pages/payment.html

---

## 📝 Next Steps (Optional)

1. **Add email templates** - Customize HTML email design
2. **Add email queue** - Retry failed emails
3. **Add admin chat panel** - Let admin respond to messages
4. **Add email notifications** - Notify on new chat messages
5. **Add file attachments** - Let users send images in chat

---

## 🔐 Security Notes

- ✅ API key stored in Supabase (not exposed in browser)
- ✅ CORS restricted to your domain
- ✅ Input validation on Edge Function
- ✅ Error messages don't leak sensitive info
- ✅ Reservations work even if email fails

---

## 📞 Support

If you need help:
1. Check Supabase Edge Function logs
2. Check browser console (F12)
3. Review this guide
4. Check `EMAIL_SYSTEM_INFO.md` for more details

---

**Status**: Ready to deploy! 🚀

Just run the 5 commands in the Deployment Steps section and you're good to go!
