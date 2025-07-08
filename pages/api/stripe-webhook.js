// pages/api/stripe-webhook.js

import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
});

// Initialize Supabase with service role key for secure insert
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const sig = req.headers['stripe-signature'];
    const buf = await buffer(req);

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        buf,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful checkout session completion
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details.email;

      console.log(`✅ Payment completed by ${customerEmail}. Creating funded pass...`);

      const { error } = await supabase.from('evaluations').insert([
        {
          email: customerEmail,
          status: 'active',
          total_pnl: 0,
          evaluation_start_date: new Date(),
          evaluation_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        },
      ]);

      if (error) {
        console.error('❌ Supabase insertion error:', error);
        return res.status(500).json({ error: 'Supabase insertion failed' });
      }

      console.log(`✅ Funded pass created for ${customerEmail}.`);
    }

    res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
