// pages/api/checkout_sessions.js

import stripe from '../../lib/stripe';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'RollrFunded 14-Day Evaluation',
            },
            unit_amount: 19900,
          },
          quantity: 1,
        }],
        success_url: `${req.headers.origin}/dashboard`,
        cancel_url: `${req.headers.origin}/`,
      });
      res.status(200).json({ url: session.url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.setHeader('Allow', 'POST');
    res.status(405).end('Method Not Allowed');
  }
}
