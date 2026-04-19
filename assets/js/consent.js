/**
 * Thep Academy — Cookie Consent + Google Consent Mode v2
 * PDPA compliant | ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
 */
(function () {
  var STORAGE_KEY = 'ta_cookie_consent';
  var BANNER_ID   = 'ta-consent-banner';

  /* ── 1. Helper: update Google Consent Mode ── */
  function setConsent(granted) {
    if (typeof gtag === 'function') {
      gtag('consent', 'update', {
        analytics_storage:    granted ? 'granted' : 'denied',
        ad_storage:           'denied',   // ไม่ใช้ ads → denied เสมอ
        ad_user_data:         'denied',
        ad_personalization:   'denied'
      });
    }
  }

  /* ── 2. Hide banner ── */
  function hideBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el) {
      el.style.transform = 'translateY(110%)';
      setTimeout(function () { el.remove(); }, 400);
    }
  }

  /* ── 3. Accept ── */
  function acceptAll() {
    localStorage.setItem(STORAGE_KEY, 'granted');
    setConsent(true);
    hideBanner();
  }

  /* ── 4. Reject ── */
  function rejectAll() {
    localStorage.setItem(STORAGE_KEY, 'denied');
    setConsent(false);
    hideBanner();
  }

  /* ── 5. Inject banner HTML ── */
  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;

    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.innerHTML =
      '<div class="ta-consent-inner">' +
        '<div class="ta-consent-text">' +
          '<span class="ta-consent-icon">🍪</span>' +
          '<div>' +
            '<strong>เว็บไซต์นี้ใช้คุกกี้</strong>' +
            '<p>Thep Academy ใช้คุกกี้เพื่อวิเคราะห์การใช้งานและปรับปรุงประสบการณ์ของคุณ ' +
            'ตาม <a href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</a> ' +
            'ของเรา ภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>' +
          '</div>' +
        '</div>' +
        '<div class="ta-consent-actions">' +
          '<button class="ta-btn-reject" onclick="taRejectAll()">ปฏิเสธ</button>' +
          '<button class="ta-btn-accept" onclick="taAcceptAll()">ยอมรับทั้งหมด</button>' +
        '</div>' +
      '</div>';

    /* Inject styles */
    var style = document.createElement('style');
    style.textContent =
      '#ta-consent-banner{' +
        'position:fixed;bottom:0;left:0;right:0;z-index:99999;' +
        'background:#1a2340;border-top:2px solid #F97316;' +
        'padding:16px 24px;' +
        'transform:translateY(110%);transition:transform .35s ease;' +
        'font-family:"Sarabun",sans-serif;font-size:14px;color:rgba(255,255,255,.85);' +
        'box-shadow:0 -4px 24px rgba(0,0,0,.3);' +
      '}' +
      '.ta-consent-inner{' +
        'max-width:960px;margin:0 auto;' +
        'display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;' +
      '}' +
      '.ta-consent-text{display:flex;align-items:flex-start;gap:12px;flex:1;min-width:0;}' +
      '.ta-consent-icon{font-size:22px;flex-shrink:0;margin-top:2px;}' +
      '.ta-consent-text strong{display:block;color:#fff;font-size:15px;margin-bottom:4px;}' +
      '.ta-consent-text p{margin:0;line-height:1.5;color:rgba(255,255,255,.7);font-size:13px;}' +
      '.ta-consent-text a{color:#F97316;text-decoration:underline;}' +
      '.ta-consent-actions{display:flex;gap:10px;flex-shrink:0;align-items:center;}' +
      '.ta-btn-accept{' +
        'background:#F97316;color:#fff;border:none;border-radius:8px;' +
        'padding:10px 22px;font-weight:700;font-size:14px;cursor:pointer;' +
        'font-family:"Sarabun",sans-serif;transition:background .2s;' +
      '}' +
      '.ta-btn-accept:hover{background:#ea6c0a;}' +
      '.ta-btn-reject{' +
        'background:transparent;color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.25);' +
        'border-radius:8px;padding:10px 18px;font-size:14px;cursor:pointer;' +
        'font-family:"Sarabun",sans-serif;transition:all .2s;' +
      '}' +
      '.ta-btn-reject:hover{color:#fff;border-color:rgba(255,255,255,.6);}' +
      '@media(max-width:640px){' +
        '.ta-consent-inner{flex-direction:column;gap:12px;}' +
        '.ta-consent-actions{width:100%;justify-content:flex-end;}' +
      '}';

    document.head.appendChild(style);
    document.body.appendChild(banner);

    /* Slide in after paint */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        banner.style.transform = 'translateY(0)';
      });
    });
  }

  /* ── 6. Expose globals for onclick handlers ── */
  window.taAcceptAll = acceptAll;
  window.taRejectAll = rejectAll;

  /* ── 7. Init on DOMContentLoaded ── */
  function init() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'granted') {
      setConsent(true);   // restore consent silently
    } else if (saved === 'denied') {
      setConsent(false);  // keep denied silently
    } else {
      showBanner();       // first visit → show banner
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
