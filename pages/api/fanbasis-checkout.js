import { createEmbeddedCheckoutSession } from '../../lib/fanbasis';

const PRODUCT_ID = 'y8Q3E';

const CHALLENGE_PRICES = {
  BEGINNER: 14900,
  POPULAR: 24900,
  ADVANCED: 39900
};

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

    const origin = req.headers.origin || 'https://fundedpiks.com';
    
    const result = await createEmbeddedCheckoutSession({
      productId: PRODUCT_ID,
      amountCents: Math.round(adjustedPrice * 100),
      type: 'onetime_non_reusable',
      successUrl: `${origin}/dashboard?payment=success`,
      webhookUrl: `${origin}/api/fanbasis-webhook`,
      metadata: {
        challengeType,
        challengeName,
        startingBalance: String(startingBalance),
        userSplit: String(userSplit),
        userEmail: userEmail || ''
      }
    });

    if (result.status === 'success' && result.data) {
      const secret = result.data.checkout_session_secret;
      const sessionId = result.data.id;
      
      // Try different possible embed URL formats
      // You may need to adjust this based on Fanbasis documentation
      const embedUrl = `https://www.fanbasis.com/embedded-checkout/${secret}`;
      
      return res.status(200).json({
        success: true,
        checkoutSessionId: sessionId,
        checkoutSessionSecret: secret,
        embedUrl: embedUrl,
        // Alternative URLs to try if the main one doesn't work
        alternativeUrls: [
          `https://www.fanbasis.com/checkout/${secret}`,
          `https://www.fanbasis.com/pay/${secret}`,
          `https://checkout.fanbasis.com/${secret}`,
          `https://www.fanbasis.com/embedded/${sessionId}`
        ]
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
