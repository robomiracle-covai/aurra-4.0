package com.robomiracle.aurra1;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.net.wifi.WifiNetworkSpecifier;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Aurra 1.0 kiosk launcher.
 * Uses WebViewAssetLoader (HTTPS secure origin) so getUserMedia/camera works in WebView.
 */
public class MainActivity extends Activity implements TextToSpeech.OnInitListener {
    private static final String TAG = "Aurra1";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    private static final int SPEECH_REQUEST_CODE = 1002;
    private static final int FILE_CHOOSER_REQUEST_CODE = 1003;
    private static final int STORAGE_PERMISSION_REQUEST_CODE = 1004;
    private static final String START_URL =
            "https://appassets.androidplatform.net/assets/web_assets/index.html#/";

    private WebView webView;
    private TextToSpeech tts;
    private LauncherBridge bridge;
    private boolean pageLoaded = false;
    private boolean ttsReady = false;
    private String pendingSpeakText = null;
    private String pendingSpeakGender = "male";
    private String selectedTtsVoiceName = "en-in-x-ene-network";
    private ValueCallback<Uri[]> fileUploadCallback = null;
    private ConnectivityManager.NetworkCallback wifiNetworkCallback = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hideSystemUI();
        muteSystemChimes();

        webView = new WebView(this) {
            @Override
            public android.view.ActionMode startActionMode(android.view.ActionMode.Callback callback) {
                return null;
            }

            @Override
            public android.view.ActionMode startActionMode(android.view.ActionMode.Callback callback, int type) {
                return null;
            }
        };
        webView.setBackgroundColor(Color.BLACK);
        setContentView(webView);

