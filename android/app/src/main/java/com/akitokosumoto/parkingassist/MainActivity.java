package com.akitokosumoto.parkingassist;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String WEB_BUNDLE_VERSION = "0.1.12";
    private static final String PREFS_NAME = "parking-assist";
    private static final String REFRESH_KEY = "web-cache-refreshed-" + WEB_BUNDLE_VERSION;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);

        boolean refreshed = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .getBoolean(REFRESH_KEY, false);
        if (refreshed) return;

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                .edit()
                .putBoolean(REFRESH_KEY, true)
                .apply();

        // Remove a Service Worker left by an older APK and reload the bundled
        // page. localStorage is intentionally untouched, so today's records remain.
        new Handler(Looper.getMainLooper()).postDelayed(() -> webView.evaluateJavascript(
                "(async()=>{try{if(navigator.serviceWorker){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()));}if(window.caches){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)));}location.reload();}catch(e){location.reload();}})();",
                null),
                700);
    }
}
