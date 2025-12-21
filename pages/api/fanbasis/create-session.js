export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, productName, customerEmail } = req.body;

  if (!amount || !productName) {
    return res.status(400).json({ error: 'Amount and productName are required' });
  }

  const FANBASIS_API_KEY = process.env.FANBASIS_API_KEY;
  const CREATOR_ID = process.env.FANBASIS_CREATOR_ID || '802865';

  if (!FANBASIS_API_KEY) {
    console.error('FANBASIS_API_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  try {
    const response = await fetch('https://fanbasis.com/api/v1/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FANBASIS_API_KEY}`,
      },
      body: JSON.stringify({
        creatorId: CREATOR_ID,
        amount: amount,
        currency: 'usd',
        productName: productName,
        customerEmail: customerEmail || undefined,
        metadata: {
          source: 'piks-checkout',
          productName: productName,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Fanbasis API error:', response.status, errorData);
      return res.status(response.status).json({ 
        error: 'Failed to create checkout session',
        details: errorData 
      });
    }

    const data = await response.json();
    
    return res.status(200).json({
      checkoutSessionSecret: data.checkoutSessionSecret,
      sessionId: data.sessionId,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
