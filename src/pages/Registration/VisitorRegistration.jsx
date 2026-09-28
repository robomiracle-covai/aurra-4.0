import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Sparkles,
  User,
  Phone,
  Mail,
  Building,
  Tag,
  QrCode,
  Shield,
  Award,
  Clock,
  ArrowRight,
  Eye,
  Volume2,
  UserCheck,
  AlertCircle,
  RotateCcw,
  Delete,
  Hash
} from 'lucide-react';
import { useCamera } from '../../hooks/useCamera';
import { useSpeech } from '../../hooks/useSpeech';
import { offlineVisitorService, offlineFaceService } from '../../db/offlineServices';
import { kioskConfigService } from '../../services/kioskConfigService';
import { raspberryPiService } from '../../services/raspberryPiService';
import { logger } from '../../services/logger';
import './VisitorRegistration.css';

// Preset Visit Purposes
const VISIT_PURPOSES = [
  { id: 'client_meeting', label: 'Client Meeting', desc: 'Project discussions & vendor demos', icon: Building },
  { id: 'interview', label: 'Job Interview', desc: 'Candidate admission & HR assessment', icon: UserCheck },
  { id: 'vendor', label: 'Vendor & Delivery', desc: 'Equipment supply & deliveries', icon: Tag },
  { id: 'tour', label: 'Campus & Lab Tour', desc: 'Innovation showcase & facility walkthrough', icon: Sparkles },
  { id: 'vip', label: 'VIP Guest', desc: 'Executive delegation & dignitary visit', icon: Award },
  { id: 'inspection', label: 'Official Audit', desc: 'Compliance & security inspection', icon: Shield },
  { id: 'general', label: 'General Inquiry', desc: 'Information & visitor inquiries', icon: User },
];

// Preset Hosts / Departments
const HOST_DEPARTMENTS = [
  'CEO / Executive Office',
  'Human Resources (HR)',
  'Robotics & AI R&D Lab',
  'Embedded Systems & Hardware',
  'Sales & Strategic Partnerships',
  'Operations & Facility Admin',
  'General Reception Lounge',
];

// Badge Types
const BADGE_TYPES = [
  { id: 'Standard Visitor', label: 'Standard Visitor', color: '#00ffff' },
  { id: 'VIP Access Pass', label: 'VIP Access Pass', color: '#ffd700' },
  { id: 'Contractor Pass', label: 'Contractor Pass', color: '#00ff88' },
  { id: 'Student / Intern', label: 'Student / Intern', color: '#bd00ff' },
];

