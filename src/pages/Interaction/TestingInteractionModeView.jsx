import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  FlaskConical,
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  Send,
  Terminal,
  RefreshCw,
  Sparkles,
  Wifi,
  Activity,
  CheckCircle2,
  AlertCircle,
  Copy,
  Trash2,
  Sliders,
  Cpu,
  Clock,
  User,
  Zap,
  Play,
  RotateCcw,
  Key,
  Eye,
  EyeOff,
  Check
} from 'lucide-react';
import { offlineCardService, offlineQaService, offlineFaceService } from '../../db/offlineServices';
import { llmService, DEFAULT_SYSTEM_PROMPT } from '../../services/llmService';
import { getLiveKnowledgeBlock, mergeKnowledgeIntoPrompt } from '../../services/facilityTourKnowledgeService';
import { esp32Service } from '../../services/esp32Service';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { elevenLabsService, DEFAULT_ELEVENLABS_VOICES } from '../../services/elevenLabsService';
import { useCamera } from '../../hooks/useCamera';
import { detectFacesInVideo, loadFaceApiModels } from '../../utils/faceApiHelper';
import { kioskConfigService } from '../../services/kioskConfigService';
import { voiceNavigationService, isAcousticEcho } from '../../services/voiceNavigationService';
import './TestingInteractionModeView.css';

/**
 * Merges incremental and multi-clause speech utterances cleanly:
 * - Prevents repetitive accumulation of prefixes (e.g. "who" + "who are" + "who are you" -> "who are you")
 * - Merges overlapping words
 * - Seamlessly appends distinct separate clauses
 */
export function mergeSpeechUtterances(prevText, nextText) {
  const prev = (prevText || '').trim();
  const next = (nextText || '').trim();
  if (!prev) return next;
  if (!next) return prev;

  const prevLower = prev.toLowerCase();
  const nextLower = next.toLowerCase();

  // 1. If next is an extension of prev (e.g. prev="who are", next="who are you")
  if (nextLower.startsWith(prevLower)) {
    return next;
  }

  // 2. If prev already contains next or ends with next
  if (prevLower.endsWith(nextLower) || prevLower.includes(nextLower)) {
    return prev;
  }

  // 3. Word-level overlap: match trailing words of prev with leading words of next
  const prevWords = prev.split(/\s+/);
  const nextWords = next.split(/\s+/);

  for (let k = Math.min(prevWords.length, nextWords.length); k > 0; k--) {
    const prevSuffix = prevWords.slice(-k).join(' ').toLowerCase();
    const nextPrefix = nextWords.slice(0, k).join(' ').toLowerCase();
    if (prevSuffix === nextPrefix) {
      return [...prevWords, ...nextWords.slice(k)].join(' ');
    }
  }

  // 4. Truly disjoint separate clauses (e.g. "what is your name" + "what are your features")
  return `${prev} ${next}`;
}