        tts = new TextToSpeech(this, this);
        setupWebView();
        requestHardwarePermissions();
        loadAppIfReady();
    }

    private void setupWebView() {
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        webView.setWebContentsDebuggingEnabled(true);
        webView.setLongClickable(false);
        webView.setOnLongClickListener(v -> true);
        webView.setHapticFeedbackEnabled(false);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.i(TAG, "Page finished: " + url);
            }

            @Override
            public void onReceivedError(
                    WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e(TAG, "WebView error " + errorCode + ": " + description + " @ " + failingUrl);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (hasHardwarePermissions()) {
                        request.grant(request.getResources());
                    } else {
                        request.deny();
                        requestHardwarePermissions();
                    }
                });
            }

            // ── File upload support for Android WebView ──
            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                // Cancel any previous callback
                if (fileUploadCallback != null) {
                    fileUploadCallback.onReceiveValue(null);
                    fileUploadCallback = null;
                }
                fileUploadCallback = filePathCallback;

                // Request storage permission first on Android < 13
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_EXTERNAL_STORAGE)
                            != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.READ_EXTERNAL_STORAGE},
                                STORAGE_PERMISSION_REQUEST_CODE);
                        return true;
                    }
                } else {
                    // Android 13+: request READ_MEDIA_IMAGES
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.READ_MEDIA_IMAGES)
                            != PackageManager.PERMISSION_GRANTED) {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{
                                    Manifest.permission.READ_MEDIA_IMAGES,
                                    Manifest.permission.READ_MEDIA_VIDEO
                                },
                                STORAGE_PERMISSION_REQUEST_CODE);
                        return true;
                    }
                }
                launchFilePicker();
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "JS: " + consoleMessage.message()
                        + " (" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return true;
            }
        });

        bridge = new LauncherBridge(this);
        webView.addJavascriptInterface(bridge, "AndroidLauncher");
        Log.i(TAG, "AndroidLauncher bridge attached (early)");
    }

    public boolean isTtsEngineReady() {
        return ttsReady && tts != null;
    }

    private volatile boolean isSpeakingNow = false;
    private volatile String currentUtteranceId = null;

    public void speakNative(String text, String gender) {
        runOnUiThread(() -> {
            if (!ttsReady || tts == null) {
                pendingSpeakText = text;
                pendingSpeakGender = "male";
                Log.i(TAG, "TTS queued until engine ready");
                return;
            }
            applyVoiceSettings();
            String uId = "AURRA_TTS_" + System.currentTimeMillis();
            currentUtteranceId = uId;
            isSpeakingNow = true;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript("window.isNativeSpeaking = true;", null));
            }
            int result;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, uId);
            } else {
                result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null);
            }
            Log.i(TAG, "TTS speak result=" + result + " textLen=" + text.length() + " id=" + uId);
        });
    }

    public void setNativeSpeakingFlag(boolean speaking) {
        this.isSpeakingNow = speaking;
        if (!speaking) {
            this.currentUtteranceId = null;
        }
        if (webView != null) {
            webView.post(() -> webView.evaluateJavascript("window.isNativeSpeaking = " + speaking + ";", null));
        }
    }

    public boolean isSpeaking() {
        return isSpeakingNow;
    }

    public void stopNativeSpeech() {
        this.currentUtteranceId = null;
        this.isSpeakingNow = false;
        runOnUiThread(() -> {
            if (tts != null) {
                tts.stop();
            }
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                        "window.isNativeSpeaking = false;",
                        null));
            }
        });
    }

    public void setSelectedTtsVoice(String voiceName) {
        selectedTtsVoiceName = voiceName != null && !voiceName.trim().isEmpty()
                ? voiceName.trim() : null;
        Log.i(TAG, "Selected TTS voice: " + selectedTtsVoiceName);
    }

    public String getMaleTtsVoicesJson() {
        if (!ttsReady || tts == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
            return "[]";
        }
        try {
            java.util.Set<android.speech.tts.Voice> voices = tts.getVoices();
            if (voices == null || voices.isEmpty()) return "[]";
            org.json.JSONArray arr = new org.json.JSONArray();
            java.util.Set<String> seen = new java.util.HashSet<>();
            for (android.speech.tts.Voice voice : voices) {
                if (voice == null || voice.getName() == null) continue;
                if (!isIndianMaleVoice(voice)) continue;
                String name = voice.getName();
                String lower = name.toLowerCase(Locale.US);
                if (!seen.add(lower)) continue;
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("name", name);
                obj.put("locale", voice.getLocale() != null
                        ? voice.getLocale().toLanguageTag() : "en");
                arr.put(obj);
            }
            return arr.toString();
        } catch (Exception e) {
            Log.w(TAG, "getMaleTtsVoicesJson failed: " + e.getMessage());
            return "[]";
        }
    }

    private boolean isGoogleIndiaFemaleCode(String lowerName) {
        if (!lowerName.contains("-in-") && !lowerName.contains("en-in") && !lowerName.contains("hi-in")) {
            return false;
        }
        return lowerName.contains("-end-") || lowerName.contains("-end,") || lowerName.contains("-end.");
    }

    private boolean isIndianVoice(android.speech.tts.Voice voice) {
        if (voice.getLocale() != null) {
            String tag = voice.getLocale().toLanguageTag().toLowerCase(Locale.US);
            if (tag.contains("-in")) return true;
        }
        String name = voice.getName().toLowerCase(Locale.US);
        return name.contains("en-in") || name.contains("hi-in") || name.contains("ta-in")
                || name.contains("te-in") || name.contains("kn-in") || name.contains("ml-in")
                || name.contains("bn-in") || name.contains("gu-in") || name.contains("mr-in")
                || name.contains("mni-in") || name.contains("pa-in");
    }

    private boolean isIndianMaleVoice(android.speech.tts.Voice voice) {
        String lower = voice.getName().toLowerCase(Locale.US);
        if (isFemaleVoiceName(lower)) return false;
        if (isGoogleIndiaFemaleCode(lower)) return false;
        return isIndianVoice(voice);
    }

    private boolean isFemaleVoiceName(String lowerName) {
        return lowerName.contains("female") || lowerName.contains("zira")
                || lowerName.contains("samantha") || lowerName.contains("susan")
                || lowerName.contains("victoria") || lowerName.contains("karen")
                || lowerName.contains("moira") || lowerName.contains("tessa")
                || lowerName.contains("hazel") || lowerName.contains("heera")
                || lowerName.contains("priya");
    }

    private void applyVoiceSettings() {
        if (tts == null) return;
        tts.setPitch(0.85f);
        tts.setSpeechRate(1.0f);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                java.util.Set<android.speech.tts.Voice> voices = tts.getVoices();
                if (voices == null || voices.isEmpty()) return;
                android.speech.tts.Voice best = null;
                if (selectedTtsVoiceName != null) {
                    for (android.speech.tts.Voice voice : voices) {
                        if (selectedTtsVoiceName.equalsIgnoreCase(voice.getName())) {
                            best = voice;
                            break;
                        }
                    }
                }
                if (best == null) {
                    for (android.speech.tts.Voice voice : voices) {
                        if (!isIndianMaleVoice(voice)) continue;
                        String name = voice.getName().toLowerCase(Locale.US);
                        if (name.contains("en-in") && name.contains("-ene-")) {
                            best = voice;
                            break;
                        }
                        if (best == null) best = voice;
                    }
                }
                if (best != null) tts.setVoice(best);
            } catch (Exception e) {
                Log.w(TAG, "Voice pick skipped: " + e.getMessage());
            }
        }
    }

    private void flushPendingSpeech() {
        if (pendingSpeakText != null && ttsReady) {
            String text = pendingSpeakText;
            String gender = pendingSpeakGender;
            pendingSpeakText = null;
            speakNative(text, gender);
        }
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(new Locale("en", "IN"));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.ICE_CREAM_SANDWICH_MR1) {
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        Log.d(TAG, "TTS started: " + utteranceId);
                        if (currentUtteranceId != null && currentUtteranceId.equals(utteranceId)) {
                            notifyNativeSpeechStart();
                        }
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        Log.d(TAG, "TTS done: " + utteranceId);
                        if (currentUtteranceId != null && currentUtteranceId.equals(utteranceId)) {
                            notifyNativeSpeechEnd();
                        } else {
                            Log.d(TAG, "Ignored stale onDone for " + utteranceId + " (active is " + currentUtteranceId + ")");
                        }
                    }

                    @Override
                    public void onError(String utteranceId) {
                        Log.d(TAG, "TTS error: " + utteranceId);
                        if (currentUtteranceId != null && currentUtteranceId.equals(utteranceId)) {
                            notifyNativeSpeechEnd();
                        }
                    }
                });
            }
            ttsReady = true;
            flushPendingSpeech();
            Log.i(TAG, "TextToSpeech ready");
        } else {
            Log.e(TAG, "TextToSpeech init failed: " + status);
        }
    }

    private void notifyNativeSpeechStart() {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.isNativeSpeaking = true; if(window.onNativeSpeechStart){window.onNativeSpeechStart();}",
                null));
    }

    private void notifyNativeSpeechEnd() {
        this.isSpeakingNow = false;
        this.currentUtteranceId = null;
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(
                "window.isNativeSpeaking = false; if(window.onNativeSpeechEnd){window.onNativeSpeechEnd();}",
                null));
    }

    public void startAndroidVoiceRecognition() {
        runOnUiThread(() -> {
            try {
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
                intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Speak to Aurra...");
                startActivityForResult(intent, SPEECH_REQUEST_CODE);
            } catch (Exception e) {
                Log.e(TAG, "Voice recognition unavailable", e);
            }
        });
    }

    private void launchFilePicker() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        // Allow images and videos
        intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/*", "video/mp4"});
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(
                    Intent.createChooser(intent, "Select Image or Video"),
                    FILE_CHOOSER_REQUEST_CODE);
        } catch (Exception e) {
            Log.e(TAG, "File picker launch failed", e);
            if (fileUploadCallback != null) {
                fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = null;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        // ── File chooser result ──
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (fileUploadCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    // Multiple files selected
                    int count = data.getClipData().getItemCount();
                    results = new Uri[count];
                    for (int i = 0; i < count; i++) {
                        results[i] = data.getClipData().getItemAt(i).getUri();
                    }
                } else if (data.getData() != null) {
                    // Single file selected
                    results = new Uri[]{data.getData()};
                }
            }
            fileUploadCallback.onReceiveValue(results);
            fileUploadCallback = null;
            return;
        }

        // ── Speech result ──
        if (requestCode == SPEECH_REQUEST_CODE) {
            if (webView == null) return;
            if (resultCode != RESULT_OK || data == null) {
                webView.post(() -> webView.evaluateJavascript(
                        "if(window.onAndroidSpeechCancel){window.onAndroidSpeechCancel();}",
                        null));
                return;
            }

            ArrayList<String> results = data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (results == null || results.isEmpty()) {
                webView.post(() -> webView.evaluateJavascript(
                        "if(window.onAndroidSpeechCancel){window.onAndroidSpeechCancel();}",
                        null));
                return;
            }

            final String spokenText = results.get(0)
                    .replace("\\", "\\\\")
                    .replace("'", "\\'")
                    .replace("\n", " ")
                    .replace("\r", " ");
            webView.post(() -> webView.evaluateJavascript(
                    "if(window.onAndroidSpeechResult){window.onAndroidSpeechResult('"
                            + spokenText + "');}",
                    null));
            return;
        }
    }

    private void loadAppIfReady() {
        if (pageLoaded || webView == null) return;
        if (!hasHardwarePermissions()) {
            Log.i(TAG, "Waiting for camera/mic permissions before loading app");
            return;
        }
        pageLoaded = true;
        webView.clearCache(true);
        Log.i(TAG, "Loading " + START_URL);
        webView.loadUrl(START_URL);
    }

    private boolean hasHardwarePermissions() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                        == PackageManager.PERMISSION_GRANTED
                && ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                        == PackageManager.PERMISSION_GRANTED;
    }

    private void requestHardwarePermissions() {
        String[] permissions = {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
        };
        boolean needRequest = false;
        for (String perm : permissions) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needRequest = true;
                break;
            }
        }
        if (needRequest) {
            ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        // ── Storage permission for file picker ──
        if (requestCode == STORAGE_PERMISSION_REQUEST_CODE) {
            // Proceed with file picker regardless of grant result
            launchFilePicker();
            return;
        }

        if (requestCode != PERMISSION_REQUEST_CODE) return;

        boolean allGranted = grantResults.length > 0;
        for (int result : grantResults) {
            if (result != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }

        if (allGranted) {
            loadAppIfReady();
        } else {
            showNativeError(
                    "Camera and microphone permissions are required for Aurra. "
                            + "Enable them in Settings → Apps → Aurra → Permissions.");
        }
    }

    private void showNativeError(String message) {
        runOnUiThread(() -> {
            if (webView == null) return;
            String html = "<html><body style='background:#000;color:#0ff;font-family:sans-serif;"
                    + "padding:24px'><h2 style='color:#fff'>Aurra</h2><p>" + message + "</p></body></html>";
            webView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (webView != null) {
            webView.loadUrl(START_URL);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemUI();
        muteSystemChimes();
        releaseWifiNetworkSync();
        if (!pageLoaded && hasHardwarePermissions()) {
            loadAppIfReady();
        }
    }

    private int savedMusicVolume = -1;
    private final android.os.Handler muteHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable restoreMusicRunnable = null;

    public void muteSystemChimes() {
        try {
            android.media.AudioManager audioManager =
                    (android.media.AudioManager) getSystemService(android.content.Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_SYSTEM, 0, 0);
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, 0, 0);
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_ALARM, 0, 0);
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_DTMF, 0, 0);
                Log.i(TAG, "Muted system chime audio streams");
            }
        } catch (Exception e) {
            Log.w(TAG, "muteSystemChimes failed: " + e.getMessage());
        }
    }

    public void silenceSttChime() {
        runOnUiThread(() -> {
            try {
                android.media.AudioManager audioManager =
                        (android.media.AudioManager) getSystemService(android.content.Context.AUDIO_SERVICE);
                if (audioManager == null) return;

                // Mute notification & system chimes only; NEVER mute STREAM_MUSIC
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_SYSTEM, 0, 0);
                audioManager.setStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, 0, 0);
            } catch (Exception e) {
                Log.w(TAG, "silenceSttChime failed: " + e.getMessage());
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
        super.onDestroy();
    }

    private void hideSystemUI() {
        View decorView = getWindow().getDecorView();
        decorView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    /** Request connection to ESP32 access-point (Android 10+ shows system dialog). */
    public void connectToWifiNetwork(String ssid, String password) {
        if (ssid == null || ssid.trim().isEmpty()) {
            Log.w(TAG, "connectToWifiNetwork: empty SSID");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            Log.w(TAG, "connectToWifiNetwork: requires Android 10+");
            return;
        }

        try {
            ConnectivityManager cm = getSystemService(ConnectivityManager.class);
            if (cm == null) return;

            if (wifiNetworkCallback != null) {
                try {
                    cm.unregisterNetworkCallback(wifiNetworkCallback);
                } catch (Exception ignored) {
                }
                wifiNetworkCallback = null;
            }

            WifiNetworkSpecifier.Builder builder = new WifiNetworkSpecifier.Builder()
                    .setSsid(ssid.trim());
            if (password != null && !password.isEmpty()) {
                builder.setWpa2Passphrase(password);
            }

            NetworkRequest request = new NetworkRequest.Builder()
                    .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                    .setNetworkSpecifier(builder.build())
                    .build();

            wifiNetworkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    Log.i(TAG, "ESP32 AP network available: " + ssid);
                    cm.bindProcessToNetwork(network);
                }

                @Override
                public void onUnavailable() {
                    Log.w(TAG, "ESP32 AP network unavailable: " + ssid);
                    cm.bindProcessToNetwork(null);
                }
            };

            cm.requestNetwork(request, wifiNetworkCallback);
        } catch (Exception e) {
            Log.e(TAG, "connectToWifiNetwork failed", e);
        }
    }

    /** Let WebView use the WiFi the user joined manually (clears requestNetwork bind). */
    public void releaseWifiNetwork() {
        releaseWifiNetworkSync();
    }

    /** Synchronous — safe to call from @JavascriptInterface thread before HTTP to ESP32. */
    public void releaseWifiNetworkSync() {
        try {
            ConnectivityManager cm = getSystemService(ConnectivityManager.class);
            if (cm == null) return;
            if (wifiNetworkCallback != null) {
                try {
                    cm.unregisterNetworkCallback(wifiNetworkCallback);
                } catch (Exception ignored) {
                }
                wifiNetworkCallback = null;
            }
            cm.bindProcessToNetwork(null);
            Log.i(TAG, "WiFi network binding released — using system default");
        } catch (Exception e) {
            Log.e(TAG, "releaseWifiNetwork failed", e);
        }
    }

  /**
   * Native HTTP for ESP32 local IPs — bypasses WebView fetch/CORS and stuck network binds.
   * Returns JSON: {"ok":bool,"status":int,"body":"..."}
   *
   * Timeouts:
   *   - Control commands to AP (192.168.4.x): 200 ms — local WiFi responds in <50ms
   *   - Control commands other: 400 ms
   *   - WiFi config / other: 3000 ms
   */
    public String httpRequestSync(String method, String urlString, String body) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlString);
            conn = (HttpURLConnection) url.openConnection();

            boolean isControlCmd = "GET".equalsIgnoreCase(method)
                    && (urlString.contains("/motor") || urlString.contains("/servo")
                    || urlString.contains("/speed") || urlString.contains("/led")
                    || urlString.contains("/rgb") || urlString.contains("/distance"));
            // AP mode (192.168.4.x) = ultra-low latency, no external routing
            boolean isApIp = urlString.contains("192.168.4.");
            int timeoutMs = isControlCmd ? (isApIp ? 200 : 400) : 3000;

            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod(method != null ? method.toUpperCase(Locale.US) : "GET");
            conn.setDoInput(true);

            if (body != null && !body.isEmpty()
                    && ("POST".equalsIgnoreCase(method) || "PUT".equalsIgnoreCase(method))) {
                conn.setDoOutput(true);
                conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
                conn.setFixedLengthStreamingMode(bytes.length);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                }
            }

            int status = conn.getResponseCode();
            InputStream stream = status >= 200 && status < 300
                    ? conn.getInputStream()
                    : conn.getErrorStream();
            String responseBody = readStream(stream);
            boolean ok = status >= 200 && status < 300;
            return "{\"ok\":" + ok + ",\"status\":" + status
                    + ",\"body\":" + jsonString(responseBody) + "}";
        } catch (Exception e) {
            Log.w(TAG, "httpRequestSync failed: " + urlString + " — " + e.getMessage());
            return "{\"ok\":false,\"status\":0,\"body\":\"\",\"error\":"
                    + jsonString(e.getMessage() != null ? e.getMessage() : "error") + "}";
        } finally {
            if (conn != null) conn.disconnect();
        }
    }


    private static String readStream(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        }
        return sb.toString();
    }

    private static String jsonString(String value) {
        if (value == null) return "\"\"";
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                + "\"";
    }
}
