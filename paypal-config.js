(function() {
  "use strict";

  const TALLY_FORM_URL = "https://tally.so/r/b5jRve";

  // PaymentState - Session storage wrapper for payment status management
  const PaymentState = {
    STORAGE_KEY: 'sff_payment_confirmed',
    ORDER_ID_KEY: 'sff_order_id',

    set: function(confirmed) {
      sessionStorage.setItem(this.STORAGE_KEY, confirmed ? 'true' : 'false');
    },

    get: function() {
      return sessionStorage.getItem(this.STORAGE_KEY) === 'true';
    },

    setOrderID: function(orderID) {
      sessionStorage.setItem(this.ORDER_ID_KEY, orderID);
    },

    getOrderID: function() {
      return sessionStorage.getItem(this.ORDER_ID_KEY);
    },

    clear: function() {
      sessionStorage.removeItem(this.STORAGE_KEY);
      sessionStorage.removeItem(this.ORDER_ID_KEY);
    }
  };

  // Make PaymentState globally accessible
  window.PaymentState = PaymentState;

  function getOrderData() {
    const serviceSelect = document.getElementById("serviceSelect");
    const selectedPackageRadio = document.querySelector('input[name="sff-package"]:checked');
    const addonCheckboxes = document.querySelectorAll('.addon-checkbox input[type="checkbox"]:checked');

    if (!serviceSelect || !selectedPackageRadio) {
      return null;
    }

    const service = serviceSelect.value;
    const packageType = selectedPackageRadio.value;
    const addons = Array.from(addonCheckboxes).map(cb => cb.value);

    return { service, package: packageType, addons };
  }

  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'payment-notification error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4d4f;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 320px;
      font-size: 14px;
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      errorDiv.style.opacity = '0';
      errorDiv.style.transition = 'opacity 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
  }

  function initPayPal() {
    // Check if PayPal SDK is loaded
    if (typeof paypal === "undefined") {
      console.error("PayPal SDK not loaded");
      return;
    }

    const container = document.getElementById("paypal-button-container");
    if (!container) return;

    // Clear container to prevent duplicates
    container.innerHTML = '';

    paypal.Buttons({
      createOrder: async function() {
        const orderData = getOrderData();
        if (!orderData?.service || !orderData?.package) {
          showError("Please select a service and package");
          throw new Error("Missing selection");
        }

        try {
          const res = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData)
          });

          const data = await res.json();
          if (!res.ok || !data.orderID) {
            throw new Error(data.error || "Order creation failed");
          }

          return data.orderID;
        } catch (err) {
          console.error("Create order error:", err);
          showError("Failed to create order. Please try again.");
          throw err;
        }
      },

      onApprove: async function(data) {
        try {
          const res = await fetch("/api/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID })
          });

          const captureData = await res.json();

          if (captureData.success && captureData.status === "COMPLETED") {
            // Store payment confirmation
            PaymentState.set(true);
            PaymentState.setOrderID(data.orderID);
            sessionStorage.setItem("sff_order_id", data.orderID);

            // Redirect to Tally form
            window.location.href = TALLY_FORM_URL;
          } else {
            throw new Error("Capture failed");
          }
        } catch (err) {
          console.error("Capture error:", err);
          showError("Payment verification failed. Contact support with Order ID: " + data.orderID);
        }
      },

      onCancel: function() {
        showError("Payment cancelled. You can retry anytime.");
      },

      onError: function(err) {
        console.error("PayPal error:", err);
        showError("Payment error occurred. Please try again.");
      },

      style: {
        layout: "vertical",
        color: "gold",
        shape: "rect",
        label: "paypal"
      }
    }).render("#paypal-button-container");

    // Hide the old pay button
    const oldBtn = document.getElementById("payButton");
    if (oldBtn) oldBtn.style.display = "none";
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPayPal);
  } else {
    initPayPal();
  }
})();
