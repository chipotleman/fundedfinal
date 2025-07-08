// pages/api/stripe-webhook.js

import { buffer } from 'micro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });
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
      event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const customerEmail = session.customer_details.email;

      const { data, error } = await supabase.from('evaluations').insert([
        {
          email: customerEmail,
          status: 'active',
          total_pnl: 0,
          evaluation_start_date: new Date(),
          evaluation_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      ]);

      if (error) {
        console.error('❌ Supabase insertion error:', error);
        return res.status(500).json({ error: error.message });
      }

      console.log(`✅ Funded pass created for ${customerEmail}.`, data);
    }

    res.status(200).json({ received: true });
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
