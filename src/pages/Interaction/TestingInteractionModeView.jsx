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
import { speakWithVoice, cancelSpeech, isAnySpeaking } from '../../utils/speechSynthesis';
import { elevenLabsService, DEFAULT_ELEVENLABS_VOICES } from '../../services/elevenLabsService';
import { useCamera } from '../../hooks/useCamera';
import { detectFacesInVideo, loadFaceApiModels } from '../../utils/faceApiHelper';
import { kioskConfigService } from '../../services/kioskConfigService';
import './TestingInteractionModeView.css';

export default function TestingInteractionModeView({ onNavigate }) {
  // ── Active Test Module Tab ──
  // 'all' | 'chat' | 'voice' | 'tts' | 'vision' | 'hardware'
  const [activeTab, setActiveTab] = useState('all');

  // ── Master Feature Switches (Isolate features one-by-one) ──
  const [enableChat, setEnableChat] = useState(true);
  const [enableTts, setEnableTts] = useState(true);
  const [enableStt, setEnableStt] = useState(false); // Default OFF for clean isolated testing
  const [enableVision, setEnableVision] = useState(false); // Default OFF for clean isolated testing
  const [enableHardware, setEnableHardware] = useState(false); // Default OFF for clean isolated testing

  // ── Chat State ──
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Diagnostic Mode Active. Aurra is loaded with official hardware & software specifications from Robomiracle Technologies (Coimbatore).',
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
  const [visionInferenceMs, setVisionInferenceMs] = useState(0);
  const [visionIntervalMs, setVisionIntervalMs] = useState(1500);
  const canvasRef = useRef(null);
  const detectionLoopRef = useRef(null);
  const isDetectingRef = useRef(false);

  // ── Hardware State ──
  const [espOnline, setEspOnline] = useState(false);
  const [servoAngles, setServoAngles] = useState([90, 90, 90, 90, 90]);
  const [headTilt, setHeadTilt] = useState(90);

  // ── Live Logs Terminal ──
  const [logs, setLogs] = useState([]);
  const logContainerRef = useRef(null);
  const chatScrollRef = useRef(null);
  const fpsTextRef = useRef(null);

  // Append timestamped log entry
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
    setLogs((prev) => [...prev.slice(-150), newEntry]);
    console.log(`[TEST-LAB ${timeStr}] [${source}] ${message}${latency !== null ? ` (${latency}ms)` : ''}`);
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

  // Face Detection Loop
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

      const detections = await detectFacesInVideo(video, 'tinyFace', {
        withDescriptors: false,
        inputSize: 224
      });

      const inferenceMs = Math.round(performance.now() - t0);
      setVisionInferenceMs(inferenceMs);
      setDetectedFaces(detections || []);

      if (detections && detections.length > 0) {
        addLog('VISION', `Detected ${detections.length} face(s)`, 'timing', inferenceMs);
        for (const det of detections) {
          const box = det.detection ? det.detection.box : det.box || det;
          if (box) {
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
            ctx.fillRect(box.x, Math.max(0, box.y - 20), Math.max(90, box.width), 20);
            ctx.fillStyle = '#031127';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(`FACE (${inferenceMs}ms)`, box.x + 4, Math.max(14, box.y - 6));
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

  // ── SPEECH RECOGNITION (STT) LIFECYCLE ──
  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      addLog('STT', 'SpeechRecognition API not available in this WebView', 'error');
      return;
    }

    if (enableStt) {
      addLog('STT', 'Starting microphone speech listener...');
      try {
        const rec = new SpeechRec();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsSttListening(true);
          setSttError('');
          addLog('STT', 'Microphone active - listening for voice', 'success');
        };

        rec.onresult = (event) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const item = event.results[i];
            if (item.isFinal) final += item[0].transcript;
            else interim += item[0].transcript;
          }
          if (interim) setSttInterim(interim);
          if (final) {
            setSttFinal(final);
            setSttInterim('');
            addLog('STT', `Heard final utterance: "${final.trim()}"`, 'timing');
            if (enableChat) {
              handleExecuteQuery(final.trim(), 'voice');
            }
          }
        };

        rec.onerror = (e) => {
          if (e.error !== 'no-speech') {
            setSttError(e.error);
            addLog('STT', `Recognition error: ${e.error}`, 'warn');
          }
        };

        rec.onend = () => {
          setIsSttListening(false);
          addLog('STT', 'Recognition session ended', 'info');
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        setSttError(err.message);
        addLog('STT', `Failed to start STT: ${err.message}`, 'error');
      }
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
      setIsSttListening(false);
      setSttInterim('');
      addLog('STT', 'Microphone STOPPED & muted', 'warn');
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [enableStt, enableChat, addLog]);

  // ── HARDWARE STATUS CHECK ──
  const checkHardwareStatus = useCallback(async () => {
    const t0 = performance.now();
    try {
      const isOnline = await esp32Service.checkConnection();
      const latency = Math.round(performance.now() - t0);
      setEspOnline(Boolean(isOnline));
      addLog('HARDWARE', `ESP32 connection check: ${isOnline ? 'ONLINE' : 'OFFLINE'}`, isOnline ? 'success' : 'warn', latency);
    } catch (err) {
      setEspOnline(false);
      addLog('HARDWARE', `ESP32 check error: ${err.message}`, 'error');
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
    if (!query || isProcessing) return;

    setIsProcessing(true);
    const overallT0 = performance.now();

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
      if (enableHardware) {
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
      if (enableTts && replyText) {
        addLog('TTS', `Triggering audio speech playback...`);
        playTtsAudio(replyText);
      }
    } catch (err) {
      addLog('PIPELINE', `Critical pipeline error: ${err.message}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

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

    setIsTtsPlaying(true);

    if (ttsEngine === 'elevenlabs' && elevenLabsService.isConfigured()) {
      const activeVoice = elevenLabsService.getActiveVoiceId();
      addLog('TTS', `[ElevenLabs] Synthesizing speech with voice [${activeVoice}]...`, 'info');
      const t0 = performance.now();
      const res = await elevenLabsService.speak(cleanText, {
        onStart: () => addLog('TTS', `[ElevenLabs] Audio streaming & playback active`, 'success'),
        onEnd: () => {
          setIsTtsPlaying(false);
          addLog('TTS', `[ElevenLabs] Audio playback finished (API took ${res?.latencyMs || 0}ms)`, 'timing', res?.latencyMs);
        },
        onError: (err) => {
          setIsTtsPlaying(false);
          addLog('TTS', `[ElevenLabs] Playback error: ${err.message || err}. Falling back to Browser TTS...`, 'warn');
          speakWithVoice(cleanText, {
            voiceURI: selectedBrowserVoice,
            rate: ttsSpeed,
            pitch: ttsPitch,
            gender: 'female',
            onEnd: () => setIsTtsPlaying(false),
          });
        },
      });

      if (!res.success) {
        setIsTtsPlaying(false);
        addLog('TTS', `[ElevenLabs] Synthesis failed: ${res.error}. Speaking via Browser TTS...`, 'warn');
        speakWithVoice(cleanText, {
          voiceURI: selectedBrowserVoice,
          rate: ttsSpeed,
          pitch: ttsPitch,
          gender: 'female',
          onEnd: () => setIsTtsPlaying(false),
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
        onStart: () => addLog('TTS', `[Browser TTS] Audio speech output started (+${Math.round(performance.now() - t0)}ms)`, 'timing'),
        onEnd: () => {
          setIsTtsPlaying(false);
          addLog('TTS', `[Browser TTS] Speech completed in ${Math.round(performance.now() - t0)}ms`, 'success');
        },
        onError: (err) => {
          setIsTtsPlaying(false);
          addLog('TTS', `[Browser TTS] Speech error: ${err}`, 'error');
        },
      });
    }
  }, [ttsEngine, selectedBrowserVoice, ttsSpeed, ttsPitch, addLog]);

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
    addLog('TTS', 'Speech synthesis audio STOPPED by user', 'warn');
  };

  return (
    <div className="tia-root">
      {/* ── Top Diagnostic Header ── */}
      <header className="tia-header">
        <div className="tia-header-left">
          <button className="tia-back-btn" onClick={() => onNavigate('/')} title="Return to Main Menu">
            <ArrowLeft size={18} />
            <span>Back to Home</span>
          </button>
          <div className="tia-title-group">
            <div className="tia-badge">
              <FlaskConical size={14} color="#f59e0b" />
              <span>TESTING & DIAGNOSTIC LAB</span>
            </div>
            <h1>Interactive Mode Feature Isolator</h1>
          </div>
        </div>

        <div className="tia-header-right">
          <div className="tia-telemetry-pill">
            <span className="tia-fps-dot" />
            <strong ref={fpsTextRef}>60 FPS</strong>
          </div>
          <button
            className="tia-btn-icon"
            onClick={() => {
              setMessages([
                {
                  id: Date.now(),
                  role: 'assistant',
                  text: 'Chat and telemetry reset. Ready for next test.',
                  timestamp: Date.now(),
                  source: 'system'
                }
              ]);
              setLogs([]);
              addLog('SYSTEM', 'Cleared chat history and diagnostic logs');
            }}
            title="Reset Chat & Logs"
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      {/* ── Master Feature Isolation Switchboard ── */}
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
          <div className={`tia-switch-item ${enableStt ? 'active' : ''}`} onClick={() => setEnableStt(!enableStt)}>
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
        </div>
      </section>

      {/* ── Main Testing Split Workspace ── */}
      <div className="tia-workspace-grid">
        {/* LEFT COLUMN: Interactive Chat & Test Controls */}
        <div className="tia-left-panel">
          {/* Subsystem Quick Nav Tabs & Model Switcher */}
          <div className="tia-nav-row">
            <div className="tia-tab-bar">
              <button className={`tia-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
                All-In-One Arena
              </button>
              <button className={`tia-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
                Text & LLM
              </button>
              <button className={`tia-tab ${activeTab === 'tts' ? 'active' : ''}`} onClick={() => setActiveTab('tts')}>
                Audio TTS
              </button>
              <button className={`tia-tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>
                Mic STT
              </button>
              <button className={`tia-tab ${activeTab === 'vision' ? 'active' : ''}`} onClick={() => setActiveTab('vision')}>
                Vision PiP
              </button>
              <button className={`tia-tab ${activeTab === 'hardware' ? 'active' : ''}`} onClick={() => setActiveTab('hardware')}>
                Hardware
              </button>
            </div>

            <div className="tia-model-selector-bar">
              <Sparkles size={13} color="#c084fc" />
              <span className="tia-model-label">Model:</span>
              <select
                className="tia-model-dropdown"
                value={selectedLlmModel}
                onChange={(e) => handleModelChange(e.target.value)}
                title="Active Cloud LLM Model on Groq"
              >
                <option value="qwen/qwen3.8-27b">qwen/qwen3.8-27b (Fast 27B)</option>
                <option value="openai/gpt-oss-20b">openai/gpt-oss-20b (Reasoning 20B)</option>
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Large 120B)</option>
                <option value="allam-2-7b">allam-2-7b (7B)</option>
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
                  onClick={() => setEnableStt(!enableStt)}
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
                  navigator.clipboard.writeText(txt);
                  alert('Logs copied to clipboard!');
                }}
                title="Copy Terminal Logs"
              >
                <Copy size={13} />
                <span>Copy</span>
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
    </div>
  );
}
