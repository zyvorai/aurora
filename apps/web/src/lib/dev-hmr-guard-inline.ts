/** Inline script injected in <head> before Next.js bundles — must run synchronously. */
export const DEV_HMR_GUARD_SCRIPT = `
(function () {
  if (typeof window === 'undefined') return;
  var KEY = '__gtmHmrGuard';
  if (window[KEY] && window[KEY].patched) return;

  var state = { patched: true, failures: 0, block: false };
  window[KEY] = state;

  var Native = window.WebSocket;
  var CLOSED = Native.CLOSED;

  function isHmr(url) {
    var u = String(url);
    return u.indexOf('webpack-hmr') !== -1 || u.indexOf('turbopack-hmr') !== -1;
  }

  function notifyStopped() {
    if (state.notified) return;
    state.notified = true;
    try {
      window.dispatchEvent(new CustomEvent('gtm:dev-server-stopped'));
    } catch (e) {}
  }

  function markStopped() {
    state.block = true;
    notifyStopped();
  }

  /** Closed stub — avoids throwing/rejecting when HMR reconnects after make stop. */
  function closedHmrStub() {
    var closeListeners = [];
    var stub = {
      readyState: CLOSED,
      bufferedAmount: 0,
      extensions: '',
      protocol: '',
      binaryType: 'blob',
      url: '',
      close: function () {},
      send: function () {},
      addEventListener: function (type, fn) {
        if (type === 'close' && typeof fn === 'function') closeListeners.push(fn);
      },
      removeEventListener: function (type, fn) {
        if (type !== 'close') return;
        closeListeners = closeListeners.filter(function (f) { return f !== fn; });
      },
      dispatchEvent: function () { return true; },
    };
    setTimeout(function () {
      var ev = { type: 'close', wasClean: true, code: 1000, reason: 'dev server stopped' };
      closeListeners.forEach(function (fn) {
        try { fn(ev); } catch (e) {}
      });
    }, 0);
    return stub;
  }

  function install() {
    function Guarded(url, protocols) {
      if (state.block && isHmr(url)) {
        return closedHmrStub();
      }
      var ws = protocols !== undefined ? new Native(url, protocols) : new Native(url);
      if (isHmr(url)) {
        ws.addEventListener('close', function (ev) {
          if (ev.wasClean) return;
          state.failures += 1;
          if (state.failures >= 2) markStopped();
        });
      }
      return ws;
    }
    Guarded.prototype = Native.prototype;
    try {
      ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) {
        Guarded[k] = Native[k];
      });
    } catch (e) {}
    window.WebSocket = Guarded;
  }

  install();

  window.addEventListener('pagehide', function () {
    state.block = true;
  });
})();
`.trim();
