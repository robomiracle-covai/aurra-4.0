/**
 * Speaking Animatronics & Hardware Gestures for Aurra
 * 
 * Synchronizes:
 * - Raspberry Pi Expression Engine (HDMI Face Reactions: 'speaking' / 'idle')
 * - ESP32 5-Axis Animatronic Servos (Dynamic natural speech gestures)
 * 
 * Fully non-blocking to maintain locked 90 FPS rendering.
 */

import { esp32Service } from '../services/esp32Service';
import { raspberryPiService } from '../services/raspberryPiService';

let animatronicTimer = null;
let isSpeakingAnimatronicsActive = false;

// Pre-configured dynamic conversational gesture presets for 5 servos
const CONVERSATIONAL_GESTURES = [
  [90, 110, 45, 90, 85],   // Gesture 1: Right hand gesture + head tilt
  [75, 50, 120, 95, 95],   // Gesture 2: Expressive dual-hand open pose
  [105, 130, 60, 85, 75],  // Gesture 3: Emphatic left-hand point + head nod
  [90, 80, 100, 90, 90],   // Gesture 4: Subtle conversation movement
  [85, 100, 75, 100, 105], // Gesture 5: Warm posture shift
];

/**
 * Triggers a random dynamic servo gesture non-blockingly.
 */
export const triggerRandomSpeechGesture = () => {
  try {
    const randomIndex = Math.floor(Math.random() * CONVERSATIONAL_GESTURES.length);
    const gestureAngles = CONVERSATIONAL_GESTURES[randomIndex];

    gestureAngles.forEach((angle, index) => {
      esp32Service.setServoAngle(index, angle);
    });
  } catch {
    /* non-blocking */
  }
};

/**
 * Starts automatic animatronic servo movement loop and Raspberry Pi expression when robot speaks.
 */
export const startSpeakingAnimatronics = () => {
  if (isSpeakingAnimatronicsActive) return;
  
  // Guard: If neither ESP32 nor Raspberry Pi is online, do NOT fire background HTTP requests
  if (!esp32Service.online && !raspberryPiService.online) {
    return;
  }

  isSpeakingAnimatronicsActive = true;

  // Dispatch 'speaking' expression to Raspberry Pi HDMI display
  if (raspberryPiService.online) {
    raspberryPiService.sendExpression('speaking');
  }

  // Trigger initial natural gesture immediately if ESP32 is online
  if (esp32Service.online) {
    triggerRandomSpeechGesture();
  }

  // Cycle gestures every 1.8s while speaking (smooth pacing)
  if (animatronicTimer) clearInterval(animatronicTimer);
  animatronicTimer = setInterval(() => {
    if (!isSpeakingAnimatronicsActive) {
      if (animatronicTimer) clearInterval(animatronicTimer);
      animatronicTimer = null;
      return;
    }
    if (esp32Service.online) {
      triggerRandomSpeechGesture();
    }
  }, 1800);
};

/**
 * Stops animatronic movements, sends 'idle' expression to Raspberry Pi,
 * and resets all 5 servos to neutral position (90°).
 */
export const stopSpeakingAnimatronics = () => {
  if (!isSpeakingAnimatronicsActive) return;
  isSpeakingAnimatronicsActive = false;
  if (animatronicTimer) {
    clearInterval(animatronicTimer);
    animatronicTimer = null;
  }

  // Dispatch 'idle' expression to Raspberry Pi HDMI display only if online
  if (raspberryPiService.online) {
    raspberryPiService.sendExpression('idle');
  }

  // Smoothly return all 5 servos to neutral position (90°) only if online
  if (esp32Service.online) {
    try {
      [90, 90, 90, 90, 90].forEach((angle, index) => {
        esp32Service.setServoAngle(index, angle);
      });
    } catch {
      /* non-blocking */
    }
  }
};
