/**
 * Default Guided Robot Tour Waypoints for Aurra Kiosk
 * 100% Offline Persistence with Hardware Servo & Eye LED Sync
 */

export const DEFAULT_TOUR_STOPS = [
  {
    id: 1,
    name: 'Grand Welcome Atrium',
    area: 'Ground Floor Main Lobby',
    orderIndex: 0,
    isEnabled: true,
    durationSec: 12,
    highlights: ['Autonomous Kiosk Check-In', 'Digital Visitor Badging', 'Biometric Welcome'],
    narration: 'Welcome to Robomiracle Technologies! You are in our Grand Welcome Atrium. Here, our autonomous systems assist guests with instant check-in, dynamic visitor badges, and facility orientation.',
    rgbColor: '#00FFFF', // Cyan
    servoTilt: 90,
    servoPan: 90,
    mapX: 20, // percentage coordinates for interactive SVG floorplan
    mapY: 75,
  },
  {
    id: 2,
    name: 'AI & Robotics Innovation Showcase',
    area: 'West Wing Bay A',
    orderIndex: 1,
    isEnabled: true,
    durationSec: 15,
    highlights: ['Humanoid Service Robots', 'Cybernetic HUD Vision', 'Multimodal Neural Models'],
    narration: 'To our left is the AI and Robotics Innovation Showcase. This center pioneers next-generation humanoid service robots powered by edge neural vision and conversational multimodal intelligence.',
    rgbColor: '#38BDF8', // Electric Blue
    servoTilt: 85,
    servoPan: 125,
    mapX: 35,
    mapY: 35,
  },
  {
    id: 3,
    name: 'Autonomous Hardware Engineering Bay',
    area: 'Engineering Block 102',
    orderIndex: 2,
    isEnabled: true,
    durationSec: 14,
    highlights: ['ESP32 Multi-Motor Drivers', '5-Axis Precision Servos', 'Dual Radar Collision Safety'],
    narration: 'Here in the Hardware Engineering Bay, our robotics team designs high-precision multi-servo animatronics, motor drive subassemblies, and ultra-reliable radar collision safety systems.',
    rgbColor: '#F59E0B', // Amber
    servoTilt: 95,
    servoPan: 60,
    mapX: 65,
    mapY: 30,
  },
  {
    id: 4,
    name: 'Executive Briefing & Strategic Suite',
    area: 'Executive Floor North',
    orderIndex: 3,
    isEnabled: true,
    durationSec: 12,
    highlights: ['Enterprise Robotics Architecture', 'VIP Demonstration Area', 'Global Video Hub'],
    narration: 'Welcome to our Executive Briefing Suite. This facility hosts strategic enterprise partnerships, live autonomous robot demonstrations, and international robotics conferences.',
    rgbColor: '#A855F7', // Royal Purple
    servoTilt: 90,
    servoPan: 110,
    mapX: 82,
    mapY: 55,
  },
  {
    id: 5,
    name: 'Cafeteria & Relaxation Courtyard',
    area: 'Central Courtyard Garden',
    orderIndex: 4,
    isEnabled: true,
    durationSec: 12,
    highlights: ['Refreshments & Beverage Bar', 'Organic Green Space', 'Visitor Relaxation Lounge'],
    narration: 'Finally, we have arrived at our Cafeteria and Relaxation Lounge. Please feel free to enjoy complimentary refreshments, tea, and coffee. Thank you for touring with Aurra!',
    rgbColor: '#10B981', // Emerald Green
    servoTilt: 95,
    servoPan: 90,
    mapX: 50,
    mapY: 82,
  },
];
