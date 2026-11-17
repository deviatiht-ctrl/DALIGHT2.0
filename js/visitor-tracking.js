// DALIGHT - Visitor Tracking
// This script tracks page views to the page_views table

(function() {
  // Supabase config
  const SUPABASE_URL = 'https://rbwoiejztrkghfkpxquo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJid29pZWp6dHJrZ2hma3B4cXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDI1OTcsImV4cCI6MjA5MTc3ODU5N30.4NnApWYerIEcS8IBixBdsVHSgTUDO4OTTi6fSxdxu_U';
  
  // Simple function to track page view
  async function trackPageView() {
    try {
      // Get session ID from localStorage or create new one
      let sessionId = localStorage.getItem('dalight_session_id');
      if (!sessionId) {
        sessionId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);
        localStorage.setItem('dalight_session_id', sessionId);
      }
      
      // Get page info
      const pageUrl = window.location.pathname;
      const referrer = document.referrer || null;
      const userAgent = navigator.userAgent;
      
      // Try to insert into page_views table
      // Note: This uses the public anon key, so RLS must allow inserts
      const response = await fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          page_url: pageUrl,
          session_id: sessionId,
          referrer: referrer,
          user_agent: userAgent
        })
      });
      
      // Silently fail - don't show errors to users
      if (!response.ok) {
        console.log('Visitor tracking failed (table might not exist yet)');
      }
    } catch (err) {
      // Silently fail
      console.log('Visitor tracking error:', err.message);
    }
  }
  
  // Track page view when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();
