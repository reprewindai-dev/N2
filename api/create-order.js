// PayPal Create Order API Endpoint
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID (must match frontend SDK)
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
// - PAYPAL_MODE: 'sandbox' or 'live'

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Service pricing configuration — MUST match services.html and main.js
const PRICING = {
  aiReel: { basic: 25, standard: 60, premium: 140 },
  socialEdit: { basic: 30, standard: 70, premium: 160 },
  viralCaptions: { basic: 20, standard: 50, premium: 110 },
  podcastRepurpose: { basic: 40, standard: 95, premium: 220 },
  autoCaptions: { basic: 15, standard: 35, premium: 75 },
  smartCut: { basic: 20, standard: 50, premium: 120 },
  backgroundRemoval: { basic: 25, standard: 60, premium: 150 },
  audioSync: { basic: 15, standard: 40, premium: 95 }
};

// Add-on pricing
const ADDON_PRICING = {
  rush: 25,
  extraClip: 15,
  extraMinute: 10,
  premiumCaptions: 15,
  colorGrade: 20,
  advancedEffects: 25,
  thumbnails: 20,
  musicLicense: 10,
  sourceFiles: 15
};

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

  // IMPORTANT: Frontend SDK must use the same client ID
  // Current frontend hardcodes: ATvfbUWm...xICZ
  // Backend env var must match exactly!
  console.log(`[PayPal] Requesting access token...`);

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
    // Log detailed token error
    console.error(`[PayPal] Token request FAILED`);
    console.error(`[PayPal]   Status: ${response.status}`);
    console.error(`[PayPal]   Error: ${data.error || 'unknown'}`);
    console.error(`[PayPal]   Description: ${data.error_description || 'none'}`);

    // Common errors:
    // - 401 invalid_client = wrong client_id or secret
    // - 401 unauthorized = credentials don't match mode (sandbox vs live)
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

function calculateTotal(service, packageType, addons = []) {
  const servicePricing = PRICING[service];
  if (!servicePricing) {
    throw new Error(`Invalid service: ${service}`);
  }

  const basePrice = servicePricing[packageType];
  if (basePrice === undefined) {
    throw new Error(`Invalid package: ${packageType}`);
  }

  let addonTotal = 0;
  for (const addon of addons) {
    const addonPrice = ADDON_PRICING[addon];
    if (addonPrice) {
      addonTotal += addonPrice;
    }
  }

  return basePrice + addonTotal;
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
    const { service, package: packageType, addons = [] } = req.body;

    // Validate required fields
    if (!service || !packageType) {
      console.error('[PayPal] Missing required fields:', { service, packageType });
      return res.status(400).json({
        error: 'Missing service or package',
        debug_id: null,
        details: []
      });
    }

    // Calculate total amount
    const totalAmount = calculateTotal(service, packageType, addons);
    const amountString = totalAmount.toFixed(2);

    console.log(`[PayPal] === CREATE ORDER START ===`);
    console.log(`[PayPal] Service: ${service}`);
    console.log(`[PayPal] Package: ${packageType}`);
    console.log(`[PayPal] Addons: ${addons.length > 0 ? addons.join(', ') : 'none'}`);
    console.log(`[PayPal] Total: $${amountString}`);

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Determine base URL for redirects
    // Priority: SITE_URL env var > origin header > production domain
    const baseUrl = process.env.SITE_URL ||
                    req.headers.origin ||
                    'https://shortformfactory.com';

    console.log(`[PayPal] Redirect base URL: ${baseUrl}`);

    // Build order payload
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: amountString
        },
        description: `ShortFormFactory - ${service} (${packageType})`,
        custom_id: JSON.stringify({ service, package: packageType, addons })
      }],
      application_context: {
        brand_name: 'ShortFormFactory',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/thank-you.html`,
        cancel_url: `${baseUrl}/order.html`
      }
    };

    console.log(`[PayPal] Order payload:`, JSON.stringify(orderPayload, null, 2));

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      // Extract PayPal error details
      const debugId = orderData.debug_id || null;
      const errorName = orderData.name || 'UNKNOWN_ERROR';
      const errorMessage = orderData.message || 'Failed to create PayPal order';
      const errorDetails = orderData.details || [];

      console.error(`[PayPal] === CREATE ORDER FAILED ===`);
      console.error(`[PayPal] Status: ${orderResponse.status}`);
      console.error(`[PayPal] Debug ID: ${debugId}`);
      console.error(`[PayPal] Error Name: ${errorName}`);
      console.error(`[PayPal] Error Message: ${errorMessage}`);
      console.error(`[PayPal] Details:`, JSON.stringify(errorDetails, null, 2));

      return res.status(orderResponse.status).json({
        error: `${errorName}: ${errorMessage}`,
        debug_id: debugId,
        details: errorDetails.map(d => ({
          field: d.field,
          issue: d.issue,
          description: d.description
        }))
      });
    }

    console.log(`[PayPal] === CREATE ORDER SUCCESS ===`);
    console.log(`[PayPal] Order ID: ${orderData.id}`);
    console.log(`[PayPal] Status: ${orderData.status}`);

    return res.status(200).json({
      orderID: orderData.id,
      status: orderData.status
    });

  } catch (error) {
    console.error('[PayPal] === CREATE ORDER EXCEPTION ===');
    console.error('[PayPal] Error:', error.message);
    console.error('[PayPal] Stack:', error.stack);

    return res.status(500).json({
      error: error.message || 'Internal server error',
      debug_id: null,
      details: []
    });
  }
}
