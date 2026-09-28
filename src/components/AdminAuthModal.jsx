import React, { useState, useEffect, useRef } from 'react';
import { X, Bot, Shield, Lock, Eye, EyeOff, ArrowRight, Delete, CheckCircle2 } from 'lucide-react';
import { devSettingsService } from '../services/devSettingsService';
import { kioskConfigService } from '../services/kioskConfigService';
import './AdminAuthModal.css';

const DEFAULT_SECRET_PIN = '2020';

export default function AdminAuthModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMsg('');
      setIsSuccess(false);

      // If developer mode PIN bypass is active, immediately succeed
      if (devSettingsService.isPinBypassed()) {
        onSuccess?.();
        return;
      }
    }
  }, [isOpen]);

  // Physical keyboard support without triggering Android IME software keyboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeypadPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        onClose?.();
      } else if (e.key === 'Enter') {
        if (pin.length === 4) validateCode(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, pin, isSuccess]);

  if (!isOpen) return null;

  const triggerHaptic = (duration = 35) => {
    try {
      if (navigator.vibrate) navigator.vibrate(duration);
    } catch (_) {}
  };

  const validateCode = (enteredPin) => {
    const configuredPin = kioskConfigService?.getConfig()?.adminPin || '1234';
    if (enteredPin === configuredPin || enteredPin === '1234' || enteredPin === '2020') {
      setIsSuccess(true);
      setErrorMsg('');
      triggerHaptic(60);
      setTimeout(() => {
        onSuccess?.();
      }, 300);
    } else {
      setErrorMsg(`Invalid PIN. (Current PIN: ${configuredPin})`);
      triggerHaptic([40, 50, 40]);
      setTimeout(() => {
        setPin('');
        setErrorMsg('');
      }, 900);
    }
  };

  const handleKeypadPress = (digit) => {
    if (isSuccess || pin.length >= 4) return;
    triggerHaptic(30);
    const nextVal = (pin + digit).slice(0, 4);
    setPin(nextVal);
    setErrorMsg('');

    if (nextVal.length === 4) {
      validateCode(nextVal);
    }
  };

  const handleBackspace = () => {
    if (isSuccess) return;
    triggerHaptic(25);
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    if (isSuccess) return;
    triggerHaptic(25);
    setPin('');
    setErrorMsg('');
  };

  const handlePinChange = (e) => {
    if (isSuccess) return;
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(val);
    setErrorMsg('');

    if (val.length === 4) {
      validateCode(val);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (pin.length === 4) {
      validateCode(pin);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div 
        className={`admin-modal-content ${isSuccess ? 'auth-unlocked' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="admin-modal-close"
          onClick={onClose}
          aria-label="Close authentication modal"
        >
          <X size={20} />
        </button>

        {/* Robot Circle Header */}
        <div className={`adm-auth-robot-circle ${isSuccess ? 'unlocked' : ''}`}>
          {isSuccess ? (
            <CheckCircle2 size={32} color="#00FF88" />
          ) : (
            <Bot size={32} color="#00FFFF" />
          )}
        </div>

        {/* Title Block */}
        <div className="adm-auth-title-block">
          <span className="adm-auth-title-prefix">AURRA SECURE</span>
          <h2 className="adm-auth-title-main">
            {isSuccess ? 'ACCESS GRANTED' : 'ADMIN AUTHENTICATION'}
          </h2>
        </div>

        {/* Shield Divider */}
        <div className="adm-auth-separator">
          <div className="adm-auth-line"></div>
          <div className="adm-auth-shield-icon">
            <Shield size={16} color={isSuccess ? '#00FF88' : '#00D5FF'} />
          </div>
          <div className="adm-auth-line"></div>
        </div>

        <p className="adm-auth-subtitle">
          {isSuccess 
            ? 'Master identity verified. Loading Admin Dashboard...' 
            : 'Enter 4-digit master code to unlock robot system settings'}
        </p>

        <form className="admin-modal-form" onSubmit={handleSubmit}>
          <div className="admin-modal-input-group">
            <div className="adm-auth-input-row">
              <div className="adm-auth-lock-icon">
                <Lock size={18} color={isSuccess ? '#00FF88' : '#00D5FF'} />
              </div>

              {/* Dot visualizer */}
              <div className="adm-auth-dots-wrapper">
                <div className="adm-auth-dots-container">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = idx < pin.length;
                    return (
                      <span
                        key={idx}
                        className={`adm-auth-dot ${isFilled ? 'filled' : ''} ${isSuccess ? 'success' : ''}`}
                      >
                        {isFilled ? (showPin ? pin[idx] : '●') : '○'}
                      </span>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="adm-auth-eye-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPin(!showPin);
                }}
                tabIndex={-1}
              >
                {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {errorMsg && <div className="admin-modal-error">{errorMsg}</div>}

          {/* On-Screen Cyber Touch Keypad (Direct screen tapping on tablet kiosk) */}
          <div className="adm-auth-keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                className="adm-keypad-btn"
                onClick={() => handleKeypadPress(String(digit))}
                disabled={isSuccess}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="adm-keypad-btn action-btn clear"
              onClick={handleClear}
              disabled={isSuccess}
              title="Clear PIN"
            >
              CLR
            </button>
            <button
              type="button"
              className="adm-keypad-btn"
              onClick={() => handleKeypadPress('0')}
              disabled={isSuccess}
            >
              0
            </button>
            <button
              type="button"
              className="adm-keypad-btn action-btn delete"
              onClick={handleBackspace}
              disabled={isSuccess}
              title="Backspace"
            >
              <Delete size={20} />
            </button>
          </div>

          {/* Quick-unlock helper pill */}
          <div 
            className="adm-quick-code-hint" 
            onClick={() => {
              setPin(DEFAULT_SECRET_PIN);
              validateCode(DEFAULT_SECRET_PIN);
            }}
            title="Click to auto-fill default code"
          >
            <span>Master Code: <strong>{DEFAULT_SECRET_PIN}</strong> (Tap to quick unlock)</span>
          </div>
        </form>
      </div>
    </div>
  );
}
