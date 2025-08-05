
import { supabase } from '../../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { capper_id, user_id, monthly_price, referrer_code } = req.body;

  if (!capper_id || !user_id || !monthly_price) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if user already has an active subscription to this capper
    const { data: existingSubscription } = await supabase
      .from('capper_subscriptions')
      .select('*')
      .eq('user_id', user_id)
      .eq('capper_id', capper_id)
      .eq('status', 'active')
      .single();

    if (existingSubscription) {
      return res.status(400).json({ error: 'Already subscribed to this capper' });
    }

    // Find referrer if referrer_code is provided
    let referrer_user_id = null;
    if (referrer_code) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referrer_code)
        .single();
      
      if (referrer) {
        referrer_user_id = referrer.id;
      }
    }

    // Create subscription
    const { data: subscription, error: subscriptionError } = await supabase
      .from('capper_subscriptions')
      .insert([
        {
          user_id,
          capper_id,
          monthly_price,
          referrer_user_id,
          status: 'active',
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        }
      ])
      .select()
      .single();

    if (subscriptionError) {
      throw subscriptionError;
    }

    // Update capper stats - increment followers
    const { error: statsError } = await supabase
      .from('capper_stats')
      .update({
        followers: supabase.raw('followers + 1')
      })
      .eq('capper_id', capper_id);

    if (statsError) {
      console.error('Error updating capper stats:', statsError);
    }

    // Create referral record if referrer exists
    if (referrer_user_id) {
      const { error: referralError } = await supabase
        .from('capper_referrals')
        .upsert([
          {
            referrer_user_id,
            capper_id,
            total_earnings: 0 // Will be updated when payments are processed
          }
        ]);

      if (referralError) {
        console.error('Error creating referral record:', referralError);
      }
    }

    // Create payment record (this would integrate with actual payment processing)
    const referral_amount = referrer_user_id ? monthly_price * 0.1 : 0;
    const { error: paymentError } = await supabase
      .from('capper_payments')
      .insert([
        {
          capper_id,
          subscription_id: subscription.id,
          amount: monthly_price,
          referral_amount,
          referrer_user_id,
          status: 'completed'
        }
      ]);

    if (paymentError) {
      console.error('Error creating payment record:', paymentError);
    }

    res.status(200).json({ 
      message: 'Successfully subscribed to capper',
      subscription 
    });

  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
