# 📘 DALIGHT - Supabase Management Guide

## 📋 Table of Contents
1. [Supabase CLI Commands](#supabase-cli-commands)
2. [Email Configuration](#email-configuration)
3. [Edge Functions Management](#edge-functions-management)
4. [Common Issues & Solutions](#common-issues--solutions)

---

## 🔧 Supabase CLI Commands

### Initial Setup (One-time only)

```powershell
# 1. Add scoop to PATH (if using scoop)
$env:Path += ";C:\Users\HACKER\scoop\shims"

# 2. Verify installation
supabase --version

# 3. Login to Supabase
supabase login

# 4. Link project
cd c:\Users\HACKER\Videos\DALIGHT
supabase link --project-ref rbwoiejztrkghfkpxquo
```

### Useful Commands

```powershell
# Check current project
supabase status

# List all secrets
supabase secrets list

# Set a new secret
supabase secrets set KEY_NAME=value

# Deploy all Edge Functions
supabase functions deploy

# Deploy specific function
supabase functions deploy send-email

# View function logs
supabase functions logs send-email

# Serve functions locally (for testing)
supabase functions serve
```

---

## 📧 Email Configuration

### Current Setup

- **Resend API Key:** Stored in Supabase secrets
- **From Email:** `onboarding@resend.dev` (test mode)
- **Restriction:** Can only send to verified email: `cvisualagency@gmail.com`

### How to Change Email Recipient

#### Option 1: Verify Your Domain (Recommended for Production)

1. **Go to Resend Dashboard:**
   - Visit: https://resend.com/domains
   - Click "Add Domain"
   - Enter: `dalight.com`

2. **Add DNS Records:**
   - Resend will give you DNS records (TXT, MX, CNAME)
   - Add these to your domain's DNS settings (cPanel, Cloudflare, etc.)
   - Wait 24-48 hours for verification

3. **Update Code:**
   After domain is verified, change the `from` email in:
   - `js/email-service.js` (lines 57, 69)
   - `supabase/functions/send-email/index.ts` (line 38)

   ```javascript
   from: 'DALIGHT Head Spa <info@dalight.com>'
   ```

4. **Redeploy:**
   ```powershell
   $env:Path += ";C:\Users\HACKER\scoop\shims"
   supabase functions deploy send-email
   ```

#### Option 2: Use Different Resend Account

1. **Create new Resend account** with desired email
   - Go to: https://resend.com
   - Sign up with `laurorejeanclarens0@gmail.com`

2. **Get new API key**
   - Dashboard → API Keys → Create API Key
   - Copy the key (starts with `re_`)

3. **Update Supabase secret:**
   ```powershell
   $env:Path += ";C:\Users\HACKER\scoop\shims"
   supabase secrets set RESEND_API_KEY=re_your_new_api_key_here
   ```

4. **Test it:**
   - Open `test-email.html`
   - Click test button
   - Check your email

#### Option 3: Add Verified Email to Current Account

1. **Go to Resend Dashboard:**
   - https://resend.com/emails
   - Add `laurorejeanclarens0@gmail.com` as verified email

2. **Update test file** to use verified email

---

## 🚀 Edge Functions Management

### Deploy Edge Functions

```powershell
# Make sure PATH is set
$env:Path += ";C:\Users\HACKER\scoop\shims"

# Navigate to project
cd c:\Users\HACKER\Videos\DALIGHT

# Deploy specific function
supabase functions deploy send-email

# Deploy all functions
supabase functions deploy
```

### View Logs

```powershell
# View recent logs
supabase functions logs send-email

# View logs with filters
supabase functions logs send-email --event-type HTTP_REQUEST
```

### Update Edge Function

1. **Edit the code:**
   - File: `supabase/functions/send-email/index.ts`

2. **Test locally (optional):**
   ```powershell
   supabase functions serve
   ```

3. **Deploy:**
   ```powershell
   supabase functions deploy send-email
   ```

4. **Test:**
   - Open `test-email.html`
   - Click test button

### Common Edge Function Locations

- **Send Email:** `supabase/functions/send-email/index.ts`
- **URL:** `https://rbwoiejztrkghfkpxquo.supabase.co/functions/v1/send-email`

---

## 🐛 Common Issues & Solutions

### Issue 1: "supabase command not found"

**Solution:**
```powershell
# Add to current session
$env:Path += ";C:\Users\HACKER\scoop\shims"

# Make it permanent
notepad $PROFILE
# Add this line: $env:Path += ";C:\Users\HACKER\scoop\shims"
# Save and restart PowerShell
```

### Issue 2: "Domain not verified" error

**Error Message:**
```
The dalight.com domain is not verified
```

**Solutions:**
1. Use `onboarding@resend.dev` (current setup)
2. Verify domain at https://resend.com/domains
3. Use verified email address only

### Issue 3: "Can only send to your own email"

**Error Message:**
```
You can only send testing emails to your own email address
```

**Solution:**
- Send to verified email: `cvisualagency@gmail.com`
- OR verify domain to send to any email
- OR change Resend account

### Issue 4: Edge Function returns 500 error

**Debug Steps:**
1. Check logs:
   ```powershell
   supabase functions logs send-email
   ```

2. Test locally:
   ```powershell
   supabase functions serve
   ```

3. Check code for errors in:
   - `supabase/functions/send-email/index.ts`

4. Redeploy:
   ```powershell
   supabase functions deploy send-email
   ```

### Issue 5: Emails not sending from reservation form

**Check:**
1. Browser console (F12) for errors
2. Edge Function logs
3. Resend dashboard for email status
4. Verify Edge Function is deployed

**Test:**
```powershell
# Quick test
curl -X POST https://rbwoiejztrkghfkpxquo.supabase.co/functions/v1/send-email `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_ANON_KEY" `
  -d '{"to":"cvisualagency@gmail.com","subject":"Test","html":"<h1>Test</h1>"}'
```

---

## 📊 Project Information

### Supabase Project
- **Project ID:** `rbwoiejztrkghfkpxquo`
- **Dashboard:** https://supabase.com/dashboard/project/rbwoiejztrkghfkpxquo
- **URL:** https://rbwoiejztrkghfkpxquo.supabase.co

### Edge Functions
- **send-email:** Handles email notifications via Resend API
- **Status:** ✅ Deployed and working

### Email Setup
- **Provider:** Resend (resend.com)
- **API Key:** Stored in Supabase secrets
- **Mode:** Test/Sandbox
- **Verified Email:** `cvisualagency@gmail.com`
- **From Address:** `onboarding@resend.dev`

---

## 🔐 Security Notes

1. **Never expose API keys in frontend code**
2. **Use Edge Functions for all API calls**
3. **Store secrets in Supabase, not in code**
4. **Verify domain before production**

---

## 📝 Quick Reference

### Daily Workflow

```powershell
# 1. Set PATH
$env:Path += ";C:\Users\HACKER\scoop\shims"

# 2. Make changes to Edge Function
# Edit: supabase/functions/send-email/index.ts

# 3. Deploy
cd c:\Users\HACKER\Videos\DALIGHT
supabase functions deploy send-email

# 4. Test
# Open test-email.html in browser

# 5. Check logs if needed
supabase functions logs send-email
```

### File Locations

- **Edge Function:** `supabase/functions/send-email/index.ts`
- **Email Service:** `js/email-service.js`
- **Test Page:** `test-email.html`
- **This Guide:** `SUPABASE_MANAGEMENT.md`

---

## 🆘 Need Help?

1. **Check logs:** `supabase functions logs send-email`
2. **Check Resend dashboard:** https://resend.com/emails
3. **Check browser console:** F12
4. **Review this guide** for common solutions

---

**Last Updated:** 2026-04-15  
**Status:** All systems operational ✅
