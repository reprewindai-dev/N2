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
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId || !clientSecret) {
    console.error('[PayPal] Missing credentials - PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not set');
    throw new Error('PayPal credentials not configured');
  }

  console.log(`[PayPal] Requesting access token for capture (mode: ${mode})`);

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
    console.error(`[PayPal] Token request failed - Status: ${response.status}`, data);
    throw new Error(data.error_description || 'Failed to get access token');
  }

  console.log('[PayPal] Access token obtained successfully');
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

    console.log(`[PayPal] Capturing order - ID: ${orderID}`);

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
      // Extract PayPal error details
      const debugId = captureData.debug_id || null;
      const errorName = captureData.name || 'UNKNOWN_ERROR';
      const errorMessage = captureData.message || 'Failed to capture payment';
      const errorDetails = captureData.details || [];

      console.error(`[PayPal] Capture failed - Status: ${captureResponse.status}`);
      console.error(`[PayPal] Order ID: ${orderID}`);
      console.error(`[PayPal] Debug ID: ${debugId}`);
      console.error(`[PayPal] Error: ${errorName} - ${errorMessage}`);
      console.error('[PayPal] Details:', JSON.stringify(errorDetails, null, 2));

      return res.status(captureResponse.status).json({
        error: errorMessage,
        debug_id: debugId,
        details: errorDetails.map(d => ({
          field: d.field,
          issue: d.issue,
          description: d.description
        }))
      });
    }

    // Payment captured successfully
    const captureId = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    const payerEmail = captureData.payer?.email_address;
    const amountPaid = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
    const currencyCode = captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.currency_code;

    console.log(`[PayPal] Payment captured successfully`);
    console.log(`[PayPal] Order ID: ${orderID}`);
    console.log(`[PayPal] Capture ID: ${captureId}`);
    console.log(`[PayPal] Amount: ${currencyCode} ${amountPaid}`);
    console.log(`[PayPal] Payer: ${payerEmail}`);

    return res.status(200).json({
      success: true,
      status: captureData.status,
      orderID: orderID,
      captureID: captureId,
      payerEmail: payerEmail,
      amountPaid: amountPaid
    });

  } catch (error) {
    console.error('[PayPal] Capture order exception:', error.message);
    return res.status(500).json({
      error: error.message || 'Internal server error',
      debug_id: null,
      details: []
    });
  }
}
