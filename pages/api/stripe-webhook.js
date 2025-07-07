import Stripe from 'stripe';
import { buffer } from 'micro';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const customerEmail = session.customer_details?.email || session.customer_email;
    const purchaseDate = new Date().toISOString();
    const evaluationEndDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.from('evaluations').insert([
      {
        email: customerEmail,
        purchase_date: purchaseDate,
        status: 'active',
        evaluation_end_date: evaluationEndDate,
      },
    ]);

    if (error) {
      console.error('Supabase Insert Error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log(`✅ Evaluation created for ${customerEmail}`);
  }

  res.json({ received: true });
}
<<<<<<< HEAD
=======


>>>>>>> 251e154 (Add working Stripe webhook for RollrFunded)
