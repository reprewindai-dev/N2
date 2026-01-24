# ShortFormFactory

Premium short-form video editing services website with PayPal payment integration.

## Setup Instructions

### 1. PayPal Configuration

#### Environment Variables
Copy `.env.example` to `.env.local` and configure:

```bash
PAYPAL_MODE=sandbox              # 'sandbox' for testing, 'live' for production
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret
PAYPAL_WEBHOOK_ID=your_webhook_id
```

#### Getting PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Create a Sandbox App (or use the default one)
3. Copy your **Client ID** and **Secret**

#### Setting Up Webhooks

1. In PayPal Developer Dashboard, go to **Webhooks**
2. Create a new webhook with URL: `https://your-domain.com/api/webhook`
3. Subscribe to these events:
   - `CHECKOUT.ORDER.APPROVED`
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `PAYMENT.CAPTURE.REFUNDED`
4. Copy the **Webhook ID**

#### Frontend Client ID

Update the PayPal SDK script in `order.html` with your client ID:

```html
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_SANDBOX_CLIENT_ID&currency=USD"></script>
```

### 2. Deployment (Vercel)

1. Push this repo to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel project settings:
   - `PAYPAL_MODE`
   - `PAYPAL_CLIENT_ID`
   - `PAYPAL_CLIENT_SECRET`
   - `PAYPAL_WEBHOOK_ID`
4. Deploy

### 3. Testing with PayPal Sandbox

1. Create sandbox buyer/seller accounts at [PayPal Sandbox Accounts](https://developer.paypal.com/dashboard/accounts)
2. Use sandbox buyer credentials to test payments
3. Monitor webhook events in PayPal Developer Dashboard

## Project Structure

```
/
├── api/
│   ├── create-order.js    # Creates PayPal orders
│   ├── capture-order.js   # Captures/confirms payments
│   └── webhook.js         # Handles PayPal webhooks
├── assets/
│   └── logo.svg           # Brand logo
├── index.html             # Homepage
├── services.html          # Services catalog
├── order.html             # Order/checkout page
├── contact.html           # Contact page
├── about.html             # About page
├── thank-you.html         # Post-payment confirmation
├── terms.html             # Terms of Service
├── privacy.html           # Privacy Policy
├── refunds.html           # Refund Policy
├── liability.html         # Liability Notice
├── 404.html               # Error page
├── main.js                # Main JavaScript
├── paypal-config.js       # PayPal frontend config
└── style.css              # Styles
```

## Services & Pricing

| Service | Basic | Standard | Premium |
|---------|-------|----------|---------|
| AI Reel Edit | $35 | $55 | $85 |
| Social Media Edit | $25 | $45 | $70 |
| Viral Captions | $15 | $30 | $50 |
| Podcast/YouTube Repurpose | $40 | $65 | $95 |
| Auto Captions | $10 | $20 | $35 |
| Video Trim/Smart Cut | $20 | $35 | $55 |
| Background Removal | $25 | $40 | $60 |
| Add Music/Audio Sync | $20 | $35 | $55 |

## Going Live

When ready for production:

1. Create a Live App in PayPal Developer Dashboard
2. Update environment variables with live credentials
3. Set `PAYPAL_MODE=live`
4. Update the client ID in `order.html` with your live client ID
5. Create a new webhook for your production URL
6. Test with small transactions before going fully live
