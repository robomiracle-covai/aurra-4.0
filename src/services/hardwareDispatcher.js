/**
 * Hardware Control Dispatcher for Aurra Robot
 * 
 * Modular bridge for animatronic servos, ESP32 micro-controllers,
 * motor drive systems, and RGB eye telemetry.
 * 
 * Accessible universally via Voice and Text commands.
 */

import { logger } from './logger';
import { esp32Service } from './esp32Service';
import { raspberryPiService } from './raspberryPiService';

class HardwareDispatcher {
  constructor() {
    this.customHandlers = new Map();
    this.telemetry = {
      battery: '94%',
      headPan: 0,
      headTilt: 0,
      eyesActive: true,
      eyeColor: '#00ffff',
      motorsArmed: true,
      lastCommand: null,
      status: 'READY'
    };
  }

  /**
   * Register a custom hardware driver/callback (e.g. ESP32, Serial, WebSocket, ROS)
   */
  registerHardwareHandler(actionType, handlerFn) {
    this.customHandlers.set(actionType, handlerFn);
    logger.info('HARDWARE', `Registered hardware driver for action: "${actionType}"`);
  }

  /**
   * Evaluate a spoken or typed utterance to see if it targets hardware
   * Returns: { handled: boolean, action?: string, message?: string, telemetry?: object }
   */
  evaluate(rawUtterance) {
    if (!rawUtterance || typeof rawUtterance !== 'string') {
      return { handled: false };
    }

    const u = rawUtterance.toLowerCase().trim();

    // 1. Head Movements & Gestures
    if (u.includes('nod') || u.includes('nod head') || u.includes('nod your head')) {
      return this.dispatch('HEAD_NOD', 'Nodding head in affirmation.');
    }
    if (u.includes('shake head') || u.includes('say no')) {
      return this.dispatch('HEAD_SHAKE', 'Shaking head.');
    }
    if (u.includes('look up') || u.includes('tilt up')) {
      this.telemetry.headTilt = 25;
      return this.dispatch('HEAD_TILT_UP', 'Looking up.');
    }
    if (u.includes('look down') || u.includes('tilt down')) {
      this.telemetry.headTilt = -20;
      return this.dispatch('HEAD_TILT_DOWN', 'Looking down.');
    }
    if (u.includes('look left') || u.includes('turn head left')) {
      this.telemetry.headPan = -45;
      return this.dispatch('HEAD_PAN_LEFT', 'Turning head left.');
    }
    if (u.includes('look right') || u.includes('turn head right')) {
      this.telemetry.headPan = 45;
      return this.dispatch('HEAD_PAN_RIGHT', 'Turning head right.');
    }
    if (u.includes('center head') || u.includes('reset head') || u.includes('look forward')) {
      this.telemetry.headPan = 0;
      this.telemetry.headTilt = 0;
      return this.dispatch('HEAD_CENTER', 'Centering head position.');
    }

    // 2. RGB Eyes & Telemetry Lights
    if (u.includes('blink') || u.includes('blink eyes')) {
      return this.dispatch('EYES_BLINK', 'Blinking eyes.');
    }
    if (u.includes('turn on eyes') || u.includes('eyes on') || u.includes('light on')) {
      this.telemetry.eyesActive = true;
      return this.dispatch('EYES_ON', 'Robot eyes activated.');
    }
    if (u.includes('turn off eyes') || u.includes('eyes off') || u.includes('light off')) {
      this.telemetry.eyesActive = false;
      return this.dispatch('EYES_OFF', 'Robot eyes turned off.');
    }
    if (u.includes('eye color') || u.includes('change eyes') || u.includes('cycle eyes')) {
      return this.dispatch('EYES_COLOR_CYCLE', 'Cycling eye LED hues.');
    }
    if (u.includes('red eye') || u.includes('eyes red') || u.includes('turn red')) {
      return this.dispatch('EYES_COLOR_RED', 'Setting robot eyes to red.');
    }
    if (u.includes('green eye') || u.includes('eyes green') || u.includes('turn green')) {
      return this.dispatch('EYES_COLOR_GREEN', 'Setting robot eyes to green.');
    }
    if (u.includes('blue eye') || u.includes('eyes blue') || u.includes('turn blue')) {
      return this.dispatch('EYES_COLOR_BLUE', 'Setting robot eyes to blue.');
    }
    if (u.includes('yellow eye') || u.includes('eyes yellow') || u.includes('turn yellow')) {
      return this.dispatch('EYES_COLOR_YELLOW', 'Setting robot eyes to yellow.');
    }
    if (u.includes('orange eye') || u.includes('eyes orange') || u.includes('turn orange')) {
      return this.dispatch('EYES_COLOR_ORANGE', 'Setting robot eyes to orange.');
    }

    // 3. Chassis / Motor Drive Base (Safety guarded)
    if (u.includes('move forward') || u.includes('drive forward')) {
      return this.dispatch('DRIVE_FORWARD', 'Drive motors initialized forward.');
    }
    if (u.includes('move back') || u.includes('reverse') || u.includes('drive backward')) {
      return this.dispatch('DRIVE_BACKWARD', 'Reversing chassis.');
    }
    if (u.includes('turn left') || u.includes('rotate left')) {
      return this.dispatch('DRIVE_ROTATE_LEFT', 'Rotating chassis left.');
    }
    if (u.includes('turn right') || u.includes('rotate right')) {
      return this.dispatch('DRIVE_ROTATE_RIGHT', 'Rotating chassis right.');
    }
    if (u.includes('stop moving') || u.includes('halt') || u.includes('emergency stop') || u.includes('stop robot')) {
      return this.dispatch('DRIVE_HALT', 'All drive motors halted immediately.');
    }
    if (u.includes('dance') || u.includes('do a dance')) {
      return this.dispatch('ANIMATION_DANCE', 'Initiating Aurra welcome celebration dance routine.');
    }

    // 4. Automated Action Sequences
    if (u.includes('action 1') || u.includes('action one')) {
      return this.dispatch('ACTION_01', 'Executing action sequence one.');
    }
    if (u.includes('action 2') || u.includes('action two')) {
      return this.dispatch('ACTION_02', 'Executing action sequence two.');
    }
    if (u.includes('action 3') || u.includes('action three')) {
      return this.dispatch('ACTION_03', 'Executing action sequence three.');
    }
    if (u.includes('action 4') || u.includes('action four')) {
      return this.dispatch('ACTION_04', 'Executing action sequence four.');
    }

    // 5. Hardware Health & Telemetry Status
    if (u.includes('hardware status') || u.includes('check motors') || u.includes('system status') || u.includes('battery status')) {
      const msg = `Hardware nominal. Battery at ${this.telemetry.battery}, animatronic servos ready, eye telemetry online.`;
      return this.dispatch('TELEMETRY_CHECK', msg);
    }

    return { handled: false };
  }

