import { createCheckoutSession } from '../../lib/fanbasis';

const PRODUCT_ID = 'y8Q3E';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { 
      challengeType, 
      challengeName,
      startingBalance,
      userSplit,
      adjustedPrice,
      userEmail
    } = req.body;

    if (!challengeType || !adjustedPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    
    const result = await createCheckoutSession({
      productId: PRODUCT_ID,
      productTitle: challengeName || 'Piks Challenge',
      amountCents: Math.round(adjustedPrice * 100),
      type: 'onetime_non_reusable',
      successUrl: `${origin}/payment-success`,
      cancelUrl: `${origin}/?canceled=true`,
      webhookUrl: `${origin}/api/fanbasis-webhook`
    });

    console.log('Fanbasis checkout response:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.data) {
      const paymentLink = result.data.payment_link;
      const sessionId = result.data.checkout_session_id || result.data.id;
      
      if (paymentLink) {
        return res.status(200).json({
          success: true,
          paymentLink: paymentLink,
          checkoutSessionId: sessionId
        });
      }
      
      return res.status(400).json({ 
        error: 'No payment link returned from Fanbasis',
        rawData: result.data
      });
    } else {
      return res.status(400).json({ 
        error: result.message || 'Failed to create checkout session' 
      });
    }
  } catch (error) {
    console.error('Fanbasis checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
