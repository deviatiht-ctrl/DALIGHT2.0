# 📧 Supabase Edge Function - Email Backend

## 🚀 Setup Instructions

### Step 1: Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (Mac)
brew install supabase/tap/supabase
```

### Step 2: Login to Supabase

```bash
supabase login
```

This will open a browser window for authentication.

### Step 3: Link Your Project

```bash
cd c:\Users\HACKER\Videos\DALIGHT
supabase link --project-ref rbwoiejztrkghfkpxquo
```

### Step 4: Set Environment Variable

```bash
# Set your Resend API key
supabase secrets set RESEND_API_KEY=re_WNFsawq8_NbVdiFmSj1gSLuzhJ5qr4knr
```

### Step 5: Deploy the Function

```bash
supabase functions deploy send-email
```

### Step 6: Test the Function

```bash
supabase functions serve --env-file .env
```

Then test with:
```bash
curl -X POST http://localhost:54321/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","html":"<h1>Hello</h1>"}'
```

## 📝 Usage in Frontend

The function will be available at:
```
https://rbwoiejztrkghfkpxquo.supabase.co/functions/v1/send-email
```

### Example Call:

```javascript
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'user@example.com',
    subject: 'Reservation Confirmation',
    html: '<h1>Thank you!</h1>',
    isAdmin: false
  }
})
```

## 🔒 Security

- ✅ API key stored securely in Supabase (not exposed in browser)
- ✅ CORS enabled for your domain
- ✅ Input validation
- ✅ Error handling

## 📊 Monitoring

View logs in Supabase Dashboard:
1. Go to your project
2. Click "Edge Functions"
3. Select "send-email"
4. View logs and metrics

## 🎯 Next Steps

After deployment, update `js/email-service.js` to use the Edge Function instead of direct API call.
