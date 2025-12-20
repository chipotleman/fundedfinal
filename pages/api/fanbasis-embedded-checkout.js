import { createEmbeddedCheckoutSession } from '../../lib/fanbasis';

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
      userId,
      userEmail
    } = req.body;

    if (!challengeType || !adjustedPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    
    const productId = `piks_${challengeType}_${Date.now()}`;
    
    const result = await createEmbeddedCheckoutSession({
      productId: productId,
      productTitle: challengeName || 'Piks Challenge',
      amountCents: Math.round(adjustedPrice * 100),
      type: 'onetime_non_reusable',
      successUrl: `${origin}/payment-success`,
      webhookUrl: `${origin}/api/fanbasis-webhook`,
      metadata: {
        userId: userId || '',
        userEmail: userEmail || '',
        challengeType: String(challengeType || ''),
        challengeName: String(challengeName || ''),
        startingBalance: String(startingBalance || 0),
        userSplit: String(userSplit || 70),
        adjustedPrice: String(adjustedPrice || 0)
      }
    });

    console.log('Fanbasis embedded checkout response:', JSON.stringify(result, null, 2));

    if (result.status === 'success' && result.data) {
      const checkoutSessionSecret = result.data.checkout_session_secret;
      const sessionId = result.data.id;
      
      if (checkoutSessionSecret) {
        return res.status(200).json({
          success: true,
          checkoutConfig: {
            merchantId: process.env.FANBASIS_MERCHANT_ID || '',
            productId: productId,
            checkoutSessionSecret: checkoutSessionSecret,
            environment: 'production',
            theme: {
              theme: 'dark',
              accent_color: '#2563eb',
              background_color: '#000000',
              show_product_info: true
            }
          },
          sessionId: sessionId
        });
      }
      
      return res.status(400).json({ 
        error: 'No checkout session secret returned from Fanbasis',
        rawData: result.data
      });
    } else {
      return res.status(400).json({ 
        error: result.message || 'Failed to create embedded checkout session' 
      });
    }
  } catch (error) {
    console.error('Fanbasis embedded checkout error:', error);
    return res.status(500).json({ error: error.message });
  }
}
