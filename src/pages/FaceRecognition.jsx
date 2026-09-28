import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { UserPlus, Activity, Zap, RefreshCw, Trash2, Volume2, ShieldCheck, Terminal, ArrowLeft } from 'lucide-react';
import { facesApi } from '../api/faces';
import { loadFaceApiModels } from '../utils/faceApiHelper';
import { useCamera } from '../hooks/useCamera';
import { useSpeech } from '../hooks/useSpeech';
import { FaceEnrollmentModal } from '../components/FaceEnrollmentModal';
import { LogViewerModal } from '../components/LogViewerModal';
import { logger } from '../services/logger';
import { kioskConfigService } from '../services/kioskConfigService';
import './FaceRecognition.css';

const FaceRecognition = ({ onNavigate }) => {
  const faceCanvasRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [greeting, setGreeting] = useState('');
  const [isDetecting, setIsDetecting] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Performance Benchmarking State
  const [fps, setFps] = useState(0);
  const [detectionLatency, setDetectionLatency] = useState(0);
  const [selectedDetector, setSelectedDetector] = useState(() => kioskConfigService.getConfig().faceDetectorModel || 'tinyFace');
  const [detectionInterval, setDetectionInterval] = useState(() => kioskConfigService.getConfig().faceDetectionIntervalMs || 250);

  const lastSpokenUserRef = useRef(null);
  const lastDetectionTimeRef = useRef({});
  const lastPerfLogTimeRef = useRef(0);
  const fpsFrameCountRef = useRef(0);
  const fpsLastTimeRef = useRef(performance.now());

  const { videoRef, startCamera, stopCamera, error: cameraError, isStreaming } = useCamera({ width: 640, height: 480 });
  const { speak, stop: stopSpeech } = useSpeech();

  // Load models & start camera
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      logger.info('CAMERA', 'Starting camera hardware (640x480)...');
      try {
        await loadFaceApiModels();
        if (mounted) {
          setModelsLoaded(true);
          logger.ai('MODELS', 'Face API neural network models loaded successfully');
        }
      } catch (err) {
        logger.error('MODELS', `Error loading face-api models: ${err.message}`);
        console.error('Error loading face-api models:', err);
        return;
      }

      try {
        await startCamera();
        logger.info('CAMERA', 'Camera stream active');
      } catch (err) {
        logger.error('CAMERA', `Error starting camera: ${err.message}`);
        console.error('Error starting camera:', err);
      }
    };

    init();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Load registered users from IndexedDB
  const fetchUsers = useCallback(async () => {
    try {
      const data = await facesApi.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching registered users:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Clean up speech on unmount
  useEffect(() => {
    return () => stopSpeech();
  }, [stopSpeech]);

  // Calculate Real-Time Display FPS
  useEffect(() => {
    let animId;
    const calcFps = (now) => {
      fpsFrameCountRef.current++;
      if (now - fpsLastTimeRef.current >= 1000) {
        setFps(Math.round((fpsFrameCountRef.current * 1000) / (now - fpsLastTimeRef.current)));
        fpsFrameCountRef.current = 0;
        fpsLastTimeRef.current = now;
      }
      animId = requestAnimationFrame(calcFps);
    };
    animId = requestAnimationFrame(calcFps);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Sync canvas dimensions with video feed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handlePlay = () => {
      if (faceCanvasRef.current) {
        faceCanvasRef.current.width = video.videoWidth || 640;
        faceCanvasRef.current.height = video.videoHeight || 480;
      }
    };
    video.addEventListener('play', handlePlay);
    return () => video.removeEventListener('play', handlePlay);
  }, [videoRef]);

  // Helper to draw detection boxes
  const drawBox = (ctx, box, label, color) => {
    const { x, y, width, height } = box;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, width, height);
    ctx.font = 'bold 16px Outfit, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(label, x + 4, Math.max(y - 8, 18));
  };

  // Main Face Detection Loop
  useEffect(() => {
    if (!modelsLoaded || !isDetecting) return;
    let isMounted = true;
    let timeoutId = null;

    const detectFrame = async () => {
      if (!isMounted || !videoRef.current || videoRef.current.readyState < 2 || !faceCanvasRef.current) {
        if (isMounted) {
          timeoutId = setTimeout(detectFrame, 200);
        }
        return;
      }

      const startTime = performance.now();

      try {
        // Choose detector based on user toggle
        let detectorOptions;
        if (selectedDetector === 'tinyFace') {
          detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
        } else {
          detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 });
        }

        let detections = [];
        if (users.length === 0) {
          // If no registered faces exist, only compute bounding boxes (sub-20ms) with zero descriptor overhead
          detections = await faceapi.detectAllFaces(videoRef.current, detectorOptions);
        } else {
          // If registered users exist, compute landmarks & descriptors for matching
          detections = await faceapi
            .detectAllFaces(videoRef.current, detectorOptions)
            .withFaceLandmarks()
            .withFaceDescriptors();
        }

        const latency = Math.round(performance.now() - startTime);
        if (isMounted) setDetectionLatency(latency);

        // Ultra-low-overhead periodic telemetry log every 3.5s
        const now = Date.now();
        if (now - lastPerfLogTimeRef.current > 3500) {
          lastPerfLogTimeRef.current = now;
          logger.perf('VISION', `Latency: ${latency}ms | Render: ${fps} FPS | Model: ${selectedDetector} | Throttle: ${detectionInterval}ms`);
        }

        if (!isMounted || !faceCanvasRef.current) return;

        const ctx = faceCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, faceCanvasRef.current.width, faceCanvasRef.current.height);

        if (detections.length === 0) {
          timeoutId = setTimeout(detectFrame, detectionInterval);
          return;
        }

        if (users.length === 0) {
          detections.forEach((d) => {
            const box = d.box || d.detection?.box;
            if (box) drawBox(ctx, box, 'Guest Visitor', '#00ffff');
          });
          setGreeting('Guest visitor detected. (Register face below to test personalized greeting)');
          timeoutId = setTimeout(detectFrame, detectionInterval);
          return;
        }

        // Group embeddings by user name to support multiple registered users and multi-angle samples
        const userMap = new Map();
        users.forEach((u) => {
          if (!u || !u.name || !u.faceEmbedding) return;
          const arr = Array.isArray(u.faceEmbedding) ? u.faceEmbedding : Array.from(u.faceEmbedding);
          if (arr.length === 0) return;
          if (!userMap.has(u.name)) userMap.set(u.name, []);
          userMap.get(u.name).push(new Float32Array(arr));
        });

        if (userMap.size === 0) {
          detections.forEach((d) => drawBox(ctx, d.detection.box, 'Guest Visitor', '#ef4444'));
          timeoutId = setTimeout(detectFrame, detectionInterval);
          return;
        }

        const labeledDescriptors = Array.from(userMap.entries()).map(
          ([name, descriptors]) => new faceapi.LabeledFaceDescriptors(name, descriptors)
        );

        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.55);
        const results = detections.map((d) => faceMatcher.findBestMatch(d.descriptor));

        const currentConfig = kioskConfigService.getConfig();
        const greetingTemplate = currentConfig.faceGreetingTemplate || 'Hello {name}! Welcome to Robomiracle Technologies.';
        const cooldownMs = (currentConfig.faceGreetingCooldownSec || 15) * 1000;
        const voiceGender = currentConfig.voiceGender || 'female';

        results.forEach((result, index) => {
          const box = detections[index].detection.box;
          if (result.label !== 'unknown') {
            const user = users.find((u) => u.name === result.label);
            setGreeting(`Hello, ${result.label}! ${user?.info ? `(${user.info})` : ''}`);

            const currentTime = Date.now();
            const lastTime = lastDetectionTimeRef.current[result.label] || 0;

            // Debounced Speech Greeting (Customizable cooldown per person)
            if (lastSpokenUserRef.current !== result.label || currentTime - lastTime > cooldownMs) {
              const text = greetingTemplate.replace('{name}', result.label);
              logger.ai('MATCH', `Recognized "${result.label}" (Distance: ${result.distance.toFixed(3)})`);
              logger.speech('GREET', `Speaking greeting: "${text}"`);
              speak(text, voiceGender);
              lastSpokenUserRef.current = result.label;
              lastDetectionTimeRef.current[result.label] = currentTime;
            }
            drawBox(ctx, box, result.label, '#00ffff');
          } else {
            setGreeting('Guest visitor detected');
            drawBox(ctx, box, 'Guest Visitor', '#ef4444');

            // Stranger greeting if enabled
            if (currentConfig.strangerGreetingEnabled && currentConfig.strangerGreetingText) {
              const currentTime = Date.now();
              const lastStrangerTime = lastDetectionTimeRef.current['__stranger__'] || 0;
              if (currentTime - lastStrangerTime > cooldownMs * 1.5) {
                speak(currentConfig.strangerGreetingText, voiceGender);
                lastDetectionTimeRef.current['__stranger__'] = currentTime;
              }
            }
          }
        });
      } catch (err) {
        logger.error('DETECTION', `Loop error: ${err.message}`);
        console.error('Detection loop error:', err);
      }

      if (isMounted) {
        timeoutId = setTimeout(detectFrame, detectionInterval);
      }
    };

    detectFrame();

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [modelsLoaded, isDetecting, users, selectedDetector, detectionInterval, speak]);

  const handleDeleteUser = async (id) => {
    try {
      await facesApi.deleteUser(id);
      logger.warn('USER', `Deleted enrolled face record: ${id}`);
      fetchUsers();
    } catch (err) {
      logger.error('USER', `Failed to delete user: ${err.message}`);
      console.error('Delete user error:', err);
    }
  };

  const getFpsClass = (value) => {
    if (value >= 45) return 'fps-good';
    if (value >= 25) return 'fps-medium';
    return 'fps-bad';
  };

  return (
    <div className="face-recognition-page-wrapper">
      {/* Outer HUD Corner Elements */}
      <div className="hud-corner hud-top-left">&gt;&gt;&gt; AURRA_V</div>
      <div className="hud-corner hud-top-right">DIAGNOSTIC_HUD &lt;&lt;&lt;</div>
      <div className="hud-corner hud-bottom-left">&gt;&gt;&gt; ISOLATED_VISION</div>
      <div className="hud-corner hud-bottom-right">STATUS_ACTIVE &lt;&lt;&lt;</div>

      {/* Header */}
      <header className="header">
        <h1 className="heading">Face Greetings Diagnostic</h1>
      </header>
      <div className="subheading">Testing Camera &amp; Neural Recognition Overhead in Isolation</div>

      {/* Real-Time Diagnostics & Controls Bar */}
      <div className="diagnostics-bar">
        {onNavigate && (
          <button 
            className="control-btn" 
            onClick={() => {
              stopCamera();
              onNavigate('/');
            }}
            style={{ borderColor: '#00ffff', color: '#00ffff' }}
          >
            <ArrowLeft size={14} /> Back to Home
          </button>
        )}

        {/* FPS Indicator */}
        <div className={`metric-pill ${getFpsClass(fps)}`}>
          <Activity size={14} /> {fps} FPS
        </div>

        {/* Inference Latency */}
        <div className="metric-pill">
          <Zap size={14} /> Latency: {detectionLatency}ms
        </div>

        {/* Detector Model Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Model:</span>
          <select
            className="control-select"
            value={selectedDetector}
            onChange={(e) => setSelectedDetector(e.target.value)}
          >
            <option value="ssdMobilenetv1">SSD MobileNet V1 (Aurra 1.0)</option>
            <option value="tinyFace">TinyFaceDetector (Fast 5x)</option>
          </select>
        </div>

        {/* Detection Throttle Interval */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>Loop:</span>
          <select
            className="control-select"
            value={detectionInterval}
            onChange={(e) => setDetectionInterval(Number(e.target.value))}
          >
            <option value={150}>150ms (Aurra 1.0 default)</option>
            <option value={500}>500ms (Moderate)</option>
            <option value={1200}>1200ms (Throttled)</option>
          </select>
        </div>

        {/* Register Face Button */}
        <button className="control-btn" onClick={() => setIsModalOpen(true)}>
          <UserPlus size={14} /> Register Face
        </button>

        {/* View Diagnostic Logs Button */}
        <button className="control-btn" onClick={() => setIsLogModalOpen(true)}>
          <Terminal size={14} /> View Logs
        </button>

        {/* Toggle Detection Button */}
        <button
          className="control-btn"
          onClick={() => setIsDetecting(!isDetecting)}
          style={{ borderColor: isDetecting ? '#22c55e' : '#ef4444', color: isDetecting ? '#22c55e' : '#ef4444' }}
        >
          {isDetecting ? 'Pause AI' : 'Resume AI'}
        </button>
      </div>

      {/* Main Video & Canvas Container */}
      <div className="contain">
        <div className="video-display-container">
          <div className="video-wrapper">
            <video ref={videoRef} className="fr-video-feed" autoPlay muted playsInline />
            <canvas ref={faceCanvasRef} className="face-detection-canvas" />
          </div>

          {cameraError && (
            <div className="face-greeting-text" style={{ color: '#f87171', borderColor: '#f87171' }}>
              Camera Error: {cameraError.message}
            </div>
          )}

          {!cameraError && !modelsLoaded && (
            <div className="status-toast">
              Loading Face-API neural network model weights from /models...
            </div>
          )}

          {greeting && <div className="face-greeting-text">{greeting}</div>}

          {/* Enrolled Faces Badge List with Quick Enroll */}
          <div className="enrolled-faces-bar">
            <span style={{ fontWeight: 700, color: '#00ffff' }}>Enrolled Users ({users.length}):</span>
            {users.length === 0 ? (
              <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>
                No registered faces yet. Click "+ Enroll User" to register multiple people!
              </span>
            ) : (
              users.map((u) => (
                <span key={u.id || u.name} className="enrolled-badge" title={u.info ? `${u.name} (${u.info})` : u.name}>
                  <ShieldCheck size={12} />
                  <span>{u.name}</span>
                  {u.info && <span style={{ opacity: 0.7, fontSize: 10 }}>• {u.info}</span>}
                  <button
                    className="delete-user-btn"
                    title={`Delete ${u.name}`}
                    onClick={() => handleDeleteUser(u.id || u.name)}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
            <button
              className="control-btn"
              style={{ padding: '3px 10px', fontSize: 11, marginLeft: 6 }}
              onClick={() => setIsModalOpen(true)}
            >
              <UserPlus size={12} /> + Enroll User
            </button>
          </div>
        </div>
      </div>

      {/* Face Registration Modal */}
      <FaceEnrollmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUserRegistered={() => {
          logger.info('ENROLL', 'Registered face successfully');
          fetchUsers();
        }}
        videoEl={videoRef.current}
      />

      {/* Real-time Diagnostics Log Modal */}
      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
      />
    </div>
  );
};

export default FaceRecognition;
