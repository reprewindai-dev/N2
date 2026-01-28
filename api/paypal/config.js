// PayPal Client Configuration Endpoint
// Returns the PayPal client ID for the frontend SDK
// This allows switching between sandbox and live without code changes

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  if (!clientId) {
    console.error('[PayPal Config] PAYPAL_CLIENT_ID not set');
    return res.status(500).json({ error: 'PayPal not configured' });
  }

  console.log(`[PayPal Config] Returning client ID for mode: ${mode}`);

  return res.status(200).json({
    clientId: clientId,
    mode: mode,
    currency: 'USD'
  });
}
