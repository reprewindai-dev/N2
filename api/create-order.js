// PayPal Create Order API Endpoint
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
// - PAYPAL_MODE: 'sandbox' or 'live'

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Service pricing configuration
const PRICING = {
  aiReel: { basic: 35, standard: 55, premium: 85 },
  socialEdit: { basic: 25, standard: 45, premium: 70 },
  viralCaptions: { basic: 15, standard: 30, premium: 50 },
  podcastRepurpose: { basic: 40, standard: 65, premium: 95 },
  autoCaptions: { basic: 10, standard: 20, premium: 35 },
  smartCut: { basic: 20, standard: 35, premium: 55 },
  backgroundRemoval: { basic: 25, standard: 40, premium: 60 },
  audioSync: { basic: 20, standard: 35, premium: 55 }
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

function calculateTotal(service, packageType, addons = []) {
  // Get base price for service and package
  const servicePricing = PRICING[service];
  if (!servicePricing) {
    throw new Error(`Invalid service: ${service}`);
  }

  const basePrice = servicePricing[packageType];
  if (basePrice === undefined) {
    throw new Error(`Invalid package: ${packageType}`);
  }

  // Calculate add-on total
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
      return res.status(400).json({ error: 'Missing service or package' });
    }

    // Calculate total amount
    const totalAmount = calculateTotal(service, packageType, addons);

    // Get PayPal access token
    const accessToken = await getAccessToken();

    // Create PayPal order
    const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: totalAmount.toFixed(2)
          },
          description: `ShortFormFactory - ${service} (${packageType})`,
          custom_id: JSON.stringify({ service, package: packageType, addons })
        }],
        application_context: {
          brand_name: 'ShortFormFactory',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.VERCEL_URL || req.headers.origin}/thank-you.html`,
          cancel_url: `${process.env.VERCEL_URL || req.headers.origin}/order.html`
        }
      })
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      console.error('PayPal create order error:', orderData);
      return res.status(500).json({ error: 'Failed to create PayPal order' });
    }

    return res.status(200).json({
      orderID: orderData.id,
      status: orderData.status
    });

  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
