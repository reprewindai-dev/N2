// PayPal Capture Order API Endpoint
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID (must match frontend SDK)
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
// - PAYPAL_MODE: 'sandbox' or 'live'

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Mask credential for safe logging (show first 8 and last 4 chars)
function maskCredential(str) {
  if (!str || str.length < 16) return str ? '***' : 'NOT SET';
  return `${str.substring(0, 8)}...${str.substring(str.length - 4)}`;
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  // Log configuration for debugging (masked for security)
  console.log(`[PayPal] Config check:`);
  console.log(`[PayPal]   Mode: ${mode}`);
  console.log(`[PayPal]   API Base: ${PAYPAL_API_BASE}`);
  console.log(`[PayPal]   Client ID: ${maskCredential(clientId)}`);
  console.log(`[PayPal]   Secret: ${clientSecret ? 'SET' : 'NOT SET'}`);

  if (!clientId || !clientSecret) {
    console.error('[PayPal] FATAL: Missing credentials');
    console.error('[PayPal]   PAYPAL_CLIENT_ID:', clientId ? 'present' : 'MISSING');
    console.error('[PayPal]   PAYPAL_CLIENT_SECRET:', clientSecret ? 'present' : 'MISSING');
    throw new Error('PayPal credentials not configured. Check Vercel environment variables.');
  }

  console.log(`[PayPal] Requesting access token for capture...`);

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
    console.error(`[PayPal] Token request FAILED`);
    console.error(`[PayPal]   Status: ${response.status}`);
    console.error(`[PayPal]   Error: ${data.error || 'unknown'}`);
    console.error(`[PayPal]   Description: ${data.error_description || 'none'}`);

    if (response.status === 401) {
      console.error('[PayPal] HINT: 401 usually means:');
      console.error('[PayPal]   1. Client ID and Secret do not match');
      console.error('[PayPal]   2. Using sandbox credentials with live API or vice versa');
      console.error('[PayPal]   3. Frontend SDK client-id differs from backend PAYPAL_CLIENT_ID');
    }

    throw new Error(data.error_description || `Token request failed: ${data.error || response.status}`);
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
      console.error('[PayPal] Missing orderID in request body');
      return res.status(400).json({
        error: 'Missing orderID',
        debug_id: null,
        details: []
      });
    }

    console.log(`[PayPal] === CAPTURE ORDER START ===`);
    console.log(`[PayPal] Order ID: ${orderID}`);

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Capture the order
    console.log(`[PayPal] Sending capture request...`);
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

      console.error(`[PayPal] === CAPTURE ORDER FAILED ===`);
      console.error(`[PayPal] Status: ${captureResponse.status}`);
      console.error(`[PayPal] Order ID: ${orderID}`);
      console.error(`[PayPal] Debug ID: ${debugId}`);
      console.error(`[PayPal] Error Name: ${errorName}`);
      console.error(`[PayPal] Error Message: ${errorMessage}`);
      console.error(`[PayPal] Details:`, JSON.stringify(errorDetails, null, 2));
      console.error(`[PayPal] Full Response:`, JSON.stringify(captureData, null, 2));

      return res.status(captureResponse.status).json({
        error: `${errorName}: ${errorMessage}`,
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

    console.log(`[PayPal] === CAPTURE ORDER SUCCESS ===`);
    console.log(`[PayPal] Order ID: ${orderID}`);
    console.log(`[PayPal] Capture ID: ${captureId}`);
    console.log(`[PayPal] Status: ${captureData.status}`);
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
    console.error('[PayPal] === CAPTURE ORDER EXCEPTION ===');
    console.error('[PayPal] Error:', error.message);
    console.error('[PayPal] Stack:', error.stack);

    return res.status(500).json({
      error: error.message || 'Internal server error',
      debug_id: null,
      details: []
    });
  }
}
