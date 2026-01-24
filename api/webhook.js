// PayPal Webhook Handler
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret
// - PAYPAL_WEBHOOK_ID: Your PayPal Webhook ID (from PayPal Developer Dashboard)
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

async function verifyWebhookSignature(req, webhookEvent) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    console.warn('PAYPAL_WEBHOOK_ID not set - skipping signature verification');
    return true; // Skip verification in development
  }

  const accessToken = await getAccessToken();

  const verificationPayload = {
    auth_algo: req.headers['paypal-auth-algo'],
    cert_url: req.headers['paypal-cert-url'],
    transmission_id: req.headers['paypal-transmission-id'],
    transmission_sig: req.headers['paypal-transmission-sig'],
    transmission_time: req.headers['paypal-transmission-time'],
    webhook_id: webhookId,
    webhook_event: webhookEvent
  };

  const response = await fetch(
    `${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verificationPayload)
    }
  );

  const data = await response.json();

  return data.verification_status === 'SUCCESS';
}

async function handlePaymentCompleted(event) {
  const resource = event.resource;
  const orderId = resource.id || resource.supplementary_data?.related_ids?.order_id;
  const captureId = resource.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  const payerEmail = resource.payer?.email_address;
  const amount = resource.purchase_units?.[0]?.amount?.value ||
                 resource.amount?.value;
  const customData = resource.purchase_units?.[0]?.custom_id;

  let orderDetails = {};
  if (customData) {
    try {
      orderDetails = JSON.parse(customData);
    } catch (e) {
      console.warn('Could not parse custom_id:', customData);
    }
  }

  console.log('=== PAYMENT COMPLETED ===');
  console.log('Order ID:', orderId);
  console.log('Capture ID:', captureId);
  console.log('Payer Email:', payerEmail);
  console.log('Amount:', amount);
  console.log('Order Details:', orderDetails);
  console.log('========================');

  // Here you could:
  // 1. Store the order in a database
  // 2. Send a confirmation email to the customer
  // 3. Send a notification to yourself about the new order
  // 4. Update inventory or service capacity

  return {
    orderId,
    captureId,
    payerEmail,
    amount,
    orderDetails
  };
}

async function handlePaymentDenied(event) {
  const resource = event.resource;
  const orderId = resource.id;

  console.log('=== PAYMENT DENIED ===');
  console.log('Order ID:', orderId);
  console.log('Reason:', resource.status);
  console.log('======================');

  return { orderId, status: 'denied' };
}

async function handleRefundCompleted(event) {
  const resource = event.resource;
  const refundId = resource.id;
  const captureId = resource.links?.find(l => l.rel === 'up')?.href?.split('/').pop();
  const amount = resource.amount?.value;

  console.log('=== REFUND COMPLETED ===');
  console.log('Refund ID:', refundId);
  console.log('Original Capture ID:', captureId);
  console.log('Refund Amount:', amount);
  console.log('========================');

  return { refundId, captureId, amount };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const webhookEvent = req.body;

    // Log incoming webhook for debugging
    console.log('Webhook received:', webhookEvent.event_type);

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(req, webhookEvent);

    if (!isValid) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Handle different event types
    let result;
    switch (webhookEvent.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        console.log('Order approved, waiting for capture');
        result = { status: 'order_approved' };
        break;

      case 'PAYMENT.CAPTURE.COMPLETED':
        result = await handlePaymentCompleted(webhookEvent);
        break;

      case 'PAYMENT.CAPTURE.DENIED':
        result = await handlePaymentDenied(webhookEvent);
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
        result = await handleRefundCompleted(webhookEvent);
        break;

      case 'CHECKOUT.ORDER.COMPLETED':
        result = await handlePaymentCompleted(webhookEvent);
        break;

      default:
        console.log(`Unhandled event type: ${webhookEvent.event_type}`);
        result = { status: 'unhandled', eventType: webhookEvent.event_type };
    }

    // Return 200 to acknowledge receipt
    return res.status(200).json({
      received: true,
      eventType: webhookEvent.event_type,
      result
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Still return 200 to prevent PayPal from retrying
    return res.status(200).json({
      received: true,
      error: error.message
    });
  }
}
