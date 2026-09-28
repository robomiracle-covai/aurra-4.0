package com.robomiracle.aurra1;

import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;

/**
 * JavaScript bridge — exposes window.AndroidLauncher to the WebView for TTS.
 */
public class LauncherBridge {
    private final MainActivity activity;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public LauncherBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void speak(String text) {
        speakWithGender(text, "male");
    }

    @JavascriptInterface
    public void speakWithGender(String text, String gender) {
        if (text == null || text.trim().isEmpty()) return;
        mainHandler.post(() -> activity.speakNative(text, "male"));
    }

    @JavascriptInterface
    public void stopSpeech() {
        mainHandler.post(() -> activity.stopNativeSpeech());
    }

    @JavascriptInterface
    public void muteSystemChimes() {
        mainHandler.post(() -> activity.muteSystemChimes());
    }

    @JavascriptInterface
    public void silenceSttChime() {
        mainHandler.post(() -> activity.silenceSttChime());
    }

    @JavascriptInterface
    public void setVoiceGender(String gender) {
        // Aurra uses male voice only — ignore other values
    }

    @JavascriptInterface
    public void setSelectedTtsVoice(String voiceName) {
        mainHandler.post(() -> activity.setSelectedTtsVoice(voiceName));
    }

    @JavascriptInterface
    public String getMaleTtsVoicesJson() {
        return activity.getMaleTtsVoicesJson();
    }

    @JavascriptInterface
    public void startAndroidVoiceRecognition() {
        mainHandler.post(() -> activity.startAndroidVoiceRecognition());
    }

    @JavascriptInterface
    public boolean isTtsReady() {
        return activity.isTtsEngineReady();
    }

    @JavascriptInterface
    public boolean hasBridge() {
        return true;
    }

    @JavascriptInterface
    public void connectToWifi(String ssid, String password) {
        mainHandler.post(() -> activity.connectToWifiNetwork(ssid, password));
    }

    @JavascriptInterface
    public void releaseWifiNetwork() {
        activity.releaseWifiNetworkSync();
    }

    @JavascriptInterface
    public String httpRequest(String method, String url, String body) {
        return activity.httpRequestSync(method, url, body != null ? body : "");
    }
}
