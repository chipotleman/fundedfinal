export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const FANBASIS_API_KEY = process.env.FANBASIS_API_KEY;

  if (!FANBASIS_API_KEY) {
    console.error('FANBASIS_API_KEY not configured');
    return res.status(500).json({ error: 'Payment system not configured' });
  }

  try {
    const response = await fetch('https://www.fanbasis.com/public-api/checkout-sessions/embedded', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': FANBASIS_API_KEY,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fanbasis API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to create checkout session',
        details: errorText 
      });
    }

    const responseData = await response.json();
    const secret = responseData.data?.checkout_session_secret;
    if (!secret) {
      console.error('No checkout session secret in response:', responseData);
      return res.status(500).json({ error: 'No checkout session secret received' });
    }
    
    return res.status(200).json({
      checkoutSessionSecret: secret,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
