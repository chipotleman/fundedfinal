import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  const { code } = req.query;

  if (code) {
    try {
      // Exchange the code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('OAuth callback error:', error);
        return res.redirect('/auth?error=oauth_failed');
      }

      if (data.session) {
        // Successfully authenticated - redirect to dashboard
        return res.redirect('/dashboard');
      }
    } catch (error) {
      console.error('OAuth callback exception:', error);
      return res.redirect('/auth?error=oauth_exception');
    }
  }

  // If no code or something went wrong, redirect to auth
  return res.redirect('/auth');
}
