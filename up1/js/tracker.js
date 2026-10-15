/**
 * BOTI TRACKER v1.0
 * ─────────────────────────────────────────────────────────
 * Standalone tracker script for static HTML funnel sites.
 * Drop this file in the site root and add to every page:
 *
 *   <script src="/tracker.js"
 *     data-offer="SLUG"
 *     data-dashboard="https://dash.nexustemp.top"
 *     data-key="tk_dash_2026_secretX"
 *     defer></script>
 *
 * Sends: pageview, ping (heartbeat), leave, checkout, cpf
 * Uses text/plain to avoid CORS preflight (no OPTIONS request).
 * ─────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  // ── Read config from script tag data attributes ──
  var scripts = document.querySelectorAll('script[data-offer]');
  var me = scripts[scripts.length - 1]; // last one = current
  var OFFER  = me.getAttribute('data-offer');
  var DASH   = (me.getAttribute('data-dashboard') || '').replace(/\/+$/, '');
  var API    = DASH + '/api/t';
  var PING_INTERVAL = 25000; // 25s heartbeat

  if (!OFFER || !DASH) {
    console.warn('[tracker] Missing data-offer or data-dashboard');
    return;
  }

  // ── Lead ID (persisted in localStorage) ──
  var LID_KEY = '_boti_lid';
  function getLeadId() {
    var v = localStorage.getItem(LID_KEY);
    if (v) return v;
    v = 'bb_' + Math.random().toString(36).substr(2, 12) + '_' + Date.now().toString(36);
    localStorage.setItem(LID_KEY, v);
    return v;
  }

  // ── UTM capture & persistence ──
  var UTM_KEY = '_boti_utms';
  function getUtms() {
    var params = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var fresh = {};
    keys.forEach(function (k) {
      var v = params.get(k);
      if (v) fresh[k.replace('utm_', '')] = v;
    });
    // Merge with stored (new wins)
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem(UTM_KEY) || '{}'); } catch (e) {}
    for (var k in fresh) stored[k] = fresh[k];
    localStorage.setItem(UTM_KEY, JSON.stringify(stored));
    return stored;
  }

  // ── Normalize page path ──
  function getPage() {
    var p = location.pathname
      .replace(/\/index\.html?$/i, '/')
      .replace(/\.html?$/i, '')
      .replace(/\/+$/, '') || '/';
    return p;
  }

  // ── Send event (text/plain to skip CORS preflight) ──
  function send(type, page, detail) {
    var body = JSON.stringify({
      leadId: getLeadId(),
      type: type,
      page: page || getPage(),
      detail: detail || null,
      utms: getUtms(),
      offerId: OFFER
    });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API, body);
      } else {
        var x = new XMLHttpRequest();
        x.open('POST', API, true);
        x.setRequestHeader('Content-Type', 'text/plain');
        x.send(body);
      }
    } catch (e) { /* silent fail */ }
  }

  // ── Public API (for CPF tracking, checkouts, custom events) ──
  window._tracker = {
    trackCpf: function (status, detail) {
      send('cpf', getPage(), JSON.stringify({ status: status, detail: detail }));
    },
    trackEvent: function (eventType, detail) {
      send(eventType, getPage(), detail);
    },
    trackCheckout: function (detail) {
      send('checkout', getPage(), detail);
    },
    getLeadId: getLeadId
  };

  // ── Auto pageview on load ──
  send('pageview');

  // ── Heartbeat ping (keeps lead "online" in dashboard) ──
  var pingTimer = setInterval(function () {
    send('ping');
  }, PING_INTERVAL);

  // ── Leave event on tab close / navigation ──
  window.addEventListener('beforeunload', function () {
    clearInterval(pingTimer);
    send('leave');
  });

  // ── Also track visibility changes (mobile tab switch) ──
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      send('leave');
    } else {
      send('pageview');
    }
  });

})();