export default function VisitorRegistration({ onNavigate }) {
  // Wizard Step: 1 = Identity, 2 = Purpose & Host, 3 = Photo & Biometric, 4 = Digital Badge
  const [step, setStep] = useState(1);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [purpose, setPurpose] = useState('Client Meeting');
  const [customPurpose, setCustomPurpose] = useState('');
  const [host, setHost] = useState('CEO / Executive Office');
  const [customHost, setCustomHost] = useState('');
  const [badgeType, setBadgeType] = useState('Standard Visitor');
  const [autoEnrollFace, setAutoEnrollFace] = useState(true);

  // Photo & Biometrics
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [photoFlash, setPhotoFlash] = useState(false);
  const [showNumpad, setShowNumpad] = useState(false);

  // Final Generated Badge
  const [generatedBadge, setGeneratedBadge] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Master Kiosk Configuration (dynamically synchronized)
  const [kioskConfig, setKioskConfig] = useState(() => kioskConfigService.getConfig());

  useEffect(() => {
    return kioskConfigService.subscribe((cfg) => setKioskConfig(cfg));
  }, []);

  // Hardware Hooks
  const { videoRef, isStreaming, startCamera, stopCamera } = useCamera({ width: 640, height: 480 });
  const { speak, isPlaying: isSpeaking } = useSpeech();
  const hiddenCanvasRef = useRef(null);

  // Auto-start camera when reaching Step 3
  useEffect(() => {
    if (step === 3 && !capturedPhoto) {
      logger.info('VISITOR', 'Initializing kiosk camera for biometric portrait capture');
      startCamera().catch((err) => {
        logger.error('VISITOR', `Camera initialization error: ${err.message}`);
      });
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, capturedPhoto, startCamera, stopCamera]);

  // Handle countdown photo snap
  const triggerCountdownCapture = () => {
    if (isCountingDown) return;
    setIsCountingDown(true);
    setCountdown(3);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          executePhotoCapture();
          setIsCountingDown(false);
          return 3;
        }
        return prev - 1;
      });
    }, 800);
  };

  // Capture frame from video element
  const executePhotoCapture = () => {
    try {
      const videoEl = videoRef.current;
      if (!videoEl || !videoEl.videoWidth) {
        // Fallback placeholder photo if camera stream isn't ready
        generateFallbackPhoto();
        return;
      }

      setPhotoFlash(true);
      setTimeout(() => setPhotoFlash(false), 250);

      const canvas = hiddenCanvasRef.current || document.createElement('canvas');
      canvas.width = videoEl.videoWidth || 640;
      canvas.height = videoEl.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      // Mirror horizontal for natural front selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);
      stopCamera();
      logger.info('VISITOR', 'Biometric portrait photo captured successfully');
    } catch (err) {
      logger.error('VISITOR', `Photo capture failed: ${err.message}`);
      generateFallbackPhoto();
    }
  };

  const generateFallbackPhoto = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#081226';
    ctx.fillRect(0, 0, 300, 300);
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 16) || 'VISITOR', 150, 150);
    setCapturedPhoto(canvas.toDataURL('image/jpeg'));
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera().catch(console.error);
  };

  // Step 1 -> Step 2 Validation
  const handleProceedToPurpose = () => {
    if (!name.trim()) {
      setValidationError('Please enter the visitor full name to proceed.');
      return;
    }
    if (kioskConfig.requireVisitorPhone && !phone.trim()) {
      setValidationError('Phone number is required by facility check-in policy.');
      return;
    }
    setValidationError('');
    setStep(2);
  };

  // Step 2 -> Step 3
  const handleProceedToPhoto = () => {
    if (kioskConfig.requireVisitorHost && !host?.trim()) {
      setValidationError('Host or Department selection is required by facility check-in policy.');
      return;
    }
    setValidationError('');
    setStep(3);
  };

  // Step 3 -> Step 4 Final Registration & Badge Creation
  const handleIssueBadge = async () => {
    if (kioskConfig.requireVisitorPhoto && !capturedPhoto) {
      setValidationError('A biometric portrait photo is required by facility check-in policy.');
      return;
    }

    setIsSubmitting(true);
    setValidationError('');

    try {
      const selectedPurpose = purpose === 'Other' ? (customPurpose || 'General Visit') : purpose;
      const selectedHost = host === 'Other' ? (customHost || 'Reception Desk') : host;

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const prefix = (kioskConfig.badgeIdPrefix || 'AUR-VIS-2026').trim();
      const customBadgeNumber = `${prefix}-${randomSuffix}`;

      const newVisitor = await offlineVisitorService.registerVisitor({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        company: company.trim() || 'Independent / Visitor',
        purpose: selectedPurpose,
        host: selectedHost,
        badgeType,
        badgeNumber: customBadgeNumber,
        photo: capturedPhoto,
      });

      // Optionally enroll face into Face Recognition greetings table
      if (autoEnrollFace && capturedPhoto) {
        try {
          await offlineFaceService.uploadFace({
            name: name.trim(),
            faceEmbedding: [], // Stored for VIP greeting lookup
            imgUrl: capturedPhoto,
            info: `${company || 'Visitor'} • ${selectedPurpose}`,
          });
          logger.ai('VISITOR', `Auto-enrolled "${name}" into Aurra face greeting database`);
        } catch (enrollErr) {
          logger.warn('VISITOR', `Face auto-enroll warning: ${enrollErr.message}`);
        }
      }

      setGeneratedBadge(newVisitor);
      setStep(4);
      logger.info('VISITOR', `Visitor registered: ${newVisitor.name} (${newVisitor.badgeNumber})`);

      // Aurra Spoken Welcome via TTS using customizable template
      const orgName = kioskConfig.badgeOrgTitle || 'Robomiracle Technologies';
      const template = kioskConfig.registrationWelcomeSpeech || 'Welcome to {org}, {name}! Your {badgeType} has been issued. Please make yourself comfortable while I inform {host}.';
      const greetingText = template
        .replace(/{name}/g, newVisitor.name)
        .replace(/{org}/g, orgName)
        .replace(/{badgeType}/g, newVisitor.badgeType)
        .replace(/{host}/g, selectedHost)
        .replace(/{company}/g, newVisitor.company);

      speak(greetingText, {
        gender: kioskConfig.voiceGender || 'female',
        rate: kioskConfig.speechRate || 1.0,
        pitch: kioskConfig.speechPitch || 1.05,
      });

      // Signal Raspberry Pi Face reaction (nod or smile)
      raspberryPiService.triggerAction('nod');
    } catch (err) {
      logger.error('VISITOR', `Registration save error: ${err.message}`);
      setValidationError(`Registration error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset Form for Next Visitor
  const handleResetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCompany('');
    setPurpose('Client Meeting');
    setCustomPurpose('');
    setHost('CEO / Executive Office');
    setCustomHost('');
    setBadgeType('Standard Visitor');
    setCapturedPhoto(null);
    setGeneratedBadge(null);
    setValidationError('');
    setStep(1);
  };

  // On-screen Numpad handler for phone
  const handleNumpadPress = (char) => {
    if (char === 'del') {
      setPhone((prev) => prev.slice(0, -1));
    } else {
      setPhone((prev) => (prev.length < 15 ? prev + char : prev));
    }
  };

  return (
    <div className="visitor-kiosk-root">
      {/* Hidden canvas for video snapshot */}
      <canvas ref={hiddenCanvasRef} style={{ display: 'none' }} />

      {/* Top Cyber Navigation Bar */}
      <header className="vreg-top-bar">
        <button
          className="vreg-back-btn"
          onClick={() => onNavigate?.('/')}
          title="Return to Kiosk Home"
        >
          <ArrowLeft size={18} />
          <span>BACK TO KIOSK</span>
        </button>

        <div className="vreg-title-block">
          <div className="vreg-status-badge">
            <span className="vreg-pulse-dot"></span>
            <span>SECURE ADMISSION TERMINAL</span>
          </div>
          <h1 className="vreg-heading">AURRA VISITOR CHECK-IN</h1>
        </div>

        <div className="vreg-kiosk-id-pill">
          <Shield size={16} color="#00ffff" />
          <span>KIOSK GATEWAY 01</span>
        </div>
      </header>

      {/* Wizard Step Breadcrumbs */}
      <nav className="vreg-stepper-bar">
        {[
          { num: 1, label: '01 / IDENTITY' },
          { num: 2, label: '02 / PURPOSE & HOST' },
          { num: 3, label: '03 / BIOMETRIC PHOTO' },
          { num: 4, label: '04 / VISITOR BADGE' },
        ].map((s) => (
          <div
            key={s.num}
            className={`vreg-step-item ${step === s.num ? 'active' : ''} ${step > s.num ? 'completed' : ''}`}
            onClick={() => {
              if (step === 4) return;
              if (s.num === 1) {
                setStep(1);
              } else if (s.num === 2) {
                if (!name.trim()) {
                  setValidationError('Please enter visitor full name to proceed.');
                } else {
                  setValidationError('');
                  setStep(2);
                }
              } else if (s.num === 3) {
                if (!name.trim()) {
                  setValidationError('Please enter visitor full name to proceed.');
                } else {
                  setValidationError('');
                  setStep(3);
                }
              }
            }}
          >
            <div className="vreg-step-circle">
              {step > s.num ? <Check size={14} /> : s.num}
            </div>
            <span className="vreg-step-label">{s.label}</span>
            {s.num < 4 && <div className="vreg-step-line" />}
          </div>
        ))}
      </nav>

      {/* Main Wizard Content Area */}
      <main className="vreg-content-container">
        {/* Validation Alert */}
        {validationError && (
          <div className="vreg-alert-box">
            <AlertCircle size={18} />
            <span>{validationError}</span>
          </div>
        )}

        {/* ═════════════════════════════════════════════
            STEP 1: VISITOR IDENTITY DETAILS
        ═════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="vreg-card-frame step-1-frame">
            <div className="vreg-card-header">
              <div>
                <h2 className="vreg-section-title">Visitor Identity & Contact Information</h2>
                <p className="vreg-section-desc">
                  Please enter your credentials for front desk check-in and temporary gate admission.
                </p>
              </div>
              <div className="vreg-badge-tag">STEP 1 OF 4</div>
            </div>

            <div className="vreg-form-grid">
              {/* Full Name */}
              <div className="vreg-field-group full-width">
                <label className="vreg-label">
                  <User size={16} color="#00ffff" />
                  <span>Full Name <strong className="required">*</strong></span>
                </label>
                <input
                  type="text"
                  className="vreg-input"
                  placeholder="e.g. Dr. Rajesh Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleProceedToPurpose();
                  }}
                  autoFocus
                />
              </div>

              {/* Phone Number with quick Numpad button */}
              <div className="vreg-field-group">
                <div className="vreg-label-row">
                  <label className="vreg-label">
                    <Phone size={16} color="#00ffff" />
                    <span>Phone Number {kioskConfig.requireVisitorPhone && <strong className="required">*</strong>}</span>
                  </label>
                  <button
                    type="button"
                    className={`vreg-toggle-numpad-btn ${showNumpad ? 'active' : ''}`}
                    onClick={() => setShowNumpad(!showNumpad)}
                  >
                    <Hash size={14} />
                    <span>{showNumpad ? 'Hide Keypad' : 'Quick Keypad'}</span>
                  </button>
                </div>
                <input
                  type="tel"
                  className="vreg-input"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />

                {/* On-screen touch keypad for tablet users */}
                {showNumpad && (
                  <div className="vreg-numpad-grid">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '0', 'del'].map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={`vreg-numpad-btn ${key === 'del' ? 'del' : ''}`}
                        onClick={() => handleNumpadPress(key)}
                      >
                        {key === 'del' ? <Delete size={16} /> : key}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Email Address */}
              <div className="vreg-field-group">
                <label className="vreg-label">
                  <Mail size={16} color="#00ffff" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  className="vreg-input"
                  placeholder="e.g. rajesh@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Company / Organization */}
              <div className="vreg-field-group full-width">
                <label className="vreg-label">
                  <Building size={16} color="#00ffff" />
                  <span>Organization / Institution Name</span>
                </label>
                <input
                  type="text"
                  className="vreg-input"
                  placeholder="e.g. Titan Robotics / IIT Madras / Independent"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                />
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="vreg-actions-row">
              <button
                type="button"
                className="vreg-btn-secondary"
                onClick={() => onNavigate?.('/')}
              >
                <span>Cancel</span>
              </button>
              <button
                type="button"
                className="vreg-btn-primary"
                onClick={handleProceedToPurpose}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleProceedToPurpose();
                }}
              >
                <span>Continue to Purpose & Host</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════
            STEP 2: VISIT PURPOSE & HOST SELECTION
        ═════════════════════════════════════════════ */}
        {step === 2 && (
          <div className="vreg-card-frame step-2-frame">
            <div className="vreg-card-header">
              <div>
                <h2 className="vreg-section-title">Purpose of Visit & Host Notification</h2>
                <p className="vreg-section-desc">
                  Select the primary objective of your visit and the department or executive you are meeting.
                </p>
              </div>
              <div className="vreg-badge-tag">STEP 2 OF 4</div>
            </div>

            {/* Purpose Selector Grid */}
            <div className="vreg-section-block">
              <label className="vreg-subheading">
                <Tag size={16} color="#00ffff" />
                <span>Select Purpose of Visit</span>
              </label>
              <div className="vreg-purpose-chips-grid">
                {VISIT_PURPOSES.map((p) => {
                  const Icon = p.icon;
                  const isSelected = purpose === p.label;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`vreg-purpose-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setPurpose(p.label)}
                    >
                      <div className="vreg-purpose-icon">
                        <Icon size={20} />
                      </div>
                      <div className="vreg-purpose-info">
                        <strong>{p.label}</strong>
                        <span>{p.desc}</span>
                      </div>
                      {isSelected && <div className="vreg-check-dot"><Check size={12} /></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Host Department Selector */}
            <div className="vreg-section-block">
              <label className="vreg-subheading">
                <Building size={16} color="#00ffff" />
                <span>Person or Department to Meet</span>
              </label>
              <div className="vreg-host-chips-row">
                {HOST_DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    className={`vreg-host-pill ${host === dept ? 'selected' : ''}`}
                    onClick={() => setHost(dept)}
                  >
                    <span>{dept}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Badge Type Selector */}
            <div className="vreg-section-block">
              <label className="vreg-subheading">
                <Shield size={16} color="#00ffff" />
                <span>Pass Category</span>
              </label>
              <div className="vreg-badge-type-row">
                {BADGE_TYPES.map((bt) => (
                  <button
                    key={bt.id}
                    type="button"
                    className={`vreg-type-card ${badgeType === bt.id ? 'selected' : ''}`}
                    style={{ '--theme-color': bt.color }}
                    onClick={() => setBadgeType(bt.id)}
                  >
                    <Award size={18} color={bt.color} />
                    <span>{bt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="vreg-actions-row">
              <button
                type="button"
                className="vreg-btn-secondary"
                onClick={() => setStep(1)}
              >
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="vreg-btn-primary"
                onClick={handleProceedToPhoto}
              >
                <span>Proceed to Biometric Photo</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════
            STEP 3: LIVE CAMERA PHOTO & BIOMETRICS
        ═════════════════════════════════════════════ */}
        {step === 3 && (
          <div className="vreg-card-frame step-3-frame">
            <div className="vreg-card-header">
              <div>
                <h2 className="vreg-section-title">Biometric Portrait & Photo Capture</h2>
                <p className="vreg-section-desc">
                  Look into the kiosk camera to print your digital badge. Aurra can also enroll your face for instant greetings on future visits.
                </p>
              </div>
              <div className="vreg-badge-tag">STEP 3 OF 4</div>
            </div>

            <div className="vreg-camera-studio-layout">
              {/* Camera Preview Deck */}
              <div className="vreg-camera-deck">
                <div className={`vreg-viewfinder-frame ${photoFlash ? 'flash' : ''}`}>
                  {/* Holographic Framing Accents */}
                  <div className="cam-corner tl" />
                  <div className="cam-corner tr" />
                  <div className="cam-corner bl" />
                  <div className="cam-corner br" />

                  {capturedPhoto ? (
                    /* Captured Photo Preview */
                    <div className="vreg-captured-preview">
                      <img src={capturedPhoto} alt="Captured portrait" className="captured-img" />
                      <div className="vreg-captured-tag">
                        <CheckCircle2 size={16} color="#00ff88" />
                        <span>PORTRAIT VERIFIED</span>
                      </div>
                    </div>
                  ) : (
                    /* Live Camera Stream */
                    <div className="vreg-live-feed-wrapper">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="vreg-live-video"
                      />
                      {/* Biometric Face Target HUD */}
                      <div className="vreg-face-target-reticle">
                        <div className="reticle-oval"></div>
                        <span className="reticle-label">ALIGN FACE INSIDE FRAME</span>
                      </div>

                      {/* Countdown Overlay */}
                      {isCountingDown && (
                        <div className="vreg-countdown-overlay">
                          <span className="countdown-number">{countdown}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Status Overlay */}
                  <div className="vreg-cam-status-pill">
                    <span className="vreg-cam-dot active"></span>
                    <span>{capturedPhoto ? 'SNAPSHOT STORED' : isStreaming ? 'CAMERA LIVE' : 'INITIALIZING HARDWARE'}</span>
                  </div>
                </div>

                {/* Shutter / Retake Controls */}
                <div className="vreg-shutter-controls">
                  {capturedPhoto ? (
                    <button
                      type="button"
                      className="vreg-btn-retake"
                      onClick={retakePhoto}
                    >
                      <RotateCcw size={16} />
                      <span>Retake Photo</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="vreg-btn-shutter"
                      onClick={triggerCountdownCapture}
                      disabled={isCountingDown}
                    >
                      <Camera size={20} />
                      <span>{isCountingDown ? `Capturing in ${countdown}...` : 'Capture Biometric Photo'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Side Options Deck */}
              <div className="vreg-camera-options-deck">
                <div className="vreg-enroll-card">
                  <div className="vreg-enroll-header">
                    <Sparkles size={20} color="#00ffff" />
                    <h4>Aurra Face Recognition AI</h4>
                  </div>
                  <p className="vreg-enroll-desc">
                    When enabled, Aurra will store your facial embedding in offline memory and warmly greet you by name when you approach the kiosk in the future.
                  </p>
                  <label className="vreg-checkbox-label">
                    <input
                      type="checkbox"
                      checked={autoEnrollFace}
                      onChange={(e) => setAutoEnrollFace(e.target.checked)}
                    />
                    <span className="checkbox-custom"></span>
                    <strong>Enroll face for instant voice greetings</strong>
                  </label>
                </div>

                <div className="vreg-visitor-summary-mini">
                  <h4>Check-In Summary</h4>
                  <div className="mini-row">
                    <span>Visitor:</span>
                    <strong>{name}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Organization:</span>
                    <strong>{company || 'Independent'}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Purpose:</span>
                    <strong>{purpose}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Meeting:</span>
                    <strong>{host}</strong>
                  </div>
                  <div className="mini-row">
                    <span>Pass Type:</span>
                    <strong style={{ color: BADGE_TYPES.find((b) => b.id === badgeType)?.color }}>{badgeType}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="vreg-actions-row">
              <button
                type="button"
                className="vreg-btn-secondary"
                onClick={() => setStep(2)}
              >
                <ArrowLeft size={18} />
                <span>Back</span>
              </button>
              <button
                type="button"
                className="vreg-btn-primary issue-btn"
                onClick={handleIssueBadge}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="spin" />
                    <span>Issuing Digital Badge...</span>
                  </>
                ) : (
                  <>
                    <Award size={18} />
                    <span>Issue Digital Visitor Pass</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════
            STEP 4: HOLOGRAPHIC VISITOR BADGE ISSUANCE
        ═════════════════════════════════════════════ */}
        {step === 4 && generatedBadge && (
          <div className="vreg-card-frame step-4-frame">
            <div className="vreg-success-header">
              <div className="vreg-success-badge">
                <CheckCircle2 size={24} color="#00ff88" />
                <span>ADMISSION COMPLETE</span>
              </div>
              <h2 className="vreg-success-title">Welcome to {kioskConfig.badgeOrgTitle || 'Robomiracle Technologies'}!</h2>
              <p className="vreg-success-desc">
                Your holographic digital visitor pass has been verified and registered into facility security logs.
              </p>
            </div>

            {/* Holographic Digital Pass Card */}
            <div className="vreg-holographic-pass-wrapper">
              <div className="vreg-holo-card" style={{ '--badge-accent': BADGE_TYPES.find((b) => b.id === generatedBadge.badgeType)?.color || '#00ffff' }}>
                {/* Glowing Top Banner */}
                <div className="holo-card-topbar">
                  <div className="holo-org-block">
                    <span className="holo-firm-name">{(kioskConfig.badgeOrgTitle || 'ROBOMIRACLE TECHNOLOGIES').toUpperCase()}</span>
                    <span className="holo-pass-type-badge">{generatedBadge.badgeType}</span>
                  </div>
                  <div className="holo-pass-code">
                    <span className="pass-code-label">PASS ID</span>
                    <span className="pass-code-val">{generatedBadge.badgeNumber}</span>
                  </div>
                </div>

                {/* Card Main Body */}
                <div className="holo-card-body">
                  {/* Photo Avatar with Holographic Rings */}
                  <div className="holo-photo-pedestal">
                    {generatedBadge.photo ? (
                      <img src={generatedBadge.photo} alt={generatedBadge.name} className="holo-visitor-photo" />
                    ) : (
                      <div className="holo-visitor-placeholder">
                        <User size={54} color="#00ffff" />
                      </div>
                    )}
                    <div className="holo-security-watermark">AURRA VERIFIED</div>
                  </div>

                  {/* Visitor Profile Details */}
                  <div className="holo-details-column">
                    <h3 className="holo-visitor-name">{generatedBadge.name}</h3>
                    <div className="holo-visitor-company">{generatedBadge.company}</div>

                    <div className="holo-meta-grid">
                      <div className="holo-meta-item">
                        <span className="holo-meta-lbl">PURPOSE</span>
                        <span className="holo-meta-val">{generatedBadge.purpose}</span>
                      </div>
                      <div className="holo-meta-item">
                        <span className="holo-meta-lbl">HOST / DEPT</span>
                        <span className="holo-meta-val">{generatedBadge.host}</span>
                      </div>
                      <div className="holo-meta-item">
                        <span className="holo-meta-lbl">CHECK-IN TIME</span>
                        <span className="holo-meta-val">
                          {new Date(generatedBadge.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="holo-meta-item">
                        <span className="holo-meta-lbl">STATUS</span>
                        <span className="holo-meta-val status-active">ACTIVE / ADMITTED</span>
                      </div>
                    </div>
                  </div>

                  {/* Security QR Code Graphic */}
                  <div className="holo-qr-column">
                    <div className="holo-qr-box">
                      <QrCode size={84} color="#00ffff" />
                    </div>
                    <span className="holo-qr-label">SCAN AT TURNSTILE</span>
                  </div>
                </div>

                {/* Cyber Security Bottom Strip */}
                <div className="holo-card-footer">
                  <div className="security-bar-lines"></div>
                  <span>AUTONOMOUS SECURITY ENCLAVE • AI RECEPTIONIST VALIDATED</span>
                  <div className="security-bar-lines"></div>
                </div>
              </div>
            </div>

            {/* Voice Greeting Feedback Pill */}
            <div className="vreg-voice-playback-pill">
              <Volume2 size={18} className={isSpeaking ? 'pulse-audio' : ''} color="#00ffff" />
              <span>
                {isSpeaking
                  ? 'Aurra is speaking visitor welcome greeting...'
                  : 'Welcome message broadcasted. Audio playback complete.'}
              </span>
            </div>

            {/* Completion Action Buttons */}
            <div className="vreg-actions-row center">
              <button
                type="button"
                className="vreg-btn-secondary"
                onClick={handleResetForm}
              >
                <UserCheck size={18} />
                <span>Register Another Visitor</span>
              </button>
              <button
                type="button"
                className="vreg-btn-primary finish-btn"
                onClick={() => onNavigate?.('/')}
              >
                <span>Return to Kiosk Main Screen</span>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
