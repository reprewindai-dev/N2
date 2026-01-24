// PayPal Capture Order API Endpoint
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
// - PAYPAL_MODE: 'sandbox' or 'live'

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || 'Failed to get access token');
  }

  return data.access_token;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({ error: 'Missing orderID' });
    }

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Capture the order
    const captureResponse = await fetch(
      `${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const captureData = await captureResponse.json();

    if (!captureResponse.ok) {
      console.error('PayPal capture error:', captureData);
      return res.status(500).json({
        error: 'Failed to capture payment',
        details: captureData
      });
    }

    // Payment captured successfully
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const payerEmail = captureData.payer?.email_address;
    const amountPaid = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;

    console.log(`Payment captured: Order ${orderID}, Capture ${captureId}, Amount $${amountPaid}, Payer: ${payerEmail}`);

    return res.status(200).json({
      success: true,
      status: captureData.status,
      orderID: orderID,
      captureID: captureId,
      payerEmail: payerEmail,
      amountPaid: amountPaid
    });

  } catch (error) {
    console.error('Capture order error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
