// PayPal Webhook Handler - LIVE Production Ready
// Endpoint: /api/paypal/webhook
//
// Environment Variables Required:
// - PAYPAL_CLIENT_ID: Your PayPal Client ID (LIVE)
// - PAYPAL_CLIENT_SECRET: Your PayPal Client Secret (LIVE)
// - PAYPAL_WEBHOOK_ID: Your PayPal Webhook ID (LIVE)
// - PAYPAL_MODE: 'live' for production

const PAYPAL_API_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Mask credential for safe logging
function maskCredential(str) {
  if (!str || str.length < 16) return str ? '***' : 'NOT SET';
  return `${str.substring(0, 8)}...${str.substring(str.length - 4)}`;
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  console.log(`[Webhook] Getting access token (mode: ${mode})`);

  if (!clientId || !clientSecret) {
    console.error('[Webhook] FATAL: Missing credentials');
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
    console.error(`[Webhook] Token request failed: ${response.status}`, data);
    throw new Error(data.error_description || 'Failed to get access token');
  }

  return data.access_token;
}

async function verifyWebhookSignature(req, webhookEvent) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const mode = process.env.PAYPAL_MODE || 'sandbox';

  console.log(`[Webhook] Verifying signature...`);
  console.log(`[Webhook]   Mode: ${mode}`);
  console.log(`[Webhook]   Webhook ID: ${maskCredential(webhookId)}`);

  if (!webhookId) {
    console.warn('[Webhook] WARNING: PAYPAL_WEBHOOK_ID not set');
    console.warn('[Webhook] Skipping signature verification (INSECURE for production!)');
    return true;
  }

  try {
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

    console.log(`[Webhook] Verification headers present:`, {
      auth_algo: !!req.headers['paypal-auth-algo'],
      cert_url: !!req.headers['paypal-cert-url'],
      transmission_id: !!req.headers['paypal-transmission-id'],
      transmission_sig: !!req.headers['paypal-transmission-sig'],
      transmission_time: !!req.headers['paypal-transmission-time']
    });

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

    console.log(`[Webhook] Verification response:`, {
      status: response.status,
      verification_status: data.verification_status
    });

    if (data.verification_status === 'SUCCESS') {
      console.log('[Webhook] Signature VERIFIED');
      return true;
    } else {
      console.error('[Webhook] Signature FAILED:', data);
      return false;
    }
  } catch (error) {
    console.error('[Webhook] Verification error:', error.message);
    return false;
  }
}

async function handlePaymentCompleted(event) {
  const resource = event.resource;
  const orderId = resource.id || resource.supplementary_data?.related_ids?.order_id;
  const captureId = resource.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  const payerEmail = resource.payer?.email_address;
  const payerName = resource.payer?.name?.given_name;
  const amount = resource.purchase_units?.[0]?.amount?.value ||
                 resource.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ||
                 resource.amount?.value;
  const currency = resource.purchase_units?.[0]?.amount?.currency_code || 'USD';
  const customData = resource.purchase_units?.[0]?.custom_id;

  let orderDetails = {};
  if (customData) {
    try {
      orderDetails = JSON.parse(customData);
    } catch (e) {
      console.warn('[Webhook] Could not parse custom_id:', customData);
    }
  }

  console.log('[Webhook] ========================================');
  console.log('[Webhook] PAYMENT CAPTURE COMPLETED');
  console.log('[Webhook] ========================================');
  console.log(`[Webhook] Order ID: ${orderId}`);
  console.log(`[Webhook] Capture ID: ${captureId}`);
  console.log(`[Webhook] Amount: ${currency} ${amount}`);
  console.log(`[Webhook] Payer: ${payerName} <${payerEmail}>`);
  console.log(`[Webhook] Service: ${orderDetails.service || 'N/A'}`);
  console.log(`[Webhook] Package: ${orderDetails.package || 'N/A'}`);
  console.log(`[Webhook] Addons: ${orderDetails.addons?.join(', ') || 'none'}`);
  console.log('[Webhook] ========================================');

  // TODO: Implement order storage/notification
  // - Store order in database
  // - Send confirmation email
  // - Notify admin of new order

  return {
    success: true,
    orderId,
    captureId,
    payerEmail,
    amount,
    currency,
    orderDetails
  };
}

async function handlePaymentDenied(event) {
  const resource = event.resource;
  const orderId = resource.id;
  const reason = resource.status_details?.reason || resource.status;

  console.log('[Webhook] ========================================');
  console.log('[Webhook] PAYMENT DENIED');
  console.log('[Webhook] ========================================');
  console.log(`[Webhook] Order ID: ${orderId}`);
  console.log(`[Webhook] Reason: ${reason}`);
  console.log('[Webhook] ========================================');

  return { success: false, orderId, status: 'denied', reason };
}

async function handleOrderCancelled(event) {
  const resource = event.resource;
  const orderId = resource.id;

  console.log('[Webhook] ========================================');
  console.log('[Webhook] ORDER CANCELLED');
  console.log('[Webhook] ========================================');
  console.log(`[Webhook] Order ID: ${orderId}`);
  console.log('[Webhook] ========================================');

  return { success: false, orderId, status: 'cancelled' };
}

async function handleRefundCompleted(event) {
  const resource = event.resource;
  const refundId = resource.id;
  const amount = resource.amount?.value;
  const currency = resource.amount?.currency_code || 'USD';

  console.log('[Webhook] ========================================');
  console.log('[Webhook] REFUND COMPLETED');
  console.log('[Webhook] ========================================');
  console.log(`[Webhook] Refund ID: ${refundId}`);
  console.log(`[Webhook] Amount: ${currency} ${amount}`);
  console.log('[Webhook] ========================================');

  return { success: true, refundId, amount, currency };
}

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();

  try {
    const webhookEvent = req.body;
    const eventType = webhookEvent.event_type;
    const eventId = webhookEvent.id;

    console.log('[Webhook] ========================================');
    console.log('[Webhook] INCOMING WEBHOOK');
    console.log('[Webhook] ========================================');
    console.log(`[Webhook] Event Type: ${eventType}`);
    console.log(`[Webhook] Event ID: ${eventId}`);
    console.log(`[Webhook] Time: ${new Date().toISOString()}`);

    // Verify webhook signature (REQUIRED for production)
    const isValid = await verifyWebhookSignature(req, webhookEvent);

    if (!isValid) {
      console.error('[Webhook] REJECTED: Invalid signature');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Handle different event types
    let result;
    switch (eventType) {
      case 'CHECKOUT.ORDER.APPROVED':
        console.log('[Webhook] Order approved, awaiting capture...');
        result = { status: 'order_approved', orderId: webhookEvent.resource?.id };
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

      case 'CHECKOUT.ORDER.CANCELLED':
        result = await handleOrderCancelled(webhookEvent);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${eventType}`);
        result = { status: 'unhandled', eventType };
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Processed in ${duration}ms`);

    // Return 200 to acknowledge receipt
    return res.status(200).json({
      received: true,
      eventType,
      eventId,
      result,
      processingTime: duration
    });

  } catch (error) {
    console.error('[Webhook] EXCEPTION:', error.message);
    console.error('[Webhook] Stack:', error.stack);

    // Still return 200 to prevent PayPal from excessive retries
    // Log the error for investigation
    return res.status(200).json({
      received: true,
      error: error.message
    });
  }
}