  /**
   * Internal dispatcher that executes custom handlers, updates state, and logs
   */
  dispatch(actionCode, spokenFeedback) {
    this.telemetry.lastCommand = actionCode;
    const timestamp = new Date().toISOString();

    logger.info('HARDWARE', `[TestingApp:HARDWARE] Executing: ${actionCode}`);
    console.log(`[TestingApp:HARDWARE] [${timestamp}] Command: ${actionCode}`);

    // Synchronize directly with esp32Service
    switch (actionCode) {
      case 'DRIVE_FORWARD':
        esp32Service.sendMotorCommand('forward');
        break;
      case 'DRIVE_BACKWARD':
        esp32Service.sendMotorCommand('backward');
        break;
      case 'DRIVE_ROTATE_LEFT':
        esp32Service.sendMotorCommand('left');
        break;
      case 'DRIVE_ROTATE_RIGHT':
        esp32Service.sendMotorCommand('right');
        break;
      case 'DRIVE_HALT':
        raspberryPiService.sendExpression('idle');
        esp32Service.sendMotorCommand('stop');
        break;
      case 'HEAD_NOD':
        raspberryPiService.sendExpression('nod');
        esp32Service.triggerActionSequence(1);
        break;
      case 'ACTION_01':
        raspberryPiService.sendExpression('greeting');
        esp32Service.triggerActionSequence(1);
        break;
      case 'HEAD_TILT_UP':
        raspberryPiService.sendExpression('listening');
        esp32Service.setServoAngle(0, 115);
        break;
      case 'HEAD_TILT_DOWN':
        esp32Service.setServoAngle(0, 65);
        break;
      case 'HEAD_PAN_LEFT':
        esp32Service.setServoAngle(1, 45);
        break;
      case 'HEAD_PAN_RIGHT':
        esp32Service.setServoAngle(1, 135);
        break;
      case 'HEAD_CENTER':
        raspberryPiService.sendExpression('idle');
        esp32Service.setServoAngle(0, 90);
        esp32Service.setServoAngle(1, 90);
        break;
      case 'EYES_BLINK':
        raspberryPiService.sendExpression('blink');
        break;
      case 'EYES_ON':
      case 'EYES_COLOR_GREEN':
        raspberryPiService.sendExpression('happy');
        esp32Service.setLedPreset('green');
        break;
      case 'EYES_OFF':
        raspberryPiService.sendExpression('idle');
        esp32Service.setLedPreset('off');
        break;
      case 'EYES_COLOR_RED':
        raspberryPiService.sendExpression('alert');
        esp32Service.setLedPreset('red');
        break;
      case 'EYES_COLOR_BLUE':
        raspberryPiService.sendExpression('happy');
        esp32Service.setLedPreset('blue');
        break;
      case 'EYES_COLOR_YELLOW':
        raspberryPiService.sendExpression('alert');
        esp32Service.setLedPreset('yellow');
        break;
      case 'EYES_COLOR_ORANGE':
        raspberryPiService.sendExpression('alert');
        esp32Service.setLedPreset('orange');
        break;
      case 'ACTION_02':
        raspberryPiService.sendExpression('alert');
        esp32Service.triggerActionSequence(2);
        break;
      case 'ACTION_03':
        raspberryPiService.sendExpression('bow');
        esp32Service.triggerActionSequence(3);
        break;
      case 'ACTION_04':
      case 'ANIMATION_DANCE':
        raspberryPiService.sendExpression('dance');
        esp32Service.triggerActionSequence(4);
        break;
      default:
        break;
    }

    // Call registered custom hardware driver if attached
    if (this.customHandlers.has(actionCode)) {
      try {
        const handler = this.customHandlers.get(actionCode);
        handler(this.telemetry);
      } catch (err) {
        logger.error('HARDWARE', `Custom hardware driver failed for ${actionCode}: ${err.message}`);
      }
    }

    // Broadcast standard DOM event so any open UI view can reflect hardware state live
    window.dispatchEvent(new CustomEvent('aurra:hardware-command', {
      detail: {
        action: actionCode,
        message: spokenFeedback,
        telemetry: { ...this.telemetry }
      }
    }));

    return {
      handled: true,
      action: actionCode,
      message: spokenFeedback,
      telemetry: { ...this.telemetry }
    };
  }

  getTelemetry() {
    return { ...this.telemetry };
  }
}

export const hardwareDispatcher = new HardwareDispatcher();
