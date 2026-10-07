import React, { useState, useEffect } from 'react';
import { pub } from '../utils/publicAsset';
import './AurraStartupSplashScreen.css';

export const DEFAULT_SPLASH_CALIBRATION = {
  chestX: 71.0,
  chestY: 62.5,
  chestW: 11.5,
  chestH: 14.5,
  chestTilt: 3.5,
  chestRadius: 14,
  chestScale: 100,
};

export const getSplashCalibration = () => {
  try {
    const saved = localStorage.getItem('aurra_splash_calibration');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.chestTilt < 0 || parsed.chestX < 70) {
        return DEFAULT_SPLASH_CALIBRATION;
      }
      return { ...DEFAULT_SPLASH_CALIBRATION, ...parsed };
    }
  } catch (e) {
    console.warn('[Splash] Error reading calibration:', e);
  }
  return DEFAULT_SPLASH_CALIBRATION;
};

export const saveSplashCalibration = (calib) => {
  try {
    localStorage.setItem('aurra_splash_calibration', JSON.stringify(calib));
  } catch (e) {
    console.error('[Splash] Error saving calibration:', e);
  }
};

export const getTiltedPolygonClipPath = (calib) => {
  const cx = calib.chestX + calib.chestW / 2;
  const cy = calib.chestY + calib.chestH / 2;
  const halfW = calib.chestW / 2;
  const halfH = calib.chestH / 2;

  const rad = (calib.chestTilt || 0) * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { u: -halfW, v: -halfH }, // Top-Left
    { u: halfW, v: -halfH },  // Top-Right
    { u: halfW, v: halfH },   // Bottom-Right
    { u: -halfW, v: halfH },  // Bottom-Left
  ];

  const rotatedPoints = corners.map((c) => {
    const rx = c.u * cos - c.v * sin;
    const ry = c.u * sin + c.v * cos;
    return `${(cx + rx).toFixed(2)}% ${(cy + ry).toFixed(2)}%`;
  });

  return `polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, ${rotatedPoints.join(', ')}, ${rotatedPoints[0]})`;
};

export const updateRootCssVariables = (calib) => {
  const root = document.documentElement;
  root.style.setProperty('--chest-x', `${calib.chestX}%`);
  root.style.setProperty('--chest-y', `${calib.chestY}%`);
  root.style.setProperty('--chest-w', `${calib.chestW}%`);
  root.style.setProperty('--chest-h', `${calib.chestH}%`);
  root.style.setProperty('--chest-tilt', `${calib.chestTilt}deg`);
  root.style.setProperty('--chest-radius', `${calib.chestRadius}px`);
  root.style.setProperty('--chest-scale-factor', `${(calib.chestScale || 100) / 100}`);
  root.style.setProperty('--chest-clip-path', getTiltedPolygonClipPath(calib));
};

export const AurraStartupSplashScreen = ({ bootPhase, onPhaseChange, onComplete }) => {
  const [progress, setProgress] = useState(15);
  const [calib] = useState(getSplashCalibration);

  useEffect(() => {
    updateRootCssVariables(calib);
  }, [calib]);

  useEffect(() => {
    window.__aurra_boot_active = true;
    let currentProgress = 15;

    const steps = [35, 60, 80, 95, 100];
    let stepIndex = 0;

    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        currentProgress = steps[stepIndex];
        setProgress(currentProgress);
        stepIndex++;
      } else {
        clearInterval(interval);

        // Verify Real Application First Screen is Painted before opening aperture
        const checkAppReadiness = () => {
          const appRoot = document.querySelector('.aurra-app-root') || 
                          document.querySelector('.home-container') || 
                          document.querySelector('.kiosk-app-root');
          if (appRoot) {
            // Double rAF sync to ensure browser completed paint frame
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Phase 3: Reveal Real App inside Chest Display Screen
                if (onPhaseChange) onPhaseChange('glowing');

                // Phase 4: Expansion animation from chest to fullscreen after 400ms hold
                setTimeout(() => {
                  if (onPhaseChange) onPhaseChange('expanding');

                  // Phase 5: Handoff completion after 2.4s GPU expansion duration
                  setTimeout(() => {
                    window.__aurra_boot_active = false;
                    window.__aurra_boot_complete = true;
                    window.dispatchEvent(new Event('aurra_boot_completed'));
                    if (onComplete) onComplete();
                  }, 2400);
                }, 400);
              });
            });
          } else {
            // Fallback retry if DOM paint delayed
            setTimeout(checkAppReadiness, 50);
          }
        };

        checkAppReadiness();
      }
    }, 450);

    return () => clearInterval(interval);
  }, [onPhaseChange, onComplete]);

  const isGlowing = bootPhase === 'glowing' || bootPhase === 'expanding';
  const isExpanding = bootPhase === 'expanding';

  return (
    <div
      className={`aurra-portal-splash-root ${isExpanding ? 'splash-fading' : ''}`}
      style={{
        '--chest-x': `${calib.chestX}%`,
        '--chest-y': `${calib.chestY}%`,
        '--chest-w': `${calib.chestW}%`,
        '--chest-h': `${calib.chestH}%`,
        '--chest-tilt': `${calib.chestTilt}deg`,
        '--chest-radius': `${calib.chestRadius}px`,
      }}
    >
      {/* Fullscreen Canvas Wrapper for Edge-to-Edge Display */}
      <div className="splash-aspect-wrapper">
        {/* Full Approved Aurra Robot Background Image with transparent chest aperture */}
        <img
          src={pub('aurra_splash_approved.png')}
          alt="Aurra Splash Screen"
          className={`splash-bg-image splash-has-aperture ${isExpanding ? 'splash-scale-out' : ''}`}
          style={{
            clipPath: getTiltedPolygonClipPath(calib),
            WebkitClipPath: getTiltedPolygonClipPath(calib),
          }}
          onError={(e) => {
            console.warn('[Splash] Loading fallback splash asset');
            if (e.target.src.includes('aurra_splash_approved')) {
              e.target.src = pub('aurra_splash_approved_hd.png');
            } else {
              e.target.src = './aurra_splash_approved.png';
            }
          }}
        />

        {/* Dynamic Progress Indicator Overlay (Left Side under Tagline) */}
        <div className={`splash-loading-overlay ${isExpanding ? 'fade-fast' : ''}`}>
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              style={{ width: `${progress}%` }}
            >
              <div className="splash-progress-dot" />
            </div>
          </div>
          <span className="splash-loading-text">
            {/* INITIALIZING AUTONOMOUS SYSTEMS... */}
          </span>
        </div>

        {/* Chest Display Portal Frame with Black Percentage Counter Centered Inside Chest */}
        <div
          className={`chest-portal-bezel ${isGlowing ? 'bezel-glow' : ''} ${
            isExpanding ? 'portal-fullscreen' : ''
          }`}
        >
          {!isGlowing && (
            <div className="chest-loading-counter">
              <span className="chest-percentage-text">{progress}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AurraStartupSplashScreen;
