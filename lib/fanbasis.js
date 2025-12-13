const FANBASIS_API_BASE = 'https://www.fanbasis.com/public-api';

export async function createCheckoutSession({ 
  productId, 
  productTitle,
  amountCents, 
  type = 'onetime_non_reusable',
  successUrl,
  cancelUrl,
  webhookUrl
}) {
  const requestBody = {
    product: {
      id: productId,
      title: productTitle
    },
    amount_cents: amountCents,
    type: type,
    success_url: successUrl,
    cancel_url: cancelUrl,
    webhook_url: webhookUrl
  };
  
  console.log('Fanbasis checkout request:', JSON.stringify(requestBody, null, 2));
  
  const response = await fetch(`${FANBASIS_API_BASE}/checkout-sessions`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': process.env.FANBASIS_API_KEY
    },
    body: JSON.stringify(requestBody)
  });

  const responseData = await response.json();
  console.log('Fanbasis checkout response:', JSON.stringify(responseData, null, 2));
  
  if (!response.ok || responseData.status === 'error') {
    console.error('Fanbasis API error:', responseData);
    throw new Error(responseData.message || `Fanbasis API error: ${response.status}`);
  }

  return responseData;
}

export async function createEmbeddedCheckoutSession({ 
  productId,
  productTitle,
  amountCents, 
  type = 'onetime_non_reusable',
  successUrl,
  webhookUrl,
  metadata = {}
}) {
  const response = await fetch(`${FANBASIS_API_BASE}/checkout-sessions/embedded`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': process.env.FANBASIS_API_KEY
    },
    body: JSON.stringify({
      product: {
        id: productId,
        title: productTitle
      },
      amount_cents: amountCents,
      type: type,
      success_url: successUrl,
      webhook_url: webhookUrl,
      metadata: metadata
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Fanbasis API error: ${response.status}`);
  }

  return response.json();
}

export async function getCheckoutSession(sessionId) {
  const response = await fetch(`${FANBASIS_API_BASE}/checkout-sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-api-key': process.env.FANBASIS_API_KEY
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Fanbasis API error: ${response.status}`);
  }

  return response.json();
}

export async function listProducts() {
  const response = await fetch(`${FANBASIS_API_BASE}/products`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-api-key': process.env.FANBASIS_API_KEY
    }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Fanbasis API error: ${response.status}`);
  }

  return response.json();
}
