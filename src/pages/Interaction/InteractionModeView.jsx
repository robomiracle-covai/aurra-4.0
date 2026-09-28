import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, Camera, Volume2, Sparkles, User, ShieldCheck, Cpu,
  RefreshCw, Wifi, Activity, MessageSquare, ExternalLink, Zap, Video, VideoOff, Mic, MicOff
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { detectFacesInVideo, loadFaceApiModels } from '../../utils/faceApiHelper';
import { offlineFaceService, offlineQaService } from '../../db/offlineServices';
import { voiceNavigationService } from '../../services/voiceNavigationService';
import { esp32Service } from '../../services/esp32Service';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { kioskConfigService } from '../../services/kioskConfigService';
import InteractionAvatar from '../../components/InteractionAvatar';
import './InteractionModeView.css';

export default function InteractionModeView({ onNavigate }) {
  const canvasRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectedCount, setDetectedCount] = useState(0);
  const [recognizedPerson, setRecognizedPerson] = useState(null);
  const [coreStatus, setCoreStatus] = useState('IDLE'); // 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastFeedback, setLastFeedback] = useState('');
  const [enrolledFaces, setEnrolledFaces] = useState([]);
  const [espConnected, setEspConnected] = useState(false);
  const [showCameraFeed, setShowCameraFeed] = useState(false); // Default hidden background video
  const [forceLlmMode, setForceLlmMode] = useState(false); // Direct Cloud AI Groq LLM Mode

  const coreStatusRef = useRef(coreStatus);
  coreStatusRef.current = coreStatus;

  const lastGreetingTimeRef = useRef({});
  const detectionLoopRef = useRef(null);

  // Initialize Camera hook with standard mobile resolution (640x480)
  const { videoRef, startCamera, stopCamera, isStreaming, error: cameraError } = useCamera({
    width: 640,
    height: 480,
  });

  // Load Neural Models, Enrolled Faces & Start Camera Feed
  useEffect(() => {
    let isMounted = true;
    async function initVision() {
      try {
        const loaded = await loadFaceApiModels();
        if (isMounted) setModelsLoaded(loaded);
        const faces = await offlineFaceService.getUsers();
        if (isMounted) setEnrolledFaces(faces);
        await startCamera();
      } catch (err) {
        console.warn('[INTERACTION] Vision init error:', err);
      }
    }
    initVision();
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Ensure Video Stream Plays when User Toggles Camera ON
  useEffect(() => {
    if (showCameraFeed) {
      startCamera().then(() => {
        if (videoRef.current) {
          videoRef.current.play().catch((err) => console.warn('[INTERACTION] Video play error:', err));
        }
      });
    }
  }, [showCameraFeed, startCamera]);

  // Subscribe to Voice Assistant Events & Status
  useEffect(() => {
    const handleQaAnswered = (e) => {
      const { match } = e.detail || {};
      if (match?.answer) {
        setLastFeedback(match.answer);
      }
    };

    window.addEventListener('aurra:qa-answered', handleQaAnswered);

    const unsubscribe = voiceNavigationService.subscribe((state) => {
      setIsListening(state.isListening);
      if (state.transcript !== undefined) setLastTranscript(state.transcript);
      if (state.feedback) setLastFeedback(state.feedback);

      if (state.isSpeaking) {
        setCoreStatus('SPEAKING');
      } else if (state.isThinking) {
        setCoreStatus('THINKING');
      } else if (state.isListening) {
        setCoreStatus('LISTENING');
      } else {
        setCoreStatus('IDLE');
      }
    });

    return () => {
      window.removeEventListener('aurra:qa-answered', handleQaAnswered);
      unsubscribe();
    };
  }, []);

  // Auto-dismiss spoken feedback card after 8.5 seconds of idle
  useEffect(() => {
    if (!lastFeedback) return;
    const timer = setTimeout(() => {
      setLastFeedback('');
    }, 8500);
    return () => clearTimeout(timer);
  }, [lastFeedback]);

  // Check Hardware Status
  useEffect(() => {
    const checkHw = async () => {
      const status = await esp32Service.checkStatus();
      setEspConnected(status.connected);
    };
    checkHw();
    const interval = setInterval(checkHw, 5000);
    return () => clearInterval(interval);
  }, []);

  // Biometric Detection Loop (Non-blocking 250ms)
  const processDetection = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelsLoaded || !isStreaming) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.paused || video.ended || !video.videoWidth) return;

    const cfg = kioskConfigService.getConfig();
    const width = video.videoWidth;
    const height = video.videoHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    try {
      const detections = await detectFacesInVideo(video, cfg.faceDetectorModel || 'tinyFace');
      setDetectedCount(detections.length);

      if (!detections || detections.length === 0) {
        setRecognizedPerson(null);
        return;
      }

      // Draw Holographic Reticles
      for (const det of detections) {
        const box = det.detection ? det.detection.box : det.box || det;
        if (!box) continue;

        const { x, y, width: bw, height: bh } = box;

        // Draw Cyber Bounding Box
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, bw, bh);

        // Draw Cyber Corner Accents
        const cl = Math.min(bw, bh) * 0.2;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;

        // Top-Left
        ctx.beginPath(); ctx.moveTo(x, y + cl); ctx.lineTo(x, y); ctx.lineTo(x + cl, y); ctx.stroke();
        // Top-Right
        ctx.beginPath(); ctx.moveTo(x + bw - cl, y); ctx.lineTo(x + bw, y); ctx.lineTo(x + bw, y + cl); ctx.stroke();
        // Bottom-Left
        ctx.beginPath(); ctx.moveTo(x, y + bh - cl); ctx.lineTo(x, y + bh); ctx.lineTo(x + cl, y + bh); ctx.stroke();
        // Bottom-Right
        ctx.beginPath(); ctx.moveTo(x + bw - cl, y + bh); ctx.lineTo(x + bw, y + bh); ctx.lineTo(x + bw, y + bh - cl); ctx.stroke();

        // Biometric Match against enrolled faces
        let matchedFace = null;
        if (enrolledFaces.length > 0 && det.descriptor) {
          for (const face of enrolledFaces) {
            const embedding = face.faceEmbedding || face.descriptor;
            if (embedding && (embedding.length >= 128 || embedding.length)) {
              const descA = Array.from(det.descriptor);
              const descB = Array.from(embedding);
              const dist = Math.sqrt(descA.reduce((sum, val, i) => sum + Math.pow(val - descB[i], 2), 0));
              if (dist < 0.55) {
                matchedFace = face;
                break;
              }
            }
          }
        }

        const now = Date.now();
        const cooldownMs = (cfg.faceGreetingCooldownSec || 15) * 1000;

        if (matchedFace) {
          setRecognizedPerson(matchedFace.name);

          // Render Label
          ctx.fillStyle = 'rgba(0, 255, 255, 0.85)';
          ctx.fillRect(x, Math.max(0, y - 28), Math.max(120, bw), 24);
          ctx.fillStyle = '#031127';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText(`VIP: ${matchedFace.name.toUpperCase()}`, x + 6, Math.max(16, y - 12));

          // Trigger Spoken Greeting if cooldown elapsed
          const lastTime = lastGreetingTimeRef.current[matchedFace.id] || 0;
          if (now - lastTime > cooldownMs) {
            lastGreetingTimeRef.current[matchedFace.id] = now;
            const template = cfg.faceGreetingTemplate || 'Hello {name}! Welcome to Robomiracle Technologies.';
            const greeting = template.replace(/{name}/g, matchedFace.name);
            setLastFeedback(greeting);
            setCoreStatus('SPEAKING');

            // Dispatch hardware servo gesture
            esp32Service.setHeadTilt(100);
            esp32Service.setEyeColor('#00ffff');

            voiceNavigationService.speak(greeting, {
              onEnd: () => {
                setCoreStatus('IDLE');
                esp32Service.setHeadTilt(90);
              },
            });
          }
        } else {
          setRecognizedPerson('GUEST');

          // Render Guest Label
          ctx.fillStyle = 'rgba(148, 163, 184, 0.75)';
          ctx.fillRect(x, Math.max(0, y - 24), Math.max(100, bw), 20);
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('VISITOR DETECTED', x + 6, Math.max(14, y - 10));

          // Trigger Stranger Greeting if enabled
          if (cfg.strangerGreetingEnabled) {
            const lastGuestTime = lastGreetingTimeRef.current['guest'] || 0;
            if (now - lastGuestTime > cooldownMs) {
              lastGreetingTimeRef.current['guest'] = now;
              const strangerMsg = cfg.strangerGreetingText || 'Hello guest! Welcome to Robomiracle Technologies.';
              setLastFeedback(strangerMsg);
              setCoreStatus('SPEAKING');

              voiceNavigationService.speak(strangerMsg, {
                onEnd: () => setCoreStatus('IDLE'),
              });
            }
          }
        }
      }
    } catch (err) {
      console.warn('[INTERACTION] Detection error:', err);
    }
  }, [modelsLoaded, isStreaming, enrolledFaces]);

  // Loop Execution
  useEffect(() => {
    const cfg = kioskConfigService.getConfig();
    const intervalMs = cfg.faceDetectionIntervalMs || 250;

    detectionLoopRef.current = setInterval(processDetection, intervalMs);
    return () => {
      if (detectionLoopRef.current) clearInterval(detectionLoopRef.current);
    };
  }, [processDetection]);

  return (
    <div className="hud-interaction-container">
      {/* Background Cyber Grid Vignette */}
      <div className="hud-grid-vignette" />

      {/* Top-Right Floating Camera PiP Widget */}
      <div className={`hud-video-wrapper ${showCameraFeed ? 'visible' : 'hidden'}`}>
        <video ref={videoRef} autoPlay playsInline muted className="hud-video-feed" />
        <canvas ref={canvasRef} className="hud-canvas-overlay" />
        <div className="hud-pip-badge">LIVE VISION</div>
      </div>

      {/* Top Cyber HUD Bar */}
      <header className="hud-top-bar">
        <button className="hud-back-btn" onClick={() => onNavigate('/')} title="Return to Main Menu">
          <ArrowLeft size={20} />
          <span>EXIT HUD</span>
        </button>

        <div className="hud-header-title">
          <h1>HUMANOID INTERACTION HUD</h1>
          <span className="hud-status-badge">
            <Activity size={12} className="pulse-icon" />
            90 FPS VISION • MULTIMODAL AI
          </span>
        </div>

        <div className="hud-telemetry-group">
          <span className={`hud-pill ${espConnected ? 'active' : 'warn'}`}>
            <Wifi size={13} />
            <span>ESP32: {espConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </span>
          <button
            className={`hud-pill camera-toggle ${showCameraFeed ? 'active' : 'inactive'}`}
            onClick={() => setShowCameraFeed(!showCameraFeed)}
            title="Toggle Camera Background Feed"
          >
            {showCameraFeed ? <Video size={13} /> : <VideoOff size={13} />}
            <span>CAM: {showCameraFeed ? 'ON' : 'OFF'}</span>
          </button>
          <button
            className={`hud-pill ai-only-toggle ${forceLlmMode ? 'active' : 'inactive'}`}
            onClick={() => {
              const next = !forceLlmMode;
              setForceLlmMode(next);
              voiceNavigationService.setForceLlmOnly(next);
            }}
            title="Force direct Cloud AI (Groq API key) responses"
          >
            <Sparkles size={13} />
            <span>AI ONLY: {forceLlmMode ? 'ON' : 'OFF'}</span>
          </button>
          <span className="hud-pill cyan">
            <User size={13} />
            <span>FACES: {detectedCount}</span>
          </span>
        </div>
      </header>

      {/* Main Center Overlay: Moving Cyber Avatar & Spoken Feedback Stream */}
      <main className="hud-center-overlay">
        <InteractionAvatar
          status={coreStatus}
          isMuted={!isListening}
          detectedPerson={recognizedPerson}
        />

        <div className="hud-status-display">
          <span className="hud-status-label">AURRA NEURAL VOICE BRAIN</span>
          <h2 className={`hud-status-text ${coreStatus.toLowerCase()}`}>
            {!isListening && '🚫 MIC MUTED / AI PAUSED'}
            {isListening && coreStatus === 'LISTENING' && '🎤 LISTENING TO VISITOR...'}
            {isListening && coreStatus === 'THINKING' && '⚡ PROCESSING QUERY...'}
            {isListening && coreStatus === 'SPEAKING' && '🔊 SPEAKING RESPONSE...'}
            {isListening && coreStatus === 'IDLE' && (recognizedPerson ? `✨ ENGAGED: ${recognizedPerson}` : '✨ STANDBY & MONITORING')}
          </h2>

          {/* Live Visitor Spoken Utterance Bubble */}
          {lastTranscript && isListening && coreStatus !== 'SPEAKING' && (
            <div className="hud-live-transcript-bubble">
              <span className="live-transcript-tag">YOU SAID</span>
              <p className="live-transcript-text">"{lastTranscript}"</p>
            </div>
          )}
        </div>

        {/* Live Spoken Feedback Container */}
        {lastFeedback && (
          <div className="hud-feedback-card">
            <div className="feedback-card-header">
              <div className="feedback-title-group">
                <Volume2 size={16} color="#00ffff" />
                <span>SPOKEN AUDIO RESPONSE</span>
              </div>
              <button
                className="feedback-close-btn"
                onClick={() => setLastFeedback('')}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            <p className="feedback-card-text">"{lastFeedback}"</p>
          </div>
        )}
      </main>

      {/* Bottom Glassmorphic Quick Controls */}
      <footer className="hud-bottom-bar">
        <div className="hud-quick-actions">
          <button
            className={`hud-action-btn speech-toggle-btn ${isListening ? 'active' : 'muted'}`}
            onClick={() => {
              if (isListening) {
                voiceNavigationService.stopListening(true);
              } else {
                voiceNavigationService.startListening(true);
              }
            }}
          >
            {isListening ? <Mic size={18} /> : <MicOff size={18} />}
            <span>{isListening ? 'SPEECH: ON' : 'SPEECH: MUTED'}</span>
          </button>

          <button className="hud-action-btn" onClick={() => onNavigate('/qa')}>
            <MessageSquare size={16} />
            <span>Interactive Q&amp;A</span>
          </button>

          <button className="hud-action-btn" onClick={() => onNavigate('/form')}>
            <ShieldCheck size={16} />
            <span>Check-In Form</span>
          </button>

          <button className="hud-action-btn" onClick={() => onNavigate('/control')}>
            <Cpu size={16} />
            <span>Robot Cockpit</span>
          </button>

          <button className="hud-action-btn" onClick={() => onNavigate('/hardware')}>
            <Wifi size={16} />
            <span>Hardware Setup</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