export default function TestingInteractionModeView({ onNavigate }) {
  // ── Active Test Module Tab ──
  // 'all' | 'chat' | 'voice' | 'tts' | 'vision' | 'hardware'
  const [activeTab, setActiveTab] = useState('all');

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === 'vision' && !enableVision) {
      setEnableVision(true);
      addLog('SWITCHBOARD', 'Auto-enabled Camera & Vision for Vision PiP inspection', 'info');
    } else if (tab === 'voice' && !enableStt) {
      setEnableStt(true);
      addLog('SWITCHBOARD', 'Auto-enabled Microphone STT for Voice testing', 'info');
    }
  };

  // ── Display Mode: 'customer' (Clean UI) vs 'developer' (Full Diagnostic Lab) ──
  const [uiMode, setUiMode] = useState(() => {
    try {
      return localStorage.getItem('aurra_testing_ui_mode') || 'customer';
    } catch {
      return 'customer';
    }
  });

  const handleToggleUiMode = (newMode) => {
    setUiMode(newMode);
    try {
      localStorage.setItem('aurra_testing_ui_mode', newMode);
    } catch {}
    if (newMode === 'customer') {
      if (!enableChat) setEnableChat(true);
      if (!enableTts) setEnableTts(true);
      // Strictly respect user's STT switch! If switched OFF in developer mode, it stays OFF in customer mode.
      addLog('UI_MODE', `Switched to Customer Mode: Clean conversation interface active (STT: ${enableStt ? 'ON' : 'OFF'})`, 'info');
    } else {
      addLog('UI_MODE', 'Switched to Developer Mode: Full diagnostic workbench active', 'info');
    }
  };

  // ── Master Feature Switches (Isolate features one-by-one) ──
  const [enableChat, setEnableChat] = useState(true);
  const [enableTts, setEnableTts] = useState(true);
  const [enableStt, setEnableStt] = useState(() => {
    try {
      const saved = localStorage.getItem('aurra_testing_stt_enabled');
      if (saved !== null) return saved === 'true';
      return false; // Default OFF for safety
    } catch {
      return false;
    }
  });
  const [enableVision, setEnableVision] = useState(false); // Default OFF for clean isolated testing
  const [enableHardware, setEnableHardware] = useState(false); // Default OFF for clean isolated testing

  // Helper to toggle STT and persist user's choice across modes
  const handleToggleStt = (val) => {
    const nextVal = typeof val === 'boolean' ? val : !enableStt;
    setEnableStt(nextVal);
    try {
      localStorage.setItem('aurra_testing_stt_enabled', String(nextVal));
    } catch {}
  };

  // Ensure Chat & TTS are ready in Customer Mode without overriding user's STT setting
  useEffect(() => {
    if (uiMode === 'customer') {
      if (!enableChat) setEnableChat(true);
      if (!enableTts) setEnableTts(true);
    }
  }, [uiMode, enableChat, enableTts]);

  // ── Chat State ──
  const [messages, setMessages] = useState(() => [
    {
      id: 1,
      role: 'assistant',
      text: (typeof window !== 'undefined' && localStorage.getItem('aurra_testing_ui_mode') === 'developer')
        ? 'Diagnostic Mode Active. Aurra is loaded with official hardware & software specifications from Robomiracle Technologies (Coimbatore).'
        : 'Hello! Welcome to Robomiracle Technologies. I am Aurra, an intelligent AI humanoid receptionist. How may I assist you today?',
      timestamp: Date.now(),
      source: 'system',
      latencyMs: 0
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLlmModel, setSelectedLlmModel] = useState(() => {
    return llmService.getConfig().model || 'qwen/qwen3.8-27b';
  });

  // ── System Prompt (Aurra Spec Sheet Knowledge Base) State ──
  const [systemPromptText, setSystemPromptText] = useState(() => {
    return llmService.getConfig().systemPrompt || DEFAULT_SYSTEM_PROMPT;
  });
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [promptSavedNotice, setPromptSavedNotice] = useState(false);

  const handleModelChange = (newModel) => {
    setSelectedLlmModel(newModel);
    llmService.saveConfig({ model: newModel });
    addLog('LLM', `Switched active Cloud LLM model to: "${newModel}"`, 'info');
  };

  const handleSaveSystemPrompt = (newPrompt) => {
    const trimmed = (newPrompt || '').trim();
    llmService.saveConfig({ systemPrompt: trimmed });
    setSystemPromptText(trimmed);
    setPromptSavedNotice(true);
    setTimeout(() => setPromptSavedNotice(false), 3000);
    addLog('LLM', 'Updated active Cloud LLM system prompt with Aurra Spec Sheet knowledge', 'success');
  };

  const handleResetSystemPrompt = () => {
    llmService.saveConfig({ systemPrompt: DEFAULT_SYSTEM_PROMPT });
    setSystemPromptText(DEFAULT_SYSTEM_PROMPT);
    setPromptSavedNotice(true);
    setTimeout(() => setPromptSavedNotice(false), 3000);
    addLog('LLM', 'Reset Cloud LLM system prompt to Aurra Spec Sheet baseline', 'info');
  };

  const handleSyncSystemPromptWithKnowledge = async () => {
    try {
      const liveBlock = await getLiveKnowledgeBlock(true);
      const merged = mergeKnowledgeIntoPrompt(systemPromptText || DEFAULT_SYSTEM_PROMPT, liveBlock);
      llmService.saveConfig({ systemPrompt: merged });
      setSystemPromptText(merged);
      setPromptSavedNotice(true);
      setTimeout(() => setPromptSavedNotice(false), 3000);
      addLog('LLM', 'Auto-merged latest campus facilities & guided tours into prompt', 'success');
    } catch (err) {
      addLog('LLM', `Failed merging live knowledge: ${err.message}`, 'error');
    }
  };

  const handleBrainProviderToggle = (newProvider) => {
    llmService.saveConfig({ provider: newProvider });
    setBrainProvider(newProvider);
    if (newProvider === 'gemini') {
      setSelectedLlmModel(llmService.getConfig().geminiModel || 'gemini-1.5-flash');
    } else {
      setSelectedLlmModel(llmService.getConfig().model || 'qwen/qwen3.8-27b');
    }
    addLog('LLM', `Brain Engine switched to: ${newProvider === 'gemini' ? 'Google Gemini' : 'Groq Cloud'}`, 'success');
  };

  const handleVoiceStyleToggle = (newStyle) => {
    kioskConfigService.updateConfig({ voiceInteractionStyle: newStyle });
    setVoiceInteractionStyle(newStyle);
    addLog('STT', `Voice Architecture changed to: ${newStyle === 'phone-call' ? 'Phone Call (LiveKit Full-Duplex)' : 'Walkie-Talkie (750ms Patience Buffer)'}`, 'success');
  };

  // ── STT (Voice Recognition) State ──
  const [isSttListening, setIsSttListening] = useState(false);
  const [sttInterim, setSttInterim] = useState('');
  const [sttFinal, setSttFinal] = useState('');
  const [sttError, setSttError] = useState('');
  const recognitionRef = useRef(null);

  // ── Multi-Engine TTS State ──
  const [ttsEngine, setTtsEngine] = useState('browser'); // 'browser' | 'elevenlabs'
  const [ttsTestText, setTtsTestText] = useState('Hello! I am Aurra, an autonomous humanoid AI receptionist developed by Robomiracle Technologies.');
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.05);

  // Browser Voices
  const [browserVoices, setBrowserVoices] = useState([]);
  const [selectedBrowserVoice, setSelectedBrowserVoice] = useState('');

  // ElevenLabs Config
  const [elevenApiKey, setElevenApiKey] = useState(() => elevenLabsService.getConfig().apiKey || '');
  const [elevenVoiceId, setElevenVoiceId] = useState(() => elevenLabsService.getConfig().voiceId || '21m00Tcm4TlvDq8ikWAM');
  const [elevenCustomVoiceId, setElevenCustomVoiceId] = useState(() => elevenLabsService.getConfig().customVoiceId || '');
  const [showApiKey, setShowApiKey] = useState(false);
  const [elevenSavedNotice, setElevenSavedNotice] = useState(false);

  // ── Vision State ──
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState([]);
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [visionInferenceMs, setVisionInferenceMs] = useState(0);
  const [visionIntervalMs, setVisionIntervalMs] = useState(1500);
  const [greetingCooldownSec, setGreetingCooldownSec] = useState(45); // Cooldown buffer in seconds
  const canvasRef = useRef(null);
  const detectionLoopRef = useRef(null);
  const isDetectingRef = useRef(false);
  const enrolledFacesRef = useRef([]);
  const lastGreetingTimeRef = useRef({});
  const noFaceTimerRef = useRef(null);
  const greetingCooldownSecRef = useRef(45);
  greetingCooldownSecRef.current = greetingCooldownSec;

  // ── Synchronization, Anti-Echo & Debounce Refs ──
  const isProcessingRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const lastSpokenTextRef = useRef('');
  const lastSpeechEndTimeRef = useRef(0);
  const acousticResumeTimerRef = useRef(null);
  const isManuallyAbortedRef = useRef(false);
  const lastSpeechUtteranceRef = useRef({ text: '', time: 0 });
  const speechAccumulatorRef = useRef('');
  const speechDebounceTimerRef = useRef(null);
  const handleExecuteQueryRef = useRef(null);
  const playTtsAudioRef = useRef(null);

  // ── Brain Provider & Voice Interaction Architecture State ──
  const [brainProvider, setBrainProvider] = useState(() => llmService.getConfig().provider || 'groq');
  const [voiceInteractionStyle, setVoiceInteractionStyle] = useState(() => kioskConfigService.getConfig().voiceInteractionStyle || 'walkie-talkie');
  const enableSttRef = useRef(enableStt);
  enableSttRef.current = enableStt;
  const enableChatRef = useRef(enableChat);
  enableChatRef.current = enableChat;
  const enableTtsRef = useRef(enableTts);
  enableTtsRef.current = enableTts;
  const enableHardwareRef = useRef(enableHardware);
  enableHardwareRef.current = enableHardware;
  const lastEspStatusRef = useRef(null);

  // ── Hardware State ──
  const [espOnline, setEspOnline] = useState(false);
  const [servoAngles, setServoAngles] = useState([90, 90, 90, 90, 90]);
  const [headTilt, setHeadTilt] = useState(90);

  // ── Live Logs Terminal (Batched Queue for 60 FPS Smoothness) ──
  const [logs, setLogs] = useState([]);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const logContainerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const fpsTextRef = useRef(null);
  const pendingLogsRef = useRef([]);
  const logFlushScheduledRef = useRef(false);

  // Append timestamped log entry without blocking animation or camera
  const addLog = useCallback((source, message, type = 'info', latency = null) => {
    const now = new Date();
    const timeStr = `${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const newEntry = {
      id: Date.now() + Math.random(),
      timeStr,
      source,
      message,
      type, // 'info' | 'success' | 'warn' | 'error' | 'timing'
      latency
    };

    // 1. Immediate console log streams straight to Android logcat for backend adb debugging
    console.log(`[TEST-LAB ${timeStr}] [${source}] ${message}${latency !== null ? ` (${latency}ms)` : ''}`);

    // 2. Batch update UI state once per frame so 60 FPS stays perfectly locked
    pendingLogsRef.current.push(newEntry);
    if (!logFlushScheduledRef.current) {
      logFlushScheduledRef.current = true;
      requestAnimationFrame(() => {
        if (pendingLogsRef.current.length > 0) {
          const batch = pendingLogsRef.current.splice(0, pendingLogsRef.current.length);
          setLogs((prev) => [...prev.slice(-120), ...batch].slice(-150));
        }
        logFlushScheduledRef.current = false;
      });
    }
  }, []);

  // ── FPS Telemetry Loop (Direct DOM - 0 React Re-renders) ──
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId;
    const measureFps = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const currentFps = Math.round((frameCount * 1000) / (now - lastTime));
        frameCount = 0;
        lastTime = now;
        if (fpsTextRef.current) {
          fpsTextRef.current.textContent = `${currentFps} FPS`;
          fpsTextRef.current.style.color = currentFps >= 50 ? '#00ffff' : currentFps >= 30 ? '#f59e0b' : '#ef4444';
        }
      }
      animId = requestAnimationFrame(measureFps);
    };
    animId = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Auto-scroll log terminal
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs.length]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // ── CAMERA HOOK ──
  const { videoRef, startCamera, stopCamera, isStreaming } = useCamera({
    width: 640,
    height: 480,
  });

  // Camera Lifecycle
  useEffect(() => {
    if (enableVision) {
      addLog('VISION', 'Initializing camera hardware & neural models...');
      loadFaceApiModels()
        .then((ok) => {
          setModelsLoaded(ok);
          addLog('VISION', 'Face API neural network models loaded', 'success');
        })
        .catch((err) => addLog('VISION', `Model load error: ${err.message}`, 'error'));

      startCamera()
        .then(() => addLog('VISION', 'Camera stream opened (640x480)', 'success'))
        .catch((err) => addLog('VISION', `Camera error: ${err.message}`, 'error'));
    } else {
      stopCamera();
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setDetectedFaces([]);
      addLog('VISION', 'Camera hardware powered OFF & released', 'warn');
    }
  }, [enableVision, startCamera, stopCamera, addLog]);

  // Load Enrolled Faces from Dexie DB
  useEffect(() => {
    async function loadFaces() {
      try {
        const users = await offlineFaceService.getUsers();
        setEnrolledFaces(users || []);
        enrolledFacesRef.current = users || [];
        if (users && users.length > 0) {
          addLog('VISION', `Loaded ${users.length} enrolled VIP face profile(s) from database`, 'info');
        } else {
          addLog('VISION', 'No enrolled VIP faces in database (all detected will be Guest)', 'info');
        }
      } catch (err) {
        addLog('VISION', `Failed loading enrolled faces: ${err.message}`, 'error');
      }
    }
    loadFaces();
  }, [addLog]);

  // Face Detection Loop with Descriptor Matching & Cooldown Buffer Greeting
  const runVisionInference = useCallback(async () => {
    if (!enableVision || isDetectingRef.current || !videoRef.current || !canvasRef.current || !isStreaming) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.paused || video.ended || !video.videoWidth) return;

    isDetectingRef.current = true;
    const t0 = performance.now();

    try {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Detect faces with descriptors so we can match enrolled faces
      const detections = await detectFacesInVideo(video, 'tinyFace', {
        withDescriptors: true,
        inputSize: 224,
        scoreThreshold: 0.5,
      });

      const inferenceMs = Math.round(performance.now() - t0);
      setVisionInferenceMs(inferenceMs);
      setDetectedFaces(detections || []);

      if (!detections || detections.length === 0) {
        // Departure check: reset greeting cooldown after 15s of empty frame
        if (!noFaceTimerRef.current) {
          noFaceTimerRef.current = setTimeout(() => {
            lastGreetingTimeRef.current = {};
            noFaceTimerRef.current = null;
            addLog('VISION', 'No faces seen for 15s — visitor departed, greeting buffer reset', 'info');
          }, 15000);
        }
        return;
      }

      // Face present: clear departure reset timer
      if (noFaceTimerRef.current) {
        clearTimeout(noFaceTimerRef.current);
        noFaceTimerRef.current = null;
      }

      const currentEnrolled = enrolledFacesRef.current || [];

      for (const det of detections) {
        const box = det.detection ? det.detection.box : det.box || det;
        if (!box) continue;

        // Biometric Match against enrolled faces
        let matchedFace = null;
        let bestDistance = 1.0;

        if (currentEnrolled.length > 0 && det.descriptor) {
          for (const enrolled of currentEnrolled) {
            const emb = enrolled.faceEmbedding || enrolled.descriptor;
            if (emb && emb.length) {
              const descA = Array.from(det.descriptor);
              const descB = Array.from(emb);
              const dist = Math.sqrt(descA.reduce((sum, val, i) => sum + Math.pow(val - (descB[i] || 0), 2), 0));
              if (dist < 0.55 && dist < bestDistance) {
                bestDistance = dist;
                matchedFace = enrolled;
              }
            }
          }
        }

        // Draw on unmirrored canvas with mirrored coordinates (so text is NOT inverted!)
        const drawX = canvas.width - (box.x + box.width);
        const drawY = box.y;
        const drawW = box.width;
        const drawH = box.height;

        ctx.strokeStyle = matchedFace ? '#10b981' : '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(drawX, drawY, drawW, drawH);

        // Cyber Corner Accents
        const cl = Math.min(drawW, drawH) * 0.2;
        ctx.strokeStyle = matchedFace ? '#34d399' : '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(drawX, drawY + cl); ctx.lineTo(drawX, drawY); ctx.lineTo(drawX + cl, drawY); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(drawX + drawW - cl, drawY); ctx.lineTo(drawX + drawW, drawY); ctx.lineTo(drawX + drawW, drawY + cl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(drawX, drawY + drawH - cl); ctx.lineTo(drawX, drawY + drawH); ctx.lineTo(drawX + cl, drawY + drawH); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(drawX + drawW - cl, drawY + drawH); ctx.lineTo(drawX + drawW, drawY + drawH); ctx.lineTo(drawX + drawW, drawY + drawH - cl); ctx.stroke();

        const badgeText = matchedFace ? `VIP: ${matchedFace.name.toUpperCase()}` : `GUEST (${inferenceMs}ms)`;
        ctx.font = 'bold 11px sans-serif';
        const textMetrics = ctx.measureText(badgeText);
        const badgeWidth = Math.max(textMetrics.width + 16, drawW);

        ctx.fillStyle = matchedFace ? 'rgba(16, 185, 129, 0.9)' : 'rgba(0, 255, 255, 0.85)';
        ctx.fillRect(drawX, Math.max(0, drawY - 22), badgeWidth, 22);
        ctx.fillStyle = '#031127';
        ctx.fillText(badgeText, drawX + 6, Math.max(15, drawY - 6));

        // ── GREETING TRIGGER WITH CONFIGURABLE BUFFER COOLDOWN ──
        const personKey = matchedFace ? `vip_${matchedFace.id || matchedFace.name}` : 'guest';
        const now = Date.now();
        const lastGreeted = lastGreetingTimeRef.current[personKey] || 0;
        const cooldownMs = (greetingCooldownSecRef.current || 45) * 1000;
        const isCooldownActive = (now - lastGreeted) < cooldownMs;

        const isBusy = isProcessingRef.current || isSpeakingRef.current;

        if (!isCooldownActive && !isBusy) {
          lastGreetingTimeRef.current[personKey] = now;

          const greetingMsg = matchedFace
            ? `Hello ${matchedFace.name}! Welcome to Robomiracle Technologies. I am Aurra, your AI receptionist.`
            : 'Hello! Welcome to Robomiracle Technologies. I am Aurra, an autonomous humanoid receptionist. How may I assist you today?';

          addLog('VISION', `🎯 GREETING TRIGGERED: "${greetingMsg}" [${matchedFace ? 'VIP: ' + matchedFace.name : 'GUEST'}] (Cooldown buffer: ${greetingCooldownSecRef.current}s)`, 'success');

          // Append to messages stream
          const greetingChatMsg = {
            id: Date.now(),
            role: 'assistant',
            text: greetingMsg,
            timestamp: Date.now(),
            source: 'face-greeting',
            confidence: matchedFace ? Math.round((1 - bestDistance) * 100) : 100,
            matchedPerson: matchedFace ? matchedFace.name : 'Guest',
            latencyMs: inferenceMs,
          };
          setMessages((prev) => [...prev, greetingChatMsg]);

          // Animate hardware head gesture if enabled
          if (enableHardwareRef.current) {
            esp32Service.setHeadTilt(105).catch(() => {});
            setTimeout(() => {
              esp32Service.setHeadTilt(90).catch(() => {});
            }, 1800);
          }

          // Spoken audio greeting if TTS switch is ON
          if (enableTtsRef.current && playTtsAudioRef.current) {
            playTtsAudioRef.current(greetingMsg);
          }
        }
      }
    } catch (err) {
      addLog('VISION', `Detection exception: ${err.message}`, 'error');
    } finally {
      isDetectingRef.current = false;
    }
  }, [enableVision, isStreaming, addLog]);

  useEffect(() => {
    if (!enableVision) {
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
      return;
    }
    detectionLoopRef.current = setInterval(runVisionInference, visionIntervalMs);
    return () => {
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    };
  }, [enableVision, visionIntervalMs, runVisionInference]);

  // Disconnect global background voice listener while in isolated testing lab
  useEffect(() => {
    if (voiceNavigationService?.stopListening) {
      voiceNavigationService.stopListening(true);
      addLog('SYSTEM', 'Isolated Testing Lab active: Global VoiceAssistantBar listener paused', 'info');
    }
  }, [addLog]);

  // ── SPEECH RECOGNITION (STT) LIFECYCLE & ANTI-ECHO CONTROLLER ──
  const startMicrophone = useCallback(() => {
    if (!enableSttRef.current) return;
    if (isSpeakingRef.current) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      addLog('STT', 'SpeechRecognition API not available in this WebView', 'error');
      return;
    }

    if (recognitionRef.current) {
      try {
        isManuallyAbortedRef.current = true;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        isManuallyAbortedRef.current = false;
        setIsSttListening(true);
        setSttError('');
        addLog('STT', 'Microphone active - listening for voice', 'success');
      };

      rec.onaudiostart = () => {
        addLog('STT', 'Audio hardware capture active', 'info');
      };

      rec.onspeechstart = () => {
        addLog('STT', 'Voice detected by microphone', 'info');
      };

      rec.onresult = (event) => {
        // Drop audio if Aurra is actively vocalizing TTS or Android native speech is active
        const isDeviceSpeaking = isSpeakingRef.current ||
          (typeof window !== 'undefined' && (
            window.isNativeSpeaking ||
            (window.AndroidLauncher && typeof window.AndroidLauncher.isSpeaking === 'function' && window.AndroidLauncher.isSpeaking())
          ));
        if (isDeviceSpeaking) {
          return;
        }

        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) final += item[0].transcript;
          else interim += item[0].transcript;
        }

        if (interim) {
          setSttInterim(interim);
        }

        if (final) {
          const cleanFinal = final.trim();
          if (!cleanFinal || cleanFinal.length < 2) return;

          const now = Date.now();

          // 1. Acoustic echo filter: Blocks self-voice echo loop
          const hLower = cleanFinal.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const sLower = (lastSpokenTextRef.current || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
          const isRecentSpeech = lastSpeechEndTimeRef.current && (now - lastSpeechEndTimeRef.current < 2500);

          if (isRecentSpeech && (
            isAcousticEcho(cleanFinal, lastSpokenTextRef.current) ||
            hLower === 'i am' ||
            hLower === 'i am i am' ||
            (sLower && hLower.length >= 4 && sLower.startsWith(hLower))
          )) {
            addLog('STT', `🛡️ Acoustic Echo Filter: Blocked self-voice loop: "${cleanFinal}"`, 'warn');
            setSttInterim('');
            return;
          }

          // 2. Accumulate speech into End-of-Thought patience buffer using mergeSpeechUtterances to eliminate duplicate prefixes
          const accumulated = mergeSpeechUtterances(speechAccumulatorRef.current, cleanFinal);
          speechAccumulatorRef.current = accumulated;

          // Instant visual feedback showing speech tokens being accumulated
          setSttInterim(accumulated);

          // Reset existing debounce timer
          if (speechDebounceTimerRef.current) {
            clearTimeout(speechDebounceTimerRef.current);
          }

          // 3. 750ms End-of-Thought Patience Window (Waits for full user thought before dispatching)
          speechDebounceTimerRef.current = setTimeout(() => {
            const fullUtterance = speechAccumulatorRef.current.trim();
            speechAccumulatorRef.current = '';
            setSttInterim('');

            if (!fullUtterance || fullUtterance.length < 2) return;

            const tNow = Date.now();
            const last = lastSpeechUtteranceRef.current;
            if (
              (fullUtterance.toLowerCase() === last.text.toLowerCase() && (tNow - last.time) < 1500) ||
              isProcessingRef.current
            ) {
              addLog('STT', `Suppressed duplicate speech input: "${fullUtterance}" (pipeline busy or debounce)`, 'warn');
              return;
            }

            lastSpeechUtteranceRef.current = { text: fullUtterance, time: tNow };
            setSttFinal(fullUtterance);
            addLog('STT', `🎙️ Full Utterance Captured: "${fullUtterance}"`, 'timing');

            if (enableChatRef.current && handleExecuteQueryRef.current) {
              handleExecuteQueryRef.current(fullUtterance, 'voice');
            }
          }, 750);
        }
      };

      rec.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') {
          setSttError(e.error);
          addLog('STT', `Recognition event: ${e.error}`, 'warn');
        }
      };

      rec.onend = () => {
        setIsSttListening(false);
        // If aborted intentionally for TTS playback or mute, do not restart
        if (isManuallyAbortedRef.current) {
          return;
        }

        // Auto-restart on Android if STT switch is still ON and we are NOT speaking
        if (enableSttRef.current && !isSpeakingRef.current) {
          setTimeout(() => {
            if (enableSttRef.current && !isSpeakingRef.current) {
              startMicrophone();
            }
          }, 150);
        }
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      setSttError(err.message);
      addLog('STT', `Failed to start STT: ${err.message}`, 'error');
    }
  }, [addLog]);

  const stopMicrophone = useCallback((isPermanent = false) => {
    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }
    speechAccumulatorRef.current = '';

    if (acousticResumeTimerRef.current) {
      clearTimeout(acousticResumeTimerRef.current);
      acousticResumeTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        isManuallyAbortedRef.current = true;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsSttListening(false);
    setSttInterim('');
    if (isPermanent) {
      addLog('STT', 'Microphone STOPPED & muted', 'warn');
    }
  }, [addLog]);

  const safeResumeListeningAfterTts = useCallback(() => {
    if (acousticResumeTimerRef.current) {
      clearTimeout(acousticResumeTimerRef.current);
      acousticResumeTimerRef.current = null;
    }

    const checkAndResume = () => {
      // If native Android TTS is still speaking, poll until speaker is silent
      const isNativeStillSpeaking = typeof window !== 'undefined' && (
        window.isNativeSpeaking ||
        (window.AndroidLauncher && typeof window.AndroidLauncher.isSpeaking === 'function' && window.AndroidLauncher.isSpeaking())
      );

      if (isNativeStillSpeaking) {
        acousticResumeTimerRef.current = setTimeout(checkAndResume, 150);
        return;
      }

      // Acoustic settling buffer (850ms) to ensure room reverberation from speakers has completely dissipated
      acousticResumeTimerRef.current = setTimeout(() => {
        acousticResumeTimerRef.current = null;
        isSpeakingRef.current = false;
        lastSpeechEndTimeRef.current = Date.now();
        if (enableSttRef.current) {
          startMicrophone();
          addLog('STT', 'Speech playback concluded. Microphone resumed listening.', 'info');
        }
      }, 850);
    };

    checkAndResume();
  }, [startMicrophone, addLog]);

  useEffect(() => {
    if (enableStt) {
      cancelSpeech();
      isSpeakingRef.current = false;
      isProcessingRef.current = false;
      lastSpeechEndTimeRef.current = 0;
      startMicrophone();
    } else {
      stopMicrophone(true);
    }

    return () => {
      stopMicrophone(false);
    };
  }, [enableStt, startMicrophone, stopMicrophone]);

  // ── HARDWARE STATUS CHECK ──
  const checkHardwareStatus = useCallback(async () => {
    const t0 = performance.now();
    try {
      const isOnline = await esp32Service.checkConnection();
      const latency = Math.round(performance.now() - t0);
      setEspOnline(Boolean(isOnline));
      if (lastEspStatusRef.current !== isOnline) {
        lastEspStatusRef.current = isOnline;
        addLog('HARDWARE', `ESP32 connection status: ${isOnline ? 'ONLINE' : 'OFFLINE (SIMULATION)'}`, isOnline ? 'success' : 'warn', latency);
      }
    } catch (err) {
      setEspOnline(false);
      if (lastEspStatusRef.current !== false) {
        lastEspStatusRef.current = false;
        addLog('HARDWARE', `ESP32 check error: ${err.message}`, 'error');
      }
    }
  }, [addLog]);

  useEffect(() => {
    if (enableHardware) {
      checkHardwareStatus();
      const interval = setInterval(checkHardwareStatus, 6000);
      return () => clearInterval(interval);
    }
  }, [enableHardware, checkHardwareStatus]);

  // ── CORE PIPELINE: EXECUTE QUERY (TEXT OR VOICE) WITH DETAILED LATENCY ──
  const handleExecuteQuery = async (queryText, inputSource = 'text') => {
    const query = (queryText || '').trim();
    if (!query) return;

    // Urgent voice stop command check
    const lowerQuery = query.toLowerCase();
    if (lowerQuery === 'stop' || lowerQuery === 'cancel' || lowerQuery === 'quiet' || lowerQuery === 'shut up') {
      cancelSpeech();
      elevenLabsService.cancel();
      setIsTtsPlaying(false);
      isSpeakingRef.current = false;
      lastSpeechEndTimeRef.current = Date.now();
      addLog('PIPELINE', `Handled urgent voice stop command: "${query}"`, 'warn');
      safeResumeListeningAfterTts();
      return;
    }

    // Synchronous execution lock to prevent duplicate concurrent queries or interruptions while speaking
    if (isProcessingRef.current || isSpeakingRef.current) {
      addLog('PIPELINE', `Discarded overlapping query "${query}" (pipeline busy or currently speaking)`, 'warn');
      return;
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    const overallT0 = performance.now();

    // Auto-unlock watchdog: guarantee pipeline never stays locked if network hangs
    let processingWatchdog = setTimeout(() => {
      if (isProcessingRef.current) {
        isProcessingRef.current = false;
        setIsProcessing(false);
        addLog('PIPELINE', 'Pipeline processing lock auto-recovered after timeout', 'warn');
      }
    }, 8000);

    // 1. Add User message
    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: query,
      timestamp: Date.now(),
      source: inputSource,
    };
    setMessages((prev) => [...prev, userMsg]);
    addLog('PIPELINE', `[Step 1] Query submitted via [${inputSource.toUpperCase()}]: "${query}"`, 'info');

    let replyText = '';
    let matchSource = '';
    let matchConfidence = 100;
    let matchedFaqInfo = null;
    let llmDetails = null;
    let fallbackInfo = null;

    try {
      // 2. Hardware intent evaluation
      if (enableHardwareRef.current) {
        const hwT0 = performance.now();
        const lower = query.toLowerCase();
        if (lower.includes('head up') || lower.includes('tilt up')) {
          await esp32Service.setHeadTilt(115);
          setHeadTilt(115);
          replyText = 'Tilted robot head upwards to 115 degrees.';
          matchSource = 'hardware';
          addLog('PIPELINE', `[Step 2] Hardware intent executed (head up 115°)`, 'success', Math.round(performance.now() - hwT0));
        } else if (lower.includes('head down') || lower.includes('tilt down')) {
          await esp32Service.setHeadTilt(65);
          setHeadTilt(65);
          replyText = 'Tilted robot head downwards to 65 degrees.';
          matchSource = 'hardware';
          addLog('PIPELINE', `[Step 2] Hardware intent executed (head down 65°)`, 'success', Math.round(performance.now() - hwT0));
        } else if (lower.includes('head center') || lower.includes('reset head')) {
          await esp32Service.setHeadTilt(90);
          setHeadTilt(90);
          replyText = 'Reset robot head to neutral 90 degrees.';
          matchSource = 'hardware';
          addLog('PIPELINE', `[Step 2] Hardware intent executed (head center 90°)`, 'success', Math.round(performance.now() - hwT0));
        }
      }

      // 3. Offline Q&A Knowledge Base (Customized Answers)
      if (!replyText) {
        const qaT0 = performance.now();
        const qaResult = await offlineQaService.findBestAnswer(query);
        const qaLatency = Math.round(performance.now() - qaT0);

        if (qaResult?.match && qaResult.confidence >= 65) {
          replyText = qaResult.match.answer;
          matchSource = 'offline-faq';
          matchConfidence = qaResult.confidence;
          matchedFaqInfo = {
            question: qaResult.match.question,
            category: qaResult.match.category || 'General',
            confidence: qaResult.confidence,
            qaLatencyMs: qaLatency,
          };
          addLog('PIPELINE', `[Step 3] CUSTOMIZED FAQ MATCHED: "${qaResult.match.question}" (${matchConfidence}%) in ${qaLatency}ms`, 'success', qaLatency);
        } else {
          const bestScore = qaResult?.confidence || 0;
          addLog('PIPELINE', `[Step 3] Offline FAQ search: no custom answer matched above 65% (Best was ${bestScore}%)`, 'info', qaLatency);
        }
      }

      // 4. Real AI Groq Cloud API
      if (!replyText && llmService.isConfigured()) {
        const llmT0 = performance.now();
        const currentModel = llmService.getConfig().model || selectedLlmModel;
        addLog('PIPELINE', `[Step 4] Escalating to Groq LLM Cloud API (Model: ${currentModel})...`, 'info');
        const llmResult = await llmService.generateResponse(query, []);
        const llmLatency = Math.round(performance.now() - llmT0);

        if (llmResult.success && llmResult.text) {
          replyText = llmResult.text;
          matchSource = llmResult.model === 'Local Clock Engine' ? 'local-clock' : 'groq-llm';
          matchConfidence = 99;
          llmDetails = {
            model: llmResult.model || currentModel,
            provider: llmResult.provider || 'Groq Cloud API',
            latencyMs: llmResult.latencyMs || llmLatency,
            tokens: llmResult.tokens,
            ragDetails: llmResult.ragDetails,
          };
          if (llmResult.ragDetails) {
            addLog('RAG', `Live context fetched via [${llmResult.ragDetails.source}]: ${llmResult.ragDetails.summary || 'Web Ground Truth'}`, 'timing', llmResult.ragDetails.latencyMs);
          }
          addLog('PIPELINE', `[Step 4] ${llmResult.model === 'Local Clock Engine' ? 'Local Clock' : 'Groq LLM [' + llmDetails.model + ']'} answer returned (${llmDetails.latencyMs}ms)`, 'success', llmLatency);
        } else {
          addLog('PIPELINE', `[Step 4] Groq LLM failed: ${llmResult.error || 'Empty response'}`, 'warn', llmLatency);
          fallbackInfo = {
            llmError: llmResult.error || 'Empty response received from LLM endpoint',
          };
        }
      }

      // 5. Fallback response
      if (!replyText) {
        replyText = "I heard you, but I couldn't find a matching offline FAQ answer or active Cloud AI key.";
        matchSource = 'fallback';
        matchConfidence = 0;
        addLog('PIPELINE', `[Step 5] Fallback triggered: no matching custom FAQ and LLM did not return text`, 'warn');
      }

      const totalLatency = Math.round(performance.now() - overallT0);

      // 6. Append Assistant message with rich origin metadata
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: replyText,
        timestamp: Date.now(),
        source: matchSource,
        confidence: matchConfidence,
        latencyMs: totalLatency,
        matchedFaq: matchedFaqInfo,
        llmInfo: llmDetails,
        fallbackInfo: fallbackInfo,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      addLog('PIPELINE', `[Step 6] Response rendered to UI in ${totalLatency}ms total`, 'timing', totalLatency);

      // 7. Optional TTS Audio Playback (Unified Browser or ElevenLabs)
      if (enableTtsRef.current && replyText) {
        addLog('TTS', `Triggering audio speech playback...`);
        playTtsAudio(replyText);
      }
    } catch (err) {
      addLog('PIPELINE', `Critical pipeline error: ${err.message}`, 'error');
    } finally {
      if (processingWatchdog) clearTimeout(processingWatchdog);
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };
  handleExecuteQueryRef.current = handleExecuteQuery;

  // Load Browser Voices on Mount
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const v = window.speechSynthesis.getVoices() || [];
        if (v.length > 0) {
          setBrowserVoices(v);
          if (!selectedBrowserVoice) {
            const preferred = v.find((x) => {
              const n = (x.name || '').toLowerCase();
              const l = (x.lang || '').toLowerCase();
              return (
                (l.includes('en-in') || l.includes('hi-in') || n.includes('india')) &&
                (n.includes('female') || n.includes('neerja') || n.includes('heera') || n.includes('natural'))
              );
            }) || v.find((x) => x.lang.includes('en-IN')) || v.find((x) => x.name.toLowerCase().includes('female')) || v[0];
            if (preferred) setSelectedBrowserVoice(preferred.voiceURI || preferred.name);
          }
        }
      }
    };
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedBrowserVoice]);

  // Unified audio speech player for both ElevenLabs and Browser SpeechSynthesis
  const playTtsAudio = useCallback(async (textToSpeak) => {
    const cleanText = (textToSpeak || '').trim();
    if (!cleanText) return;

    // 1. Immediately lock speaking flag & record spoken text for echo cancellation
    setIsTtsPlaying(true);
    isSpeakingRef.current = true;
    lastSpokenTextRef.current = cleanText;

    if (speechDebounceTimerRef.current) {
      clearTimeout(speechDebounceTimerRef.current);
      speechDebounceTimerRef.current = null;
    }
    speechAccumulatorRef.current = '';

    // 2. Clear any pending acoustic resume timer
    if (acousticResumeTimerRef.current) {
      clearTimeout(acousticResumeTimerRef.current);
      acousticResumeTimerRef.current = null;
    }

    // 3. Hardware-mute microphone: abort active recognition so Chrome captures zero audio from speakers
    if (recognitionRef.current) {
      try {
        isManuallyAbortedRef.current = true;
        recognitionRef.current.abort();
        addLog('STT', 'Microphone hardware-muted during TTS speech to prevent echo loop', 'info');
      } catch {}
    }

    let settled = false;

    // 4. Safety watchdog in case audio fails to fire onEnd
    const words = cleanText.split(/\s+/).length;
    const maxTtsDurationMs = Math.max(6000, words * 700 + 4000);
    const watchdogTimer = setTimeout(() => {
      if (!settled && isSpeakingRef.current) {
        addLog('TTS', `Speech watchdog auto-recovery after ${maxTtsDurationMs}ms`, 'warn');
        handleFinish();
      }
    }, maxTtsDurationMs);

    const handleFinish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdogTimer);
      setIsTtsPlaying(false);
      safeResumeListeningAfterTts();
    };

    if (ttsEngine === 'elevenlabs' && elevenLabsService.isConfigured()) {
      const activeVoice = elevenLabsService.getActiveVoiceId();
      addLog('TTS', `[ElevenLabs] Synthesizing speech with voice [${activeVoice}]...`, 'info');
      const t0 = performance.now();
      const res = await elevenLabsService.speak(cleanText, {
        onStart: () => {
          isSpeakingRef.current = true;
          addLog('TTS', `[ElevenLabs] Audio streaming & playback active`, 'success');
        },
        onEnd: () => {
          const elapsed = Math.round(performance.now() - t0);
          addLog('TTS', `[ElevenLabs] Audio playback finished (took ${elapsed}ms)`, 'timing', elapsed);
          handleFinish();
        },
        onError: (err) => {
          addLog('TTS', `[ElevenLabs] Playback error: ${err.message || err}. Falling back to Browser TTS...`, 'warn');
          speakWithVoice(cleanText, {
            voiceURI: selectedBrowserVoice,
            rate: ttsSpeed,
            pitch: ttsPitch,
            gender: 'female',
            onStart: () => { isSpeakingRef.current = true; },
            onEnd: () => {
              handleFinish();
            },
            onError: () => {
              handleFinish();
            }
          });
        },
      });

      if (!res.success) {
        addLog('TTS', `[ElevenLabs] Synthesis failed: ${res.error}. Speaking via Browser TTS...`, 'warn');
        speakWithVoice(cleanText, {
          voiceURI: selectedBrowserVoice,
          rate: ttsSpeed,
          pitch: ttsPitch,
          gender: 'female',
          onStart: () => { isSpeakingRef.current = true; },
          onEnd: () => {
            handleFinish();
          },
          onError: () => {
            handleFinish();
          }
        });
      }
    } else {
      addLog('TTS', `[Browser TTS] Speaking via "${selectedBrowserVoice || 'Default'}" (Pitch: ${ttsPitch}, Speed: ${ttsSpeed}x)...`, 'info');
      const t0 = performance.now();
      speakWithVoice(cleanText, {
        voiceURI: selectedBrowserVoice,
        rate: ttsSpeed,
        pitch: ttsPitch,
        gender: 'female',
        onStart: () => {
          isSpeakingRef.current = true;
          addLog('TTS', `[Browser TTS] Audio speech output started (+${Math.round(performance.now() - t0)}ms)`, 'timing');
        },
        onEnd: () => {
          const elapsed = Math.round(performance.now() - t0);
          addLog('TTS', `[Browser TTS] Speech completed in ${elapsed}ms`, 'success');
          handleFinish();
        },
        onError: (err) => {
          addLog('TTS', `[Browser TTS] Speech error: ${err}`, 'error');
          handleFinish();
        },
      });
    }
  }, [ttsEngine, selectedBrowserVoice, ttsSpeed, ttsPitch, addLog, safeResumeListeningAfterTts]);
  playTtsAudioRef.current = playTtsAudio;

  // Handle ElevenLabs config save
  const handleSaveElevenLabs = (key, voiceId, customId) => {
    const updated = elevenLabsService.saveConfig({
      apiKey: key.trim(),
      voiceId: voiceId,
      customVoiceId: customId.trim(),
      enabled: ttsEngine === 'elevenlabs',
    });
    setElevenSavedNotice(true);
    setTimeout(() => setElevenSavedNotice(false), 3000);
    addLog('TTS', `ElevenLabs configuration saved. Active Voice: ${updated.voiceId === 'custom' ? updated.customVoiceId : updated.voiceId}`, 'success');
  };

  // ── TTS Standalone Audio Tester ──
  const handleTestTts = () => {
    if (!ttsTestText.trim()) return;
    playTtsAudio(ttsTestText);
  };

  const handleStopTts = () => {
    cancelSpeech();
    elevenLabsService.cancel();
    setIsTtsPlaying(false);
    isSpeakingRef.current = false;
    lastSpeechEndTimeRef.current = Date.now();
    addLog('TTS', 'Speech synthesis audio STOPPED by user', 'warn');
    safeResumeListeningAfterTts();
  };

  return (
    <div className="tia-root">
      {/* ── Top Diagnostic Header with Customer / Developer Mode Toggle ── */}
      <header className="tia-header">
        <div className="tia-header-left">
          <button className="tia-back-btn" onClick={() => onNavigate('/')} title="Return to Main Menu">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </button>
          <div className="tia-title-group">
            <div className="tia-badge">
              {uiMode === 'customer' ? (
                <>
                  <User size={14} color="#10b981" />
                  <span style={{ color: '#10b981' }}>CUSTOMER INTERACTION MODE</span>
                </>
              ) : (
                <>
                  <FlaskConical size={14} color="#f59e0b" />
                  <span>TESTING & DIAGNOSTIC LAB</span>
                </>
              )}
            </div>
            <h1>{uiMode === 'customer' ? 'Aurra AI Receptionist' : 'Interactive Mode Feature Isolator'}</h1>
          </div>
        </div>

        {/* Center: Customer Mode vs Developer Mode Toggle */}
        <div className="tia-mode-toggle-group">
          <button
            type="button"
            className={`tia-mode-btn ${uiMode === 'customer' ? 'active-customer' : ''}`}
            onClick={() => handleToggleUiMode('customer')}
            title="Clean Presentation UI for talking to customers - only text input and output visible"
          >
            <User size={14} />
            <span>Customer Mode</span>
          </button>
          <button
            type="button"
            className={`tia-mode-btn ${uiMode === 'developer' ? 'active-dev' : ''}`}
            onClick={() => handleToggleUiMode('developer')}
            title="Developer Mode - all diagnostic switches, tabs & telemetry logs visible"
          >
            <Sliders size={14} />
            <span>Developer Mode</span>
          </button>
        </div>

        <div className="tia-header-right">
          {uiMode === 'developer' && (
            <div className="tia-telemetry-pill">
              <span className="tia-fps-dot" />
              <strong ref={fpsTextRef}>60 FPS</strong>
            </div>
          )}
          <button
            className="tia-btn-icon"
            onClick={() => {
              setMessages([
                {
                  id: Date.now(),
                  role: 'assistant',
                  text: uiMode === 'customer'
                    ? 'Hello! Welcome to Robomiracle Technologies. I am Aurra, an intelligent AI humanoid receptionist. How may I assist you today?'
                    : 'Chat and telemetry reset. Ready for next test.',
                  timestamp: Date.now(),
                  source: 'system'
                }
              ]);
              if (uiMode === 'developer') {
                setLogs([]);
                addLog('SYSTEM', 'Cleared chat history and diagnostic logs');
              }
            }}
            title="Reset Chat & Telemetry"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* ── Master Feature Isolation Switchboard (Visible only in Developer Mode) ── */}
      {uiMode === 'developer' && (
        <section className="tia-switchboard-card">
          <div className="tia-switchboard-title">
            <Sliders size={16} color="#00ffff" />
            <span>FEATURE MODULE ISOLATION SWITCHES (Toggle on/off to isolate bugs)</span>
          </div>

          <div className="tia-switches-grid">
            {/* Switch 1: Chat Engine */}
            <div className={`tia-switch-item ${enableChat ? 'active' : ''}`} onClick={() => setEnableChat(!enableChat)}>
              <div className="tia-switch-info">
                <MessageSquare size={18} color={enableChat ? '#00ffff' : '#64748b'} />
                <div>
                  <strong>Text Chat & LLM</strong>
                  <p>Intent matching & Groq API</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${enableChat ? 'on' : 'off'}`}>{enableChat ? 'ON' : 'OFF'}</span>
            </div>

            {/* Switch 2: TTS Audio */}
            <div className={`tia-switch-item ${enableTts ? 'active' : ''}`} onClick={() => setEnableTts(!enableTts)}>
              <div className="tia-switch-info">
                {enableTts ? <Volume2 size={18} color="#10b981" /> : <VolumeX size={18} color="#64748b" />}
                <div>
                  <strong>TTS Speech Audio</strong>
                  <p>Voice playback answers</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${enableTts ? 'on' : 'off'}`}>{enableTts ? 'ON' : 'OFF'}</span>
            </div>

            {/* Switch 3: STT Microphone */}
            <div className={`tia-switch-item ${enableStt ? 'active' : ''}`} onClick={() => handleToggleStt(!enableStt)}>
              <div className="tia-switch-info">
                {enableStt ? <Mic size={18} color="#f59e0b" /> : <MicOff size={18} color="#64748b" />}
                <div>
                  <strong>Speech Input (STT)</strong>
                  <p>Live microphone recognizer</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${enableStt ? 'on' : 'off'}`}>{enableStt ? 'ON' : 'OFF'}</span>
            </div>

            {/* Switch 4: Camera & Vision */}
            <div className={`tia-switch-item ${enableVision ? 'active' : ''}`} onClick={() => setEnableVision(!enableVision)}>
              <div className="tia-switch-info">
                {enableVision ? <Video size={18} color="#c084fc" /> : <VideoOff size={18} color="#64748b" />}
                <div>
                  <strong>Camera & Vision</strong>
                  <p>Face detection neural net</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${enableVision ? 'on' : 'off'}`}>{enableVision ? 'ON' : 'OFF'}</span>
            </div>

            {/* Switch 5: Hardware & ESP32 */}
            <div className={`tia-switch-item ${enableHardware ? 'active' : ''}`} onClick={() => setEnableHardware(!enableHardware)}>
              <div className="tia-switch-info">
                <Cpu size={18} color={enableHardware ? '#38bdf8' : '#64748b'} />
                <div>
                  <strong>ESP32 Hardware</strong>
                  <p>Robot servo tilt & Wi-Fi</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${enableHardware ? 'on' : 'off'}`}>{enableHardware ? 'ON' : 'OFF'}</span>
            </div>

            {/* Switch 6: Voice Interaction Architecture Style */}
            <div
              className={`tia-switch-item ${voiceInteractionStyle === 'phone-call' ? 'active' : ''}`}
              onClick={() => handleVoiceStyleToggle(voiceInteractionStyle === 'phone-call' ? 'walkie-talkie' : 'phone-call')}
              title="Toggle between Walkie-Talkie (750ms buffer) and Phone Call (LiveKit Full-Duplex)"
              style={{ cursor: 'pointer' }}
            >
              <div className="tia-switch-info">
                <Activity size={18} color={voiceInteractionStyle === 'phone-call' ? '#10b981' : '#00ffff'} />
                <div>
                  <strong>{voiceInteractionStyle === 'phone-call' ? 'Phone Call Style' : 'Walkie-Talkie'}</strong>
                  <p>{voiceInteractionStyle === 'phone-call' ? 'LiveKit Full-Duplex' : '750ms Patience Buffer'}</p>
                </div>
              </div>
              <span className={`tia-toggle-pill ${voiceInteractionStyle === 'phone-call' ? 'on' : 'off'}`} style={{ fontSize: '10px' }}>
                {voiceInteractionStyle === 'phone-call' ? 'LIVEKIT' : 'BUFFER'}
              </span>
            </div>
          </div>
        </section>
      )}

      {/* ── WORKSPACE VIEW: CUSTOMER KIOSK VIEW vs DEVELOPER DIAGNOSTIC LAB ── */}
      {uiMode === 'customer' ? (
        <div className="tia-customer-workspace">
          <div className="tia-customer-chat-card">
            {/* Customer Header Bar inside Card */}
            <div className="tia-customer-card-header">
              <div className="tia-customer-avatar-col">
                <div className={`tia-customer-avatar ${isTtsPlaying ? 'speaking' : isSttListening ? 'listening' : ''}`}>
                  <Sparkles size={22} color="#00ffff" />
                </div>
                <div>
                  <h3>Aurra Humanoid Receptionist</h3>
                  <div className="tia-customer-status-line">
                    <span className={`tia-status-dot ${isTtsPlaying ? 'speaking' : isProcessing ? 'thinking' : isSttListening ? 'listening' : 'ready'}`} />
                    <span>
                      {isTtsPlaying
                        ? 'Aurra is speaking...'
                        : isProcessing
                        ? 'Aurra is thinking...'
                        : isSttListening
                        ? 'Listening to your voice... (Speak freely)'
                        : 'Ready to assist'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Controls shortcut for customer kiosk */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {enableVision && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      background: 'rgba(192, 132, 252, 0.15)',
                      border: '1px solid rgba(192, 132, 252, 0.35)',
                      color: '#c084fc',
                      fontSize: '11px',
                      fontWeight: 700
                    }}
                    title="Camera Vision & VIP Face Greeting active in background"
                  >
                    <Video size={13} />
                    <span>VIP Vision Active</span>
                  </span>
                )}
                <button
                  type="button"
                  className={`tia-customer-mic-pill ${enableStt ? 'active' : ''}`}
                  onClick={() => handleToggleStt(!enableStt)}
                  title={enableStt ? 'Mute Microphone' : 'Enable Microphone'}
                >
                  {enableStt ? <Mic size={15} /> : <MicOff size={15} />}
                  <span>{enableStt ? (isSttListening ? 'Mic Live' : 'Mic Active') : 'Mic Off'}</span>
                </button>
              </div>
            </div>

            {/* Background Video Capture: Keeps Face Recognition & VIP Greeting active in Customer Mode if Vision is Enabled */}
            {enableVision && (
              <div style={{ position: 'fixed', width: 1, height: 1, opacity: 0.001, pointerEvents: 'none', zIndex: -100, overflow: 'hidden' }}>
                <video ref={videoRef} autoPlay playsInline muted width={640} height={480} />
                <canvas ref={canvasRef} width={640} height={480} />
              </div>
            )}

            {/* Live speech transcription ticker if speaking */}
            {enableStt && (sttInterim || sttFinal) && (
              <div className="tia-customer-transcription-ticker">
                <span className="ticker-label">Listening:</span>
                <span className="ticker-text">"{sttInterim || sttFinal}"</span>
              </div>
            )}

            {/* Conversation Messages Stream (Only Text Output & Input Visible) */}
            <div ref={chatScrollRef} className="tia-customer-messages-list">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`tia-message-row ${isUser ? 'user-side' : 'assistant-side'}`}>
                    <div className="tia-message-bubble customer-bubble">
                      <div className="tia-bubble-meta">
                        <span className="tia-bubble-sender">{isUser ? 'You' : 'Aurra'}</span>
                      </div>
                      <p className="tia-bubble-text">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              {isProcessing && (
                <div className="tia-message-row assistant-side">
                  <div className="tia-message-bubble customer-bubble thinking">
                    <Sparkles size={16} className="pulse-icon" />
                    <span>Thinking and preparing response...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Inquiries for Visitors */}
            <div className="tia-customer-chips-bar">
              <span className="chips-label">Quick Inquiries:</span>
              <div className="chips-scroll">
                <button type="button" onClick={() => handleExecuteQuery('Who are you?', 'text')}>"Who are you?"</button>
                <button type="button" onClick={() => handleExecuteQuery('Where is Robomiracle located?', 'text')}>"Where is Robomiracle located?"</button>
                <button type="button" onClick={() => handleExecuteQuery('What are your main features?', 'text')}>"What can you do?"</button>
                <button type="button" onClick={() => handleExecuteQuery('What is the current time?', 'text')}>"What time is it?"</button>
              </div>
            </div>

            {/* Customer Input Dock (Clean Text Input + Mic + Send) */}
            <form
              className="tia-customer-input-dock"
              onSubmit={(e) => {
                e.preventDefault();
                if (inputText.trim()) {
                  const q = inputText.trim();
                  setInputText('');
                  handleExecuteQuery(q, 'text');
                }
              }}
            >
              <button
                type="button"
                className={`tia-customer-mic-btn ${enableStt ? 'active' : ''}`}
                onClick={() => handleToggleStt(!enableStt)}
                title={enableStt ? 'Mute Microphone' : 'Turn on Microphone'}
              >
                {enableStt ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              <input
                type="text"
                className="tia-customer-text-input"
                placeholder={enableStt ? "Ask Aurra anything (or speak into microphone)..." : "Type your question here..."}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isProcessing}
              />

              <button
                type="submit"
                className="tia-customer-send-btn"
                disabled={!inputText.trim() || isProcessing}
              >
                <Send size={18} />
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ── DEVELOPER MODE: Full Diagnostic Split Workspace ── */
        <div className="tia-workspace-grid">
        {/* LEFT COLUMN: Interactive Chat & Test Controls */}
        <div className="tia-left-panel">
          {/* Subsystem Quick Nav Tabs & Model Switcher */}
          <div className="tia-nav-row">
            <div className="tia-tab-bar">
              <button className={`tia-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => handleTabClick('all')}>
                All-In-One Arena
              </button>
              <button className={`tia-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => handleTabClick('chat')}>
                Text & LLM
              </button>
              <button className={`tia-tab ${activeTab === 'tts' ? 'active' : ''}`} onClick={() => handleTabClick('tts')}>
                Audio TTS
              </button>
              <button className={`tia-tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => handleTabClick('voice')}>
                Mic STT
              </button>
              <button className={`tia-tab ${activeTab === 'vision' ? 'active' : ''}`} onClick={() => handleTabClick('vision')}>
                Vision PiP
              </button>
              <button className={`tia-tab ${activeTab === 'hardware' ? 'active' : ''}`} onClick={() => handleTabClick('hardware')}>
                Hardware
              </button>
            </div>

            <div className="tia-model-selector-bar">
              {/* Brain Provider Toggle Chips */}
              <div style={{ display: 'flex', gap: '4px', marginRight: '6px' }}>
                <button
                  type="button"
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '5px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: brainProvider === 'groq' ? '#0284c7' : 'rgba(30, 41, 59, 0.7)',
                    color: brainProvider === 'groq' ? '#fff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleBrainProviderToggle('groq')}
                >
                  ⚡ Groq
                </button>
                <button
                  type="button"
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    borderRadius: '5px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: brainProvider === 'gemini' ? '#8b5cf6' : 'rgba(30, 41, 59, 0.7)',
                    color: brainProvider === 'gemini' ? '#fff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleBrainProviderToggle('gemini')}
                >
                  🧠 Gemini
                </button>
              </div>

              <Sparkles size={13} color="#c084fc" />
              <span className="tia-model-label">Model:</span>
              <select
                className="tia-model-dropdown"
                value={selectedLlmModel}
                onChange={(e) => handleModelChange(e.target.value)}
                title="Active Cloud LLM Model"
              >
                {brainProvider === 'gemini' ? (
                  <>
                    <option value="gemini-1.5-flash">gemini-1.5-flash (Fast & Multilingual)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Next-Gen Fast)</option>
                    <option value="gemini-flash-latest">gemini-flash-latest (Latest Flash)</option>
                  </>
                ) : (
                  <>
                    <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Fast 27B)</option>
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (70B)</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Sub-200ms)</option>
                  </>
                )}
              </select>
              <button
                type="button"
                className={`tia-prompt-toggle-btn ${showSystemPrompt ? 'active' : ''}`}
                onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                title="View & Edit System Prompt (Spec Sheet Knowledge)"
              >
                <Sliders size={12} />
                <span>Spec Prompt</span>
              </button>
            </div>
          </div>

          {/* 0. AURRA SPEC SHEET SYSTEM PROMPT INSPECTOR (When Prompt toggled or Text & LLM tab active) */}
          {(showSystemPrompt || activeTab === 'chat') && (
            <div className="tia-prompt-card">
              <div className="tia-prompt-header">
                <div className="tia-prompt-title">
                  <Sparkles size={14} color="#00ffff" />
                  <strong>AURRA SPEC SHEET SYSTEM PROMPT (LIVE LLM KNOWLEDGE)</strong>
                </div>
                <div className="tia-prompt-badge">
                  <span>Robomiracle Coimbatore Baseline</span>
                </div>
              </div>
              <p className="tia-prompt-desc">
                Injected into Cloud AI ({selectedLlmModel}): provides full specs on 25.9V battery, 12" Waveshare display, 5 DOF motors, casters, and Robomiracle identity:
              </p>
              <textarea
                className="tia-prompt-textarea"
                rows={4}
                value={systemPromptText}
                onChange={(e) => setSystemPromptText(e.target.value)}
                placeholder="Enter system prompt for Aurra..."
              />
              <div className="tia-prompt-actions">
                <div className="tia-prompt-btns">
                  <button
                    type="button"
                    className="tia-btn-sm primary"
                    onClick={() => handleSaveSystemPrompt(systemPromptText)}
                  >
                    <Check size={13} />
                    <span>Save to LLM</span>
                  </button>
                  <button
                    type="button"
                    className="tia-btn-sm secondary"
                    style={{ color: '#00ffff', borderColor: 'rgba(0,255,255,0.3)' }}
                    onClick={handleSyncSystemPromptWithKnowledge}
                    title="Auto-merge live campus facilities and robot tours into prompt"
                  >
                    <RefreshCw size={13} />
                    <span>Sync Facilities & Tours</span>
                  </button>
                  <button
                    type="button"
                    className="tia-btn-sm secondary"
                    onClick={handleResetSystemPrompt}
                  >
                    <RotateCcw size={13} />
                    <span>Reset to Spec Sheet Baseline</span>
                  </button>
                </div>
                {promptSavedNotice && (
                  <span className="tia-prompt-notice">✓ System Prompt Updated!</span>
                )}
              </div>
            </div>
          )}

          {/* 1. VISION MONITOR (Visible when Vision is ON or tab active) */}
          {(enableVision || activeTab === 'vision') && (
            <div className="tia-vision-box">
              <div className="tia-vision-header">
                <div className="tia-vision-title">
                  <Video size={14} color="#c084fc" />
                  <span>CAMERA STREAM & FACE INFERENCE</span>
                </div>
                <div className="tia-vision-stats">
                  <span>Faces: <strong>{detectedFaces.length}</strong></span>
                  <span>VIPs: <strong>{enrolledFaces.length}</strong></span>
                  <span>Inference: <strong>{visionInferenceMs}ms</strong></span>
                  <select
                    className="tia-interval-select"
                    value={visionIntervalMs}
                    onChange={(e) => setVisionIntervalMs(Number(e.target.value))}
                    title="Detection Interval"
                  >
                    <option value={800}>800ms (Fast)</option>
                    <option value={1500}>1500ms (Balanced)</option>
                    <option value={3000}>3000ms (Low CPU)</option>
                  </select>
                  <select
                    className="tia-interval-select"
                    style={{ borderColor: 'rgba(192, 132, 252, 0.4)', color: '#c084fc' }}
                    value={greetingCooldownSec}
                    onChange={(e) => setGreetingCooldownSec(Number(e.target.value))}
                    title="Greeting Buffer Cooldown Time"
                  >
                    <option value={15}>Buffer: 15s</option>
                    <option value={30}>Buffer: 30s</option>
                    <option value={45}>Buffer: 45s</option>
                    <option value={60}>Buffer: 60s</option>
                    <option value={90}>Buffer: 90s</option>
                  </select>
                </div>
              </div>
              <div className="tia-video-viewport">
                <video ref={videoRef} autoPlay playsInline muted className="tia-video-feed" />
                <canvas ref={canvasRef} className="tia-canvas-overlay" />
                {!isStreaming && (
                  <div className="tia-video-placeholder">
                    <span>Camera Hardware is Stopped</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. TTS STANDALONE CONTROLLER (When TTS tab active) */}
          {activeTab === 'tts' && (
            <div className="tia-tts-card">
              <h4>Audio Text-to-Speech Inspector</h4>
              <textarea
                className="tia-tts-input"
                rows={2}
                value={ttsTestText}
                onChange={(e) => setTtsTestText(e.target.value)}
                placeholder="Enter text to synthesize into speech..."
              />
              <div className="tia-tts-controls-row">
                <div className="tia-tts-speed-slider">
                  <span>Speed: {ttsSpeed}x</span>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={ttsSpeed}
                    onChange={(e) => setTtsSpeed(Number(e.target.value))}
                  />
                </div>
                <div className="tia-tts-buttons">
                  <button className="tia-btn-primary" onClick={handleTestTts} disabled={isTtsPlaying}>
                    <Play size={14} />
                    <span>{isTtsPlaying ? 'Speaking...' : 'Play Audio'}</span>
                  </button>
                  <button className="tia-btn-danger" onClick={handleStopTts} disabled={!isTtsPlaying}>
                    <VolumeX size={14} />
                    <span>Stop</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. STT MIC LIVE STATUS (When Voice tab active or STT enabled) */}
          {(enableStt || activeTab === 'voice') && (
            <div className="tia-stt-status-card">
              <div className="tia-stt-header">
                <div className="tia-stt-indicator">
                  <span className={`tia-mic-dot ${isSttListening ? 'listening' : 'muted'}`} />
                  <strong>{isSttListening ? 'MICROPHONE ACTIVE (LISTENING)' : 'MICROPHONE MUTED'}</strong>
                </div>
                <button
                  className={`tia-mic-toggle-btn ${enableStt ? 'active' : ''}`}
                  onClick={() => handleToggleStt(!enableStt)}
                >
                  {enableStt ? <Mic size={14} /> : <MicOff size={14} />}
                  <span>{enableStt ? 'Mute Mic' : 'Start Mic'}</span>
                </button>
              </div>
              <div className="tia-transcript-preview">
                <span className="tia-transcript-label">Live Transcription:</span>
                <p className="tia-transcript-text">
                  {sttInterim ? (
                    <span className="interim">"{sttInterim}..."</span>
                  ) : sttFinal ? (
                    <span className="final">"{sttFinal}"</span>
                  ) : (
                    <span className="idle">Speak into your tablet microphone to test transcription...</span>
                  )}
                </p>
                {sttError && <p className="tia-stt-error">Error: {sttError}</p>}
              </div>
            </div>
          )}

          {/* 4. HARDWARE SERVOS CONTROLLER (When Hardware tab active) */}
          {activeTab === 'hardware' && (
            <div className="tia-hw-card">
              <div className="tia-hw-header">
                <h4>ESP32 Animatronics & Head Servo</h4>
                <span className={`tia-status-pill ${espOnline ? 'online' : 'offline'}`}>
                  {espOnline ? '🟢 ESP32 CONNECTED' : '🔴 ESP32 OFFLINE (SIM)'}
                </span>
              </div>
              <div className="tia-hw-slider-row">
                <span>Head Tilt: <strong>{headTilt}°</strong></span>
                <input
                  type="range"
                  min="50"
                  max="130"
                  value={headTilt}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setHeadTilt(val);
                    esp32Service.setHeadTilt(val);
                  }}
                />
                <button className="tia-btn-sm" onClick={() => { setHeadTilt(90); esp32Service.setHeadTilt(90); }}>
                  Center (90°)
                </button>
              </div>
            </div>
          )}

          {/* 5. MESSAGES SCROLL AREA */}
          <div className="tia-chat-container">
            <div ref={chatScrollRef} className="tia-messages-list">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} className={`tia-message-row ${isUser ? 'user-side' : 'assistant-side'}`}>
                    <div className="tia-message-bubble">
                      <div className="tia-bubble-meta">
                        <span className="tia-bubble-sender">{isUser ? 'User' : 'Aurra AI'}</span>
                        {msg.source && (
                          <span className={`tia-source-tag ${msg.source}`}>
                            {msg.source === 'offline-faq'
                              ? 'CUSTOMIZED FAQ'
                              : msg.source === 'local-clock'
                              ? 'LOCAL CLOCK (0ms)'
                              : msg.source === 'face-greeting'
                              ? 'FACE RECOGNITION GREETING'
                              : msg.llmInfo?.ragDetails
                              ? `CLOUD LLM + ${msg.llmInfo.ragDetails.source.toUpperCase()} RAG`
                              : msg.source === 'groq-llm'
                              ? 'CLOUD LLM'
                              : msg.source.toUpperCase()}
                          </span>
                        )}
                        {msg.latencyMs !== undefined && (
                          <span className="tia-latency-tag">⚡ {msg.latencyMs}ms</span>
                        )}
                      </div>
                      
                      <p className="tia-bubble-text">{msg.text}</p>

                      {/* Diagnostic Source Inspector Box */}
                      {!isUser && msg.source === 'face-greeting' && (
                        <div className="tia-source-card vision-card" style={{ borderLeftColor: '#c084fc' }}>
                          <div className="source-card-header">
                            <Sparkles size={13} color="#c084fc" />
                            <strong>SOURCE: BIOMETRIC FACE GREETING</strong>
                          </div>
                          <div className="source-card-body">
                            <div className="source-meta-row">
                              <span className="meta-key">Detected Person:</span>
                              <span className="meta-val highlight" style={{ color: '#c084fc' }}>
                                {msg.matchedPerson || 'Visitor'}
                              </span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">Profile:</span>
                              <span className="meta-val">{msg.matchedPerson && msg.matchedPerson !== 'Guest' ? 'Enrolled VIP' : 'Visitor (Guest)'}</span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">Buffer Cooldown:</span>
                              <span className="meta-val speed">{greetingCooldownSec}s</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isUser && msg.source === 'local-clock' && (
                        <div className="tia-source-card clock-card" style={{ borderLeftColor: '#38bdf8' }}>
                          <div className="source-card-header">
                            <Clock size={13} color="#38bdf8" />
                            <strong>SOURCE: HARDWARE SYSTEM CLOCK (0ms LATENCY)</strong>
                          </div>
                          <div className="source-card-body">
                            <div className="source-meta-row">
                              <span className="meta-key">Location:</span>
                              <span className="meta-val highlight" style={{ color: '#38bdf8' }}>Coimbatore, Tamil Nadu (IST)</span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">Resolution:</span>
                              <span className="meta-val speed">Instant (0ms Local RTC)</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isUser && msg.source === 'offline-faq' && msg.matchedFaq && (
                        <div className="tia-source-card faq-card">
                          <div className="source-card-header">
                            <CheckCircle2 size={13} color="#10b981" />
                            <strong>SOURCE: CUSTOMIZED ANSWER (OFFLINE FAQ)</strong>
                          </div>
                          <div className="source-card-body">
                            <div className="source-meta-row">
                              <span className="meta-key">Matched Question:</span>
                              <span className="meta-val highlight">"{msg.matchedFaq.question}"</span>
                            </div>
                            <div className="source-meta-row">
                              <span className="meta-key">Category:</span>
                              <span className="meta-val">{msg.matchedFaq.category}</span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">Match Score:</span>
                              <span className="meta-val score">{msg.matchedFaq.confidence}%</span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">DB Lookup:</span>
                              <span className="meta-val speed">{msg.matchedFaq.qaLatencyMs}ms</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {!isUser && msg.source === 'groq-llm' && msg.llmInfo && (
                        <div className="tia-source-card llm-card">
                          <div className="source-card-header">
                            <Sparkles size={13} color="#c084fc" />
                            <strong>SOURCE: CLOUD LLM (GROQ API)</strong>
                          </div>
                          <div className="source-card-body">
                            <div className="source-meta-row">
                              <span className="meta-key">AI Model:</span>
                              <span className="meta-val highlight-purple">{msg.llmInfo.model}</span>
                            </div>
                            <div className="source-meta-row">
                              <span className="meta-key">Provider:</span>
                              <span className="meta-val">{msg.llmInfo.provider}</span>
                              <span className="meta-divider">•</span>
                              <span className="meta-key">API Latency:</span>
                              <span className="meta-val speed">{msg.llmInfo.latencyMs}ms</span>
                              {msg.llmInfo.tokens && (
                                <>
                                  <span className="meta-divider">•</span>
                                  <span className="meta-key">Tokens:</span>
                                  <span className="meta-val">{msg.llmInfo.tokens}</span>
                                </>
                              )}
                            </div>
                            {msg.llmInfo.ragDetails && (
                              <div className="source-meta-row" style={{ marginTop: '5px', borderTop: '1px dashed rgba(192, 132, 252, 0.3)', paddingTop: '4px' }}>
                                <span className="meta-key">Live RAG Engine:</span>
                                <span className="meta-val" style={{ color: '#00ffff' }}>
                                  {msg.llmInfo.ragDetails.source === 'open-meteo' ? 'Open-Meteo Live Weather' : 'Google Serper Live Search'}
                                </span>
                                <span className="meta-divider">•</span>
                                <span className="meta-key">Ground Truth:</span>
                                <span className="meta-val">{msg.llmInfo.ragDetails.summary || 'Live Web Data'}</span>
                                <span className="meta-divider">•</span>
                                <span className="meta-key">RAG Latency:</span>
                                <span className="meta-val speed">{msg.llmInfo.ragDetails.latencyMs}ms</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {!isUser && msg.source === 'fallback' && (
                        <div className="tia-source-card fallback-card">
                          <div className="source-card-header">
                            <AlertCircle size={13} color="#f59e0b" />
                            <strong>SOURCE: FALLBACK (NO MATCH)</strong>
                          </div>
                          <div className="source-card-body">
                            <p className="fallback-note">
                              Not in Customized FAQ (&lt; 65% match).
                              {msg.fallbackInfo?.llmError ? ` Cloud LLM failed: ${msg.fallbackInfo.llmError}` : ' Cloud LLM produced no answer.'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isProcessing && (
                <div className="tia-message-row assistant-side">
                  <div className="tia-message-bubble thinking">
                    <Sparkles size={14} className="pulse-icon" />
                    <span>Processing query & generating response...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input Dock */}
            <form
              className="tia-input-dock"
              onSubmit={(e) => {
                e.preventDefault();
                if (inputText.trim()) {
                  const q = inputText.trim();
                  setInputText('');
                  handleExecuteQuery(q, 'text');
                }
              }}
            >
              <input
                type="text"
                className="tia-text-input"
                placeholder={enableChat ? "Type question to test latency & answer..." : "Chat engine is toggled OFF above"}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={!enableChat || isProcessing}
              />
              <button
                type="submit"
                className="tia-send-btn"
                disabled={!enableChat || !inputText.trim() || isProcessing}
              >
                <Send size={16} />
                <span>Submit</span>
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Diagnostic Execution Log Terminal */}
        <div className="tia-right-panel">
          <div className="tia-logs-header">
            <div className="tia-logs-title">
              <Terminal size={16} color="#00ffff" />
              <span>LIVE SYSTEM DIAGNOSTIC TELEMETRY</span>
            </div>
            <div className="tia-logs-actions">
              <button
                className="tia-log-btn"
                onClick={() => {
                  const txt = logs.map((l) => `[${l.timeStr}] [${l.source}] ${l.message}`).join('\n');
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard.writeText(txt).catch(() => {});
                  }
                  setCopiedNotice(true);
                  setTimeout(() => setCopiedNotice(false), 2200);
                  addLog('DIAGNOSTICS', `Copied ${logs.length} telemetry entries to clipboard`, 'success');
                }}
                title="Copy Terminal Logs"
              >
                {copiedNotice ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                <span>{copiedNotice ? 'Copied!' : 'Copy'}</span>
              </button>
              <button className="tia-log-btn" onClick={() => setLogs([])} title="Clear Terminal Logs">
                <Trash2 size={13} />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div ref={logContainerRef} className="tia-terminal-stream">
            {logs.length === 0 ? (
              <div className="tia-terminal-empty">
                <span>Diagnostic event bus ready. Test features on the left to inspect logs in real time.</span>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className={`tia-log-line ${log.type}`}>
                  <span className="log-time">{log.timeStr}</span>
                  <span className={`log-source ${log.source.toLowerCase()}`}>[{log.source}]</span>
                  <span className="log-msg">{log.message}</span>
                  {log.latency !== null && (
                    <span className="log-latency">+{log.latency}ms</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="tia-quick-prompts">
            <span className="tia-quick-label">Real-Time & Spec Quick Queries:</span>
            <div className="tia-chips-row">
              <button type="button" onClick={() => handleExecuteQuery('What is the current time?', 'text')}>"Current Time (0ms)"</button>
              <button type="button" onClick={() => handleExecuteQuery('What is the weather in Coimbatore today?', 'text')}>"Coimbatore Weather"</button>
              <button type="button" onClick={() => handleExecuteQuery('Who is the Chief Minister of Tamil Nadu?', 'text')}>"CM of Tamil Nadu (Google Search)"</button>
              <button type="button" onClick={() => handleExecuteQuery('Who created you and where are you from?', 'text')}>"Who created you?"</button>
              <button type="button" onClick={() => handleExecuteQuery('What battery and charger specifications do you use?', 'text')}>"Battery Specs"</button>
              <button type="button" onClick={() => handleExecuteQuery('Robot tilt head up', 'text')}>"Head Up"</button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
