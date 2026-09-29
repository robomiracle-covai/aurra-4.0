import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, Play, Pause, SkipForward, SkipBack, 
  Volume2, RotateCcw, Sparkles, CheckCircle2, Bot, 
  ChevronRight, Award, Compass, Eye
} from 'lucide-react';
import { offlineRobotTourService } from '../../db/offlineServices';
import { speakWithVoice, cancelSpeech } from '../../utils/speechSynthesis';
import { kioskConfigService } from '../../services/kioskConfigService';
import { esp32Service } from '../../services/esp32Service';
import { logger } from '../../services/logger';
import { assetUrl } from '../../utils/platform';
import './GuidedTourView.css';

const FALLBACK_PLACEHOLDER = '/aurra/hero.webp';

export default function GuidedTourView({ onNavigate }) {
  // Navigation & Data State
  const [robots, setRobots] = useState([]);
  const [selectedRobot, setSelectedRobot] = useState(null); // null = Gallery mode, object = Presentation mode
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [contentPhase, setContentPhase] = useState('intro'); // 'intro' | 'mainContent' | 'thankYou'
  
  // Tour Playback & Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastCountdown, setToastCountdown] = useState(null); // null | 3 | 2 | 1
  const [isCompleted, setIsCompleted] = useState(false);
  const [kioskConfig, setKioskConfig] = useState(() => kioskConfigService.getConfig());

  const countdownTimerRef = useRef(null);
  const phaseTimerRef = useRef(null);
  const isSpeakingRef = useRef(false);

  // 1. Load Robots on Mount
  useEffect(() => {
    loadRobots();
    const unsub = kioskConfigService.subscribe((cfg) => setKioskConfig(cfg));
    return () => {
      unsub();
      handleStopTour();
    };
  }, []);

  const loadRobots = async () => {
    try {
      const data = await offlineRobotTourService.getRobots();
      const enabledOnly = data.filter((r) => r.isEnabled !== false);
      setRobots(enabledOnly);
    } catch (err) {
      logger.error('TOUR', `Failed loading robot tours: ${err.message}`);
    }
  };

  // Safe Cleanup
  const handleStopTour = () => {
    cancelSpeech();
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setIsPlaying(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (phaseTimerRef.current) clearTimeout(phaseTimerRef.current);
  };

  // 2. Select a Robot and Launch Presentation
  const handleSelectRobot = (robot) => {
    handleStopTour();
    setSelectedRobot(robot);
    setCurrentStepIndex(0);
    setContentPhase('intro');
    setIsCompleted(false);

    // Sync robot hardware eye color
    if (robot.slug === 'aurra') esp32Service.setRgb('#00FFFF');
    else if (robot.slug === 'nexus') esp32Service.setRgb('#38BDF8');
    else if (robot.slug === 'nova') esp32Service.setRgb('#8B5CF6');
    else if (robot.slug === 'dine') esp32Service.setRgb('#10B981');
    else if (robot.slug === 'gi') esp32Service.setRgb('#F59E0B');

    // Trigger Initial 3-second Countdown Toast
    startCountdownAndPlay(robot, 0, 'intro');
  };

  // 3. Start Countdown Toast
  const startCountdownAndPlay = (robot, stepIdx, phase) => {
    handleStopTour();
    setToastCountdown(3);

    let count = 3;
    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setToastCountdown(count);
      } else {
        clearInterval(countdownTimerRef.current);
        setToastCountdown(null);
        setIsPlaying(true);
        playPhaseSpeech(robot, stepIdx, phase);
      }
    }, 1000);
  };

  // 4. Play Voice for Current Phase
  const playPhaseSpeech = (robot, stepIdx, phase) => {
    const activeRobot = robot || selectedRobot;
    if (!activeRobot || !activeRobot.steps || activeRobot.steps.length === 0) return;

    const step = activeRobot.steps[stepIdx];
    if (!step) return;

    const textToSpeak = step[phase] || step.intro || step.mainContent || '';
    if (!textToSpeak) {
      advanceToNextPhase(activeRobot, stepIdx, phase);
      return;
    }

    cancelSpeech();
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    speakWithVoice(textToSpeak, {
      gender: kioskConfig.voiceGender || 'female',
      rate: Number(kioskConfig.speechRate || 1.0),
      pitch: Number(kioskConfig.speechPitch || 1.05),
      onStart: () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      },
      onEnd: () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        // Small pause between phases for natural speaking flow
        phaseTimerRef.current = setTimeout(() => {
          advanceToNextPhase(activeRobot, stepIdx, phase);
        }, 800);
      },
      onError: () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        phaseTimerRef.current = setTimeout(() => {
          advanceToNextPhase(activeRobot, stepIdx, phase);
        }, 1000);
      },
    });
  };

  // 5. Automatic Progression between Intro -> Main Content -> Thank You -> Next Step
  const advanceToNextPhase = (robot, stepIdx, currentPhase) => {
    const activeRobot = robot || selectedRobot;
    if (!activeRobot || !activeRobot.steps) return;

    if (currentPhase === 'intro') {
      setContentPhase('mainContent');
      playPhaseSpeech(activeRobot, stepIdx, 'mainContent');
    } else if (currentPhase === 'mainContent') {
      setContentPhase('thankYou');
      playPhaseSpeech(activeRobot, stepIdx, 'thankYou');
    } else if (currentPhase === 'thankYou') {
      // Step complete! Advance to next step or conclude
      if (stepIdx < activeRobot.steps.length - 1) {
        const nextIdx = stepIdx + 1;
        setCurrentStepIndex(nextIdx);
        setContentPhase('intro');
        playPhaseSpeech(activeRobot, nextIdx, 'intro');
      } else {
        // Concluded all steps!
        setIsPlaying(false);
        setIsCompleted(true);
        speakWithVoice(
          `You have completed the full guided tour of ${activeRobot.title}! Thank you for exploring Robomiracle Technologies.`
        );
      }
    }
  };

  // Jump to specific step via Stepper Bar
  const handleJumpToStep = (index) => {
    handleStopTour();
    setCurrentStepIndex(index);
    setContentPhase('intro');
    setIsCompleted(false);
    setIsPlaying(true);
    playPhaseSpeech(selectedRobot, index, 'intro');
  };

  // Toggle Play / Pause
  const handleTogglePlayPause = () => {
    if (isPlaying) {
      handleStopTour();
    } else {
      setIsPlaying(true);
      playPhaseSpeech(selectedRobot, currentStepIndex, contentPhase);
    }
  };

  // Step Controls
  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      handleJumpToStep(currentStepIndex - 1);
    }
  };

  const handleNextStep = () => {
    if (selectedRobot?.steps && currentStepIndex < selectedRobot.steps.length - 1) {
      handleJumpToStep(currentStepIndex + 1);
    }
  };

  const handleReplayCurrentPhase = () => {
    handleStopTour();
    setIsPlaying(true);
    playPhaseSpeech(selectedRobot, currentStepIndex, contentPhase);
  };

  const handleBackToGallery = () => {
    handleStopTour();
    setSelectedRobot(null);
  };

  const activeStep = selectedRobot?.steps?.[currentStepIndex] || null;

  return (
    <div className="tour-kiosk-root">
      {/* Cyber HUD Corner Accents */}
      <div className="tour-hud-corners">
        <div className="tour-hud-corner top-left">&gt;&gt;&gt;</div>
        <div className="tour-hud-corner top-right">&lt;&lt;&lt;</div>
        <div className="tour-hud-corner bottom-left">&gt;&gt;&gt;</div>
        <div className="tour-hud-corner bottom-right">&lt;&lt;&lt;</div>
      </div>

      {/* Background Animated Atmosphere */}
      <div className="tour-bg-grid" />
      <div className="tour-bg-glow" />

      {/* ============================================================== */}
      {/* 1. GALLERY MODE: ROBOT SELECTION SCREEN */}
      {/* ============================================================== */}
      {!selectedRobot && (
        <div className="tour-gallery-view">
          <header className="tour-gallery-header">
            <button
              className="tour-back-btn"
              onClick={() => onNavigate && onNavigate('/')}
              title="Return to Home Screen"
            >
              <ArrowLeft size={18} />
              <span>Back to Home</span>
            </button>
            <div className="tour-header-center">
              <span className="tour-kiosk-badge">
                <Compass size={14} />
                <span>ROBOMIRACLE GUIDED TOUR</span>
              </span>
              <h1 className="tour-main-heading">Welcome to the Guided Tour</h1>
              <p className="tour-main-subheading">
                Select an intelligent humanoid or autonomous service robot to begin an interactive step-by-step voice walkthrough.
              </p>
            </div>
            <div className="tour-header-spacer" />
          </header>

          {/* Robot Product Grid */}
          <div className="tour-cards-grid">
            {robots.map((robot) => (
              <div
                key={robot.id || robot.slug}
                className="tour-robot-card"
                onClick={() => handleSelectRobot(robot)}
              >
                <div className="tour-card-badge">{robot.badge || 'Autonomous Robot'}</div>
                
                <div className="tour-card-img-wrap">
                  <img
                    src={assetUrl(robot.image || FALLBACK_PLACEHOLDER)}
                    alt={robot.title}
                    className="tour-card-img"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = assetUrl(FALLBACK_PLACEHOLDER);
                    }}
                  />
                  <div className="tour-card-scanline" />
                </div>

                <div className="tour-card-body">
                  <h2 className="tour-card-title">{robot.title}</h2>
                  <p className="tour-card-subtitle">{robot.subtitle || 'AI Guided Tour'}</p>
                  
                  <div className="tour-card-footer">
                    <span className="tour-card-steps-count">
                      <Sparkles size={13} color="#00ffff" />
                      <span>{robot.steps?.length || 0} Tour Steps</span>
                    </span>
                    <button className="tour-launch-btn">
                      <span>Start Tour</span>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. PRESENTATION MODE: 5-STEP INTERACTIVE WALKTHROUGH */}
      {/* ============================================================== */}
      {selectedRobot && (
        <div className="tour-presentation-view">
          {/* Top Bar Header */}
          <header className="tour-presentation-header">
            <button className="tour-back-btn" onClick={handleBackToGallery}>
              <ArrowLeft size={18} />
              <span>All Robots</span>
            </button>

            <div className="tour-pres-title-wrap">
              <span className="tour-pres-tag">{selectedRobot.badge || 'Robotics'}</span>
              <h2 className="tour-pres-title">{selectedRobot.title}</h2>
              <span className="tour-pres-subtitle">{selectedRobot.subtitle}</span>
            </div>

            <div className="tour-pres-actions">
              <button
                className={`tour-pres-speech-btn ${isSpeaking ? 'active' : ''}`}
                onClick={handleReplayCurrentPhase}
                title="Replay Voice Speech"
              >
                <Volume2 size={16} />
                <span>{isSpeaking ? 'Speaking...' : 'Replay Audio'}</span>
              </button>
            </div>
          </header>

          {/* Stepper Navigation Bar (1, 2, 3, 4, 5) */}
          <div className="tour-stepper-bar">
            {selectedRobot.steps?.map((step, idx) => {
              const isCurrent = idx === currentStepIndex;
              const isPast = idx < currentStepIndex;
              return (
                <React.Fragment key={idx}>
                  <div
                    className={`tour-step-node ${isCurrent ? 'current' : ''} ${isPast ? 'done' : ''}`}
                    onClick={() => handleJumpToStep(idx)}
                    title={`Jump to Step ${idx + 1}: ${step.stepName}`}
                  >
                    <div className="tour-step-circle">
                      {isPast ? <CheckCircle2 size={16} /> : <span>{idx + 1}</span>}
                    </div>
                    <span className="tour-step-label">{step.stepName || `Step ${idx + 1}`}</span>
                  </div>
                  {idx < selectedRobot.steps.length - 1 && (
                    <div className={`tour-step-line ${idx < currentStepIndex ? 'done' : ''}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Main 2-Column Presentation Stage */}
          <div className="tour-stage-arena">
            {/* Left Column: Robot Photo Showcase */}
            <div className="tour-stage-left">
              <div className="tour-photo-viewport">
                <img
                  key={`${currentStepIndex}-${activeStep?.image}`}
                  src={assetUrl(activeStep?.image || selectedRobot.image || FALLBACK_PLACEHOLDER)}
                  alt={activeStep?.stepName || selectedRobot.title}
                  className="tour-photo-img"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = assetUrl(FALLBACK_PLACEHOLDER);
                  }}
                />
                <div className="tour-photo-frame" />
                <div className="tour-photo-caption">
                  <Bot size={14} color="#00ffff" />
                  <span>{activeStep?.stepName || selectedRobot.title}</span>
                </div>
              </div>
            </div>

            {/* Right Column: 3-Phase Spoken Presentation Card */}
            <div className="tour-stage-right">
              <div className="tour-card-content-box">
                {/* Step Header */}
                <div className="tour-step-info-row">
                  <span className="tour-step-badge">
                    STEP {currentStepIndex + 1} OF {selectedRobot.steps?.length || 0}
                  </span>
                  <h3 className="tour-step-heading">{activeStep?.stepName}</h3>
                </div>

                {/* 3-Phase Tabs Indicator (Intro -> Main Content -> Thank You) */}
                <div className="tour-phase-tabs">
                  <button
                    className={`tour-phase-tab ${contentPhase === 'intro' ? 'active' : ''}`}
                    onClick={() => {
                      setContentPhase('intro');
                      playPhaseSpeech(selectedRobot, currentStepIndex, 'intro');
                    }}
                  >
                    <span>1. Intro</span>
                  </button>
                  <button
                    className={`tour-phase-tab ${contentPhase === 'mainContent' ? 'active' : ''}`}
                    onClick={() => {
                      setContentPhase('mainContent');
                      playPhaseSpeech(selectedRobot, currentStepIndex, 'mainContent');
                    }}
                  >
                    <span>2. Details</span>
                  </button>
                  <button
                    className={`tour-phase-tab ${contentPhase === 'thankYou' ? 'active' : ''}`}
                    onClick={() => {
                      setContentPhase('thankYou');
                      playPhaseSpeech(selectedRobot, currentStepIndex, 'thankYou');
                    }}
                  >
                    <span>3. Summary</span>
                  </button>
                </div>

                {/* Spoken Text Display Arena with Audio Wave */}
                <div className="tour-speech-display">
                  <div className="tour-wave-row">
                    <span className="tour-phase-label-tag">
                      {contentPhase === 'intro' && 'INTRODUCTION'}
                      {contentPhase === 'mainContent' && 'MAIN HIGHLIGHTS & SPECS'}
                      {contentPhase === 'thankYou' && 'STEP SUMMARY'}
                    </span>
                    {isSpeaking && (
                      <div className="tour-mini-wave">
                        <span className="bar" />
                        <span className="bar" />
                        <span className="bar" />
                        <span className="bar" />
                      </div>
                    )}
                  </div>

                  <p className="tour-speech-text">
                    {contentPhase === 'intro' && (activeStep?.intro || 'Welcome to this step!')}
                    {contentPhase === 'mainContent' && (activeStep?.mainContent || 'Details about this feature.')}
                    {contentPhase === 'thankYou' && (activeStep?.thankYou || 'Thank you for exploring!')}
                  </p>
                </div>

                {/* Completion Celebration Badge */}
                {isCompleted && (
                  <div className="tour-completion-banner">
                    <Award size={24} color="#00ff88" />
                    <div>
                      <strong>Tour Complete!</strong>
                      <p>You have explored all features of {selectedRobot.title}.</p>
                    </div>
                  </div>
                )}

                {/* Stage Bottom Navigation Controls */}
                <div className="tour-stage-controls">
                  <button
                    className="tour-ctrl-btn secondary"
                    onClick={handlePrevStep}
                    disabled={currentStepIndex === 0}
                    title="Previous Step"
                  >
                    <SkipBack size={16} />
                    <span>Previous</span>
                  </button>

                  <button
                    className={`tour-ctrl-btn primary ${isPlaying ? 'pause' : 'play'}`}
                    onClick={handleTogglePlayPause}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    <span>{isPlaying ? 'Pause Speech' : 'Play Step'}</span>
                  </button>

                  <button
                    className="tour-ctrl-btn secondary"
                    onClick={handleNextStep}
                    disabled={!selectedRobot.steps || currentStepIndex >= selectedRobot.steps.length - 1}
                    title="Next Step"
                  >
                    <span>Next</span>
                    <SkipForward size={16} />
                  </button>

                  <button
                    className="tour-ctrl-btn icon-only"
                    onClick={() => handleJumpToStep(0)}
                    title="Restart Tour from Step 1"
                  >
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Toast Countdown Overlay ("Starting in 3... 2... 1...") */}
          {toastCountdown !== null && (
            <div className="tour-toast-overlay">
              <div className="tour-toast-box">
                <span className="tour-toast-badge">STARTING GUIDED TOUR</span>
                <div className="tour-toast-number">{toastCountdown}</div>
                <p>Welcome to {selectedRobot.title} walkthrough</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
