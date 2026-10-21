/**
 * Robomiracle Technologies - Official Portals & Social Channels Data
 * Aligned with Nexus AI 8-Channel Portal Architecture (Dark Cyber Theme)
 */

export const DEFAULT_PORTAL_LINKS = {
  website: 'https://www.robomiracle.com/',
  linkedin: 'https://www.linkedin.com/company/robomiracle',
  youtube: 'https://www.youtube.com/@robomiracle',
  facebook: 'https://www.facebook.com/robomiracle',
  instagram: 'https://www.instagram.com/robomiracle',
  maps: 'https://maps.google.com/?q=Robomiracle+Coimbatore',
  twitter: 'https://x.com/robomiracle',
  threads: 'https://www.threads.net/@robomiracle',
};

export const OFFICIAL_CHANNELS = [
  {
    id: 'linkedin',
    key: 'linkedin',
    title: 'LinkedIn',
    subtitle: 'Official Professional Network & Corporate News',
    defaultUrl: 'https://www.linkedin.com/company/robomiracle',
    brandColor: '#0a66c2',
    iconType: 'linkedin',
    tag: 'PROFESSIONAL',
  },
  {
    id: 'youtube',
    key: 'youtube',
    title: 'YouTube',
    subtitle: 'Official Video Channel & Live Demos',
    defaultUrl: 'https://www.youtube.com/@robomiracle',
    brandColor: '#ff0000',
    iconType: 'youtube',
    tag: 'VIDEO CHANNEL',
  },
  {
    id: 'facebook',
    key: 'facebook',
    title: 'Facebook',
    subtitle: 'Official Community Page & Events',
    defaultUrl: 'https://www.facebook.com/robomiracle',
    brandColor: '#1877f2',
    iconType: 'facebook',
    tag: 'COMMUNITY',
  },
  {
    id: 'instagram',
    key: 'instagram',
    title: 'Instagram',
    subtitle: 'Official Visual Showcase & Stories',
    defaultUrl: 'https://www.instagram.com/robomiracle',
    brandColor: '#e1306c',
    iconType: 'instagram',
    tag: 'VISUAL STORIES',
  },
  {
    id: 'maps',
    key: 'maps',
    title: 'Google Maps',
    subtitle: 'HQ Location & Interactive Route',
    defaultUrl: 'https://maps.google.com/?q=Robomiracle+Coimbatore',
    brandColor: '#ea4335',
    iconType: 'maps',
    tag: 'HEADQUARTERS',
  },
  {
    id: 'website',
    key: 'website',
    title: 'Official Website',
    subtitle: 'Aurra Corporate Web Portal',
    defaultUrl: 'https://www.robomiracle.com/',
    brandColor: '#00d5ff',
    iconType: 'website',
    tag: 'OFFICIAL PORTAL',
  },
  {
    id: 'twitter',
    key: 'twitter',
    title: 'X (Twitter)',
    subtitle: 'Official Press Releases & Live Feeds',
    defaultUrl: 'https://x.com/robomiracle',
    brandColor: '#ffffff',
    iconType: 'twitter',
    tag: 'PRESS RELEASES',
  },
  {
    id: 'threads',
    key: 'threads',
    title: 'Threads',
    subtitle: 'Official Discussions & Community',
    defaultUrl: 'https://www.threads.net/@robomiracle',
    brandColor: '#ffffff',
    iconType: 'threads',
    tag: 'COMMUNITY',
  },
];

export const OFFICIAL_WEBLINKS = OFFICIAL_CHANNELS.map((ch, idx) => ({
  id: ch.id,
  key: ch.key,
  category: 'social',
  title: ch.title,
  subtitle: ch.subtitle,
  url: ch.defaultUrl,
  displayUrl: ch.defaultUrl.replace(/^https?:\/\//i, '').replace(/\/$/, ''),
  description: ch.subtitle,
  tag: ch.tag,
  tagColor: ch.brandColor,
  accentColor: ch.brandColor,
  badge: 'Verified Official',
  isEnabled: true,
  sortOrder: idx,
}));

export const BROCHURE_SECTIONS = [
  {
    id: 'overview',
    title: 'Aurra 2.0 Autonomous Receptionist',
    subtitle: 'Executive Briefing',
    bullets: [
      'Next-generation autonomous humanoid kiosk designed for enterprise lobbies, tech campuses, and innovation centers.',
      'Full offline capability: Zero cloud dependency for biometric face recognition, visitor check-in, and spoken FAQ assistance.',
      'Ultra-responsive 90 FPS hardware-accelerated user interface running natively on MediaTek Helio G100.',
    ],
  },
  {
    id: 'hardware',
    title: 'Robotics & Hardware Architecture',
    subtitle: 'Subsystem Engineering',
    bullets: [
      'MediaTek Helio G100 ARM64 computing core with dedicated Mali GPU and locked high-refresh display.',
      'ESP32 SoftAP Microcontroller bridge controlling 5-axis animatronic neck/head servos and high-torque dual base drive motors.',
      'Raspberry Pi Expression Engine synchronizing real-time HDMI facial expressions with spoken voice output.',
      'Dual ultrasonic proximity radar sensors (<25cm automatic obstacle stop safety envelope).',
    ],
  },
  {
    id: 'features',
    title: 'Core Kiosk Capabilities',
    subtitle: 'Enterprise Ready',
    bullets: [
      'Biometric Check-In: Instant digital visitor badge generation with auto-enrolled facial greeting memory.',
      'Offline Spoken Q&A: Local IndexedDB knowledge engine answering multi-topic visitor queries with Web Speech TTS.',
      'Autonomous Guided Tours: Waypoint-based facility navigation with spoken exhibit commentary and pause controls.',
      'Multi-Tier Security: Secret 4-tap Admin panel with PIN authentication, offline CSV audit export, and developer telemetry.',
    ],
  },
];
