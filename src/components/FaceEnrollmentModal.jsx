import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, CameraOff, Upload, Check, AlertCircle, RotateCcw, UserPlus } from 'lucide-react';
import * as faceapi from 'face-api.js';
import { facesApi } from '../api/faces';
import './FaceEnrollmentModal.css';

export const FaceEnrollmentModal = ({ isOpen, onClose, onUserRegistered, videoEl }) => {
  const [name, setName] = useState('');
  const [info, setInfo] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [faceCheckStatus, setFaceCheckStatus] = useState(null); // 'checking' | 'detected' | 'not-detected' | null
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [localStream, setLocalStream] = useState(null);

  const modalVideoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Initialize live camera inside the modal
  const startModalCamera = useCallback(async () => {
    try {
      // 1. Try reusing existing stream from parent videoEl
      if (videoEl && videoEl.srcObject && videoEl.srcObject.active) {
        if (modalVideoRef.current) {
          modalVideoRef.current.srcObject = videoEl.srcObject;
          await modalVideoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
        return;
      }

      // 2. Otherwise request fresh userMedia stream
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        });
        setLocalStream(stream);
        if (modalVideoRef.current) {
          modalVideoRef.current.srcObject = stream;
          await modalVideoRef.current.play().catch(() => {});
        }
        setIsCameraActive(true);
      }
    } catch (err) {
      console.warn('Could not start modal camera stream:', err);
      setIsCameraActive(false);
    }
  }, [videoEl]);

  // Stop local camera stream if allocated
  const stopModalCamera = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    if (modalVideoRef.current) {
      modalVideoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, [localStream]);

  // When modal opens, start camera and reset states
  useEffect(() => {
    if (isOpen) {
      setFeedback(null);
      setFaceCheckStatus(null);
      setPreviewUrl('');
      setSelectedFile(null);
      setIsCameraActive(true);
      // Short delay to allow modal DOM mounting
      const timer = setTimeout(() => {
        startModalCamera();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      stopModalCamera();
    }
  }, [isOpen, startModalCamera, stopModalCamera]);

  if (!isOpen) return null;

  // Snap photo from the live camera stream
  const handleSnapPhoto = async () => {
    setFeedback(null);
    const activeVideo = modalVideoRef.current || videoEl;

    if (!activeVideo || activeVideo.readyState < 2) {
      setFeedback({ type: 'error', message: 'Camera feed not ready to snap. Please wait 1 second.' });
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = activeVideo.videoWidth || 640;
      canvas.height = activeVideo.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(activeVideo, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setPreviewUrl(dataUrl);

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        setSelectedFile(file);

        // Quick client-side face check so user knows immediately if face is clear
        setFaceCheckStatus('checking');
        try {
          const img = new Image();
          img.src = dataUrl;
          await new Promise((r) => { img.onload = r; });
          const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }));
          if (detection) {
            setFaceCheckStatus('detected');
          } else {
            setFaceCheckStatus('not-detected');
          }
        } catch {
          setFaceCheckStatus(null);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.error('Snapshot capture error:', err);
      setFeedback({ type: 'error', message: 'Error capturing photo: ' + err.message });
    }
  };

  // Retake photo: clears frozen preview and restarts live camera view
  const handleRetake = () => {
    setPreviewUrl('');
    setSelectedFile(null);
    setFaceCheckStatus(null);
    setFeedback(null);
    setIsCameraActive(true);
    setTimeout(() => {
      startModalCamera();
    }, 50);
  };

  // Handle file upload
  const handleFileChange = async (e) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
        setFaceCheckStatus('checking');
        const img = new Image();
        img.src = reader.result;
        img.onload = async () => {
          try {
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }));
            setFaceCheckStatus(detection ? 'detected' : 'not-detected');
          } catch {
            setFaceCheckStatus(null);
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  // Enroll face logic (supports adding another user without closing)
  const handleEnroll = async (andAddAnother = false) => {
    if (!name.trim()) {
      setFeedback({ type: 'error', message: 'Please enter the person’s full name.' });
      return;
    }
    if (!selectedFile) {
      setFeedback({ type: 'error', message: 'Please snap a live photo or choose an image file first.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('info', info.trim());
      formData.append('img', selectedFile);

      await facesApi.registerUser(formData);
      onUserRegistered?.();

      const enrolledName = name.trim();

      if (andAddAnother) {
        // Reset form for next user but KEEP modal open with live camera ready
        setName('');
        setInfo('');
        setPreviewUrl('');
        setSelectedFile(null);
        setFaceCheckStatus(null);
        setFeedback({
          type: 'success',
          message: `✅ "${enrolledName}" enrolled successfully! Ready to enroll the next face.`,
        });
        setIsCameraActive(true);
        setTimeout(() => {
          startModalCamera();
        }, 50);
      } else {
        onClose();
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      const msg = err.response?.data?.error || err.message || 'Face detection failed. Ensure face is clearly visible and well-lit.';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="enrollment-overlay">
      <div className="enrollment-card">
        {/* Header */}
        <div className="enrollment-header">
          <h2 className="enrollment-title">
            <UserPlus size={18} color="#00ffff" /> Enroll Face For Greeting
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Live Camera Box or Frozen Snapshot */}
        <div className="camera-preview-box">
          {previewUrl ? (
            <img src={previewUrl} alt="Captured Snapshot" className="modal-snapshot-img" />
          ) : (
            <>
              <video
                ref={modalVideoRef}
                autoPlay
                muted
                playsInline
                className="modal-live-video"
              />
              <div className="face-guide-oval" />
              <div className="live-badge">
                <span className="live-pulse" /> LIVE CAMERA
              </div>
            </>
          )}
        </div>

        {/* Live Snap / Retake / Upload Controls */}
        <div className="camera-controls-row">
          {!previewUrl ? (
            <>
              <button type="button" className="snap-btn" onClick={handleSnapPhoto}>
                <Camera size={18} /> Snap Photo
              </button>

              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => {
                  if (isCameraActive) {
                    stopModalCamera();
                  } else {
                    startModalCamera();
                  }
                }}
              >
                {isCameraActive ? <CameraOff size={15} /> : <Camera size={15} />}
                {isCameraActive ? 'Pause' : 'Open Camera'}
              </button>

              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> Upload
              </button>
            </>
          ) : (
            <>
              <button type="button" className="action-btn-secondary" onClick={handleRetake}>
                <RotateCcw size={15} /> Retake Photo
              </button>

              <button
                type="button"
                className="action-btn-secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> Choose Another
              </button>
            </>
          )}

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Face Check Live Badge */}
        {faceCheckStatus === 'checking' && (
          <div style={{ fontSize: 12, color: '#eab308', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>⏳ Analyzing face alignment...</span>
          </div>
        )}
        {faceCheckStatus === 'detected' && (
          <div style={{ fontSize: 12, color: '#22c55e', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={14} /> <span>Face detected clearly! Ready to enroll.</span>
          </div>
        )}
        {faceCheckStatus === 'not-detected' && (
          <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={14} /> <span>No face detected in photo. Please retake facing camera.</span>
          </div>
        )}

        {/* Form Inputs */}
        <div className="form-group">
          <label>Person's Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Ragunath, Alex, Sara..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-group">
          <label>Role / Note (Optional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Lead Engineer, VIP Guest..."
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div className={`feedback-toast ${feedback.type}`}>
            {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Multi-User Enrollment Action Buttons */}
        <div className="submit-row">
          <button
            type="button"
            className="submit-btn-another"
            disabled={isSubmitting || !selectedFile}
            onClick={() => handleEnroll(true)}
            title="Saves this user and immediately opens camera for the next person"
          >
            {isSubmitting ? 'Saving...' : '+ Enroll Another'}
          </button>

          <button
            type="button"
            className="submit-btn-primary"
            disabled={isSubmitting || !selectedFile}
            onClick={() => handleEnroll(false)}
          >
            {isSubmitting ? 'Saving...' : 'Enroll & Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
