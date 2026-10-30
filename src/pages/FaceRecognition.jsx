import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { UserPlus, RefreshCw, Trash2, Volume2, ShieldCheck, ArrowLeft } from 'lucide-react';
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
  const faceAnalysisRef = useRef({
    firstDetectedTime: null,
    lastSeenTime: null,
    matchHistory: [],
    greeted: false,
  });

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

  // Helper to draw detection boxes with analysis progress indicator
  const drawBox = (ctx, box, label, color, progress = null) => {
    const { x, y, width, height } = box;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, width, height);

    // High-contrast badge for label readability
    ctx.font = 'bold 15px Outfit, system-ui, sans-serif';
    const textWidth = ctx.measureText(label).width;
    const tagHeight = 22;
    const tagY = Math.max(y - tagHeight - 2, 4);
    ctx.fillStyle = 'rgba(3, 6, 13, 0.85)';
    ctx.fillRect(x, tagY, textWidth + 14, tagHeight);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, tagY, textWidth + 14, tagHeight);

    ctx.fillStyle = color;
    ctx.fillText(label, x + 6, tagY + 16);

    // If analysis progress is provided (0 to 100), render an animated bottom progress bar
    if (progress !== null && progress >= 0 && progress <= 100) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(x, y + height - 6, width, 6);
      ctx.fillStyle = color;
      ctx.fillRect(x, y + height - 6, (width * progress) / 100, 6);
    }
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
          // If no registered faces exist, only compute bounding boxes with zero descriptor overhead
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
          // Reset 2-second analysis window if no face is visible for more than 650ms
          if (faceAnalysisRef.current.lastSeenTime && (now - faceAnalysisRef.current.lastSeenTime > 650)) {
            faceAnalysisRef.current = {
              firstDetectedTime: null,
              lastSeenTime: null,
              matchHistory: [],
              greeted: false,
            };
            setGreeting('');
          }
          timeoutId = setTimeout(detectFrame, detectionInterval);
          return;
        }

        // Face detected in current frame: Track 2-second analysis window
        if (!faceAnalysisRef.current.firstDetectedTime) {
          faceAnalysisRef.current.firstDetectedTime = now;
          faceAnalysisRef.current.matchHistory = [];
          faceAnalysisRef.current.greeted = false;
        }
        faceAnalysisRef.current.lastSeenTime = now;

        const elapsedMs = now - faceAnalysisRef.current.firstDetectedTime;
        const ANALYSIS_DURATION_MS = 2000; // Take 2 seconds to analyze and recognize face
        const isAnalyzing = elapsedMs < ANALYSIS_DURATION_MS;
        const progressPercent = Math.min(100, Math.round((elapsedMs / ANALYSIS_DURATION_MS) * 100));
        const secondsRemaining = Math.max(0, ((ANALYSIS_DURATION_MS - elapsedMs) / 1000)).toFixed(1);

        if (users.length === 0) {
          if (isAnalyzing) {
            detections.forEach((d) => {
              const box = d.box || d.detection?.box;
              if (box) drawBox(ctx, box, `Analyzing face... ${progressPercent}%`, '#f59e0b', progressPercent);
            });
            setGreeting(`Scanning face... ${progressPercent}% (${secondsRemaining}s)`);
          } else {
            detections.forEach((d) => {
              const box = d.box || d.detection?.box;
              if (box) drawBox(ctx, box, 'Guest Visitor', '#00ffff');
            });
            setGreeting('Guest visitor detected. (Register face below to test personalized greeting)');
          }
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

        // Accumulate matching descriptors during the 2-second analysis window
        results.forEach((r) => {
          if (r.label) {
            faceAnalysisRef.current.matchHistory.push({
              label: r.label,
              distance: r.distance,
            });
          }
        });

        const currentConfig = kioskConfigService.getConfig();
        const greetingTemplate = currentConfig.faceGreetingTemplate || 'Hello {name}! Welcome to Robomiracle Technologies.';
        const cooldownMs = (currentConfig.faceGreetingCooldownSec || 15) * 1000;
        const voiceGender = currentConfig.voiceGender || 'female';

        if (isAnalyzing) {
          // Still analyzing within the 2-second window
          detections.forEach((d) => {
            const box = d.detection.box;
            drawBox(ctx, box, `Analyzing face... ${progressPercent}%`, '#f59e0b', progressPercent);
          });
          setGreeting(`Analyzing & recognizing face... ${progressPercent}% (${secondsRemaining}s)`);
        } else {
          // 2 seconds completed: Determine consensus match
          let consensusLabel = 'unknown';
          let consensusDistance = 1.0;

          const labelVotes = {};
          faceAnalysisRef.current.matchHistory.forEach((m) => {
            if (m.label !== 'unknown') {
              labelVotes[m.label] = (labelVotes[m.label] || 0) + 1;
            }
          });

          const candidates = Object.keys(labelVotes);
          if (candidates.length > 0) {
            candidates.sort((a, b) => labelVotes[b] - labelVotes[a]);
            consensusLabel = candidates[0];
            const dists = faceAnalysisRef.current.matchHistory
              .filter((m) => m.label === consensusLabel)
              .map((m) => m.distance);
            consensusDistance = dists.length > 0 ? Math.min(...dists) : 0.5;
          } else {
            consensusLabel = results[0]?.label || 'unknown';
          }

          results.forEach((result, index) => {
            const box = detections[index].detection.box;
            const targetLabel = results.length === 1 ? consensusLabel : result.label;

            if (targetLabel !== 'unknown') {
              const user = users.find((u) => u.name === targetLabel);
              setGreeting(`Hello, ${targetLabel}! ${user?.info ? `(${user.info})` : ''}`);

              const currentTime = Date.now();
              const lastTime = lastDetectionTimeRef.current[targetLabel] || 0;

              // Speak greeting once 2-second analysis finishes, respecting cooldown
              if (!faceAnalysisRef.current.greeted) {
                if (lastSpokenUserRef.current !== targetLabel || currentTime - lastTime > cooldownMs) {
                  const text = greetingTemplate.replace('{name}', targetLabel);
                  logger.ai('MATCH', `Recognized "${targetLabel}" after 2s analysis (Distance: ${consensusDistance.toFixed(3)})`);
                  logger.speech('GREET', `Speaking greeting: "${text}"`);
                  speak(text, voiceGender);
                  lastSpokenUserRef.current = targetLabel;
                  lastDetectionTimeRef.current[targetLabel] = currentTime;
                }
                faceAnalysisRef.current.greeted = true;
              }
              drawBox(ctx, box, `${targetLabel}`, '#00ffff');
            } else {
              setGreeting('Guest visitor detected');
              drawBox(ctx, box, 'Guest Visitor', '#ef4444');

              // Stranger greeting if enabled
              if (!faceAnalysisRef.current.greeted && currentConfig.strangerGreetingEnabled && currentConfig.strangerGreetingText) {
                const currentTime = Date.now();
                const lastStrangerTime = lastDetectionTimeRef.current['__stranger__'] || 0;
                if (currentTime - lastStrangerTime > cooldownMs * 1.5) {
                  speak(currentConfig.strangerGreetingText, voiceGender);
                  lastDetectionTimeRef.current['__stranger__'] = currentTime;
                }
                faceAnalysisRef.current.greeted = true;
              }
            }
          });
        }
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
      {/* Outer HUD Bottom Elements */}
      <div className="hud-corner hud-bottom-left">&gt;&gt;&gt; ISOLATED_VISION</div>
      <div className="hud-corner hud-bottom-right">STATUS_ACTIVE &lt;&lt;&lt;</div>

      {/* Top Left Corner: Back to Home Button */}
      {onNavigate && (
        <button 
          className="fr-corner-btn fr-corner-btn-left" 
          onClick={() => {
            stopCamera();
            onNavigate('/');
          }}
          title="Back to Home"
        >
          <ArrowLeft size={16} color="#0284c7" />
          <span>Back to Home</span>
        </button>
      )}

      {/* Top Right Corner: Register Face Button */}
      <button 
        className="fr-corner-btn fr-corner-btn-right" 
        onClick={() => setIsModalOpen(true)}
        title="Register New Face"
      >
        <UserPlus size={16} color="#0284c7" />
        <span>Register Face</span>
      </button>

      {/* Header */}
      <header className="header">
        <h1 className="heading">Face Greetings Diagnostic</h1>
      </header>
      <div className="subheading">Testing Camera &amp; Neural Recognition Overhead in Isolation</div>

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
