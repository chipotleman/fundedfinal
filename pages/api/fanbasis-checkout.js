import { createCheckoutSession, createEmbeddedCheckoutSession } from '../../lib/fanbasis';

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
      userEmail,
      useRedirect = true
    } = req.body;

    if (!challengeType || !adjustedPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const origin = req.headers.origin || req.headers.host?.includes('localhost') 
      ? `http://${req.headers.host}` 
      : `https://${req.headers.host}`;
    
    const metadata = {
      challengeType,
      challengeName,
      startingBalance: String(startingBalance),
      userSplit: String(userSplit),
      userEmail: userEmail || ''
    };

    if (useRedirect) {
      const result = await createCheckoutSession({
        productId: PRODUCT_ID,
        productTitle: challengeName || 'Piks Challenge',
        amountCents: Math.round(adjustedPrice * 100),
        type: 'onetime_non_reusable',
        successUrl: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/?canceled=true`,
        webhookUrl: `${origin}/api/fanbasis-webhook`,
        metadata
      });

      console.log('Fanbasis checkout response:', JSON.stringify(result, null, 2));

      if (result.status === 'success' && result.data) {
        const checkoutUrl = result.data.payment_link || result.data.url || result.data.checkout_url || result.data.redirect_url;
        const sessionId = result.data.checkout_session_id || result.data.id;
        
        if (checkoutUrl) {
          return res.status(200).json({
            success: true,
            checkoutUrl: checkoutUrl,
            checkoutSessionId: sessionId,
            mode: 'redirect'
          });
        }
        
        return res.status(200).json({
          success: true,
          checkoutSessionId: sessionId,
          rawData: result.data,
          mode: 'redirect',
          note: 'No redirect URL in response - check rawData for available fields'
        });
      } else {
        return res.status(400).json({ 
          error: result.message || 'Failed to create checkout session',
          rawResponse: result
        });
      }
    } else {
      const result = await createEmbeddedCheckoutSession({
        productId: PRODUCT_ID,
        amountCents: Math.round(adjustedPrice * 100),
        type: 'onetime_non_reusable',
        successUrl: `${origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        webhookUrl: `${origin}/api/fanbasis-webhook`,
        metadata
      });

      if (result.status === 'success' && result.data) {
        const secret = result.data.checkout_session_secret;
        const sessionId = result.data.id;
        
        return res.status(200).json({
          success: true,
          checkoutSessionId: sessionId,
          checkoutSessionSecret: secret,
          mode: 'embedded',
          rawData: result.data
        });
      } else {
        return res.status(400).json({ 
          error: result.message || 'Failed to create checkout session' 
        });
      }
    }
  } catch (error) {
    console.error('Fanbasis checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
