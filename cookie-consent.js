// Cookie Consent Banner with Google Analytics Consent Mode
(function() {
  'use strict';

  // Check if consent has already been given
  const consentGiven = localStorage.getItem('cookieConsent');
  
  if (consentGiven === null) {
    // No consent decision yet - show banner
    showConsentBanner();
  } else if (consentGiven === 'accepted') {
    // Consent was given - grant analytics
    grantConsent();
  } else {
    // Consent was denied - deny analytics
    denyConsent();
  }

  function showConsentBanner() {
    // Create banner HTML
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML = `
      <div class="cookie-consent-content">
        <p class="cookie-consent-text">
          We use cookies to analyze site traffic and improve your experience. 
          <a href="/privacy" class="cookie-consent-link">Privacy Policy</a>
        </p>
        <div class="cookie-consent-buttons">
          <button id="cookie-accept" class="cookie-btn cookie-btn-accept">Accept</button>
          <button id="cookie-decline" class="cookie-btn cookie-btn-decline">Decline</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);

    // Add event listeners
    document.getElementById('cookie-accept').addEventListener('click', function() {
      acceptCookies();
    });

    document.getElementById('cookie-decline').addEventListener('click', function() {
      declineCookies();
    });
  }

  function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    grantConsent();
    hideBanner();
  }

  function declineCookies() {
    localStorage.setItem('cookieConsent', 'declined');
    denyConsent();
    hideBanner();
  }

  function hideBanner() {
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) {
      banner.style.opacity = '0';
      setTimeout(function() {
        banner.remove();
      }, 300);
    }
  }

  function grantConsent() {
    // Update Google Analytics consent mode
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': 'granted'
      });
    }
  }

  function denyConsent() {
    // Update Google Analytics consent mode
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        'analytics_storage': 'denied',
        'ad_storage': 'denied'
      });
    }
  }
})();
