import Dexie from 'dexie';
import { DEFAULT_REGISTRATION_CARDS, DEFAULT_SLIDES } from '../data/defaultCards';
import { DEFAULT_QA_QUESTIONS } from '../data/defaultQuestions';
import { OFFICIAL_WEBLINKS } from '../pages/WebLinks/weblinksData';
import { DEFAULT_FACILITIES } from '../data/defaultFacilities';

// Initialize IndexedDB Database for 100% Offline Kiosk Storage
export const db = new Dexie('AurraOfflineDB');

db.version(1).stores({
  userFaces: '++id, name',
});

// Version 2: Cards, Slideshow Images & Branding
db.version(2).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
}).upgrade(async (tx) => {
  const count = await tx.table('cards').count();
  if (count === 0) {
    await tx.table('cards').bulkAdd(DEFAULT_REGISTRATION_CARDS);
  }
  const slideCount = await tx.table('images').count();
  if (slideCount === 0) {
    await tx.table('images').bulkAdd(DEFAULT_SLIDES);
  }
  const headerCount = await tx.table('headers').count();
  if (headerCount === 0) {
    await tx.table('headers').add({ headerName: 'Robomiracle Technologies Private Limited' });
  }
});

// Version 3: Knowledge Base Questions & Answers for /qa
db.version(3).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
}).upgrade(async (tx) => {
  const qaCount = await tx.table('qaQuestions').count();
  if (qaCount === 0) {
    await tx.table('qaQuestions').bulkAdd(DEFAULT_QA_QUESTIONS);
  }
});

// Version 4: Visitor Registration & Kiosk Check-In for /form
db.version(4).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
}).upgrade(async (tx) => {
  const visitorCount = await tx.table('visitors').count();
  if (visitorCount === 0) {
    await tx.table('visitors').bulkAdd([
      {
        name: 'Dr. Sarah Connor',
        phone: '+91 98765 43210',
        email: 'sarah.connor@cyberdyne.io',
        company: 'Cyberdyne Systems',
        purpose: 'Facility Tour',
        host: 'CEO Office',
        badgeType: 'VIP Access Pass',
        badgeNumber: 'AUR-VIS-2026-1001',
        checkInTime: new Date(Date.now() - 3600000 * 2).toISOString(),
        status: 'ACTIVE',
        photo: null,
      },
      {
        name: 'Alex Mercer',
        phone: '+91 91234 56789',
        email: 'alex.mercer@gentek.org',
        company: 'Gentek Innovations',
        purpose: 'Client Meeting',
        host: 'R&D Lab',
        badgeType: 'Standard Visitor',
        badgeNumber: 'AUR-VIS-2026-1002',
        checkInTime: new Date(Date.now() - 3600000 * 4).toISOString(),
        status: 'CHECKED_OUT',
        checkOutTime: new Date(Date.now() - 3600000 * 1).toISOString(),
        photo: null,
      }
    ]);
  }
});

// Version 5: QR Codes & Official Web Links for /weblinks
db.version(5).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
}).upgrade(async (tx) => {
  const linkCount = await tx.table('weblinks').count();
  if (linkCount === 0) {
    const initialLinks = OFFICIAL_WEBLINKS.map((link, index) => ({
      ...link,
      isEnabled: true,
      sortOrder: index,
    }));
    await tx.table('weblinks').bulkAdd(initialLinks);
  }
});

// Version 6: Autonomous Guided Robot Tour Waypoints for /guided-tour
db.version(6).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
}).upgrade(async (tx) => {
  const { DEFAULT_TOUR_STOPS } = await import('../data/defaultTourStops');
  const stopCount = await tx.table('tourStops').count();
  if (stopCount === 0) {
    await tx.table('tourStops').bulkAdd(DEFAULT_TOUR_STOPS);
  }
});

// Version 7: Classic Robomiracle Robot Showcase Tours & Step Presentations
db.version(7).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
  robotTours: 'id, slug, title, orderIndex, isEnabled',
}).upgrade(async (tx) => {
  const { DEFAULT_ROBOT_TOURS } = await import('../data/defaultRobotTours');
  const robotCount = await tx.table('robotTours').count();
  if (robotCount === 0) {
    await tx.table('robotTours').bulkAdd(DEFAULT_ROBOT_TOURS);
  }
});

// Version 8: Chat Sessions & Interaction Conversation Logs
db.version(8).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
  robotTours: 'id, slug, title, orderIndex, isEnabled',
  chatSessions: 'id, title, createdAt, updatedAt, messageCount',
  chatMessages: '++id, sessionId, role, text, timestamp, inputType, source, confidence',
}).upgrade(async (tx) => {
  const sessionCount = await tx.table('chatSessions').count();
  if (sessionCount === 0) {
    const demoSessionId = 'session_demo_aurra_intro';
    const now = Date.now();
    await tx.table('chatSessions').add({
      id: demoSessionId,
      title: 'Welcome & System Interaction Demo',
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 3600000 + 120000).toISOString(),
      messageCount: 4,
    });
    await tx.table('chatMessages').bulkAdd([
      {
        sessionId: demoSessionId,
        role: 'assistant',
        text: 'Hello! I am Aurra, your intelligent receptionist humanoid. How can I help you today?',
        timestamp: new Date(now - 3600000).toISOString(),
        inputType: 'voice',
        source: 'greeting',
        confidence: 100,
      },
      {
        sessionId: demoSessionId,
        role: 'user',
        text: 'What robots are developed by Robomiracle?',
        timestamp: new Date(now - 3600000 + 30000).toISOString(),
        inputType: 'voice',
        source: 'user',
        confidence: 100,
      },
      {
        sessionId: demoSessionId,
        role: 'assistant',
        text: 'Robomiracle manufactures Aurra (Flagship Humanoid Receptionist), Nexus (Industrial Service Platform), Nova (Educational Guide), Dine (Hospitality Service), and G1 (Agile Humanoid).',
        timestamp: new Date(now - 3600000 + 45000).toISOString(),
        inputType: 'voice',
        source: 'offline-faq',
        confidence: 98,
      },
      {
        sessionId: demoSessionId,
        role: 'user',
        text: 'Can I register as a visitor?',
        timestamp: new Date(now - 3600000 + 90000).toISOString(),
        inputType: 'text',
        source: 'user',
        confidence: 100,
      },
      {
        sessionId: demoSessionId,
        role: 'assistant',
        text: 'Yes! You can complete visitor registration directly at this kiosk. Tap "Check-In Form" or say "I\'d like to register" to get your digital badge.',
        timestamp: new Date(now - 3600000 + 105000).toISOString(),
        inputType: 'text',
        source: 'offline-faq',
        confidence: 96,
      },
    ]);
  }
});

// Version 9: Campus Public Facilities & Room Directory for /facilities
db.version(9).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
  robotTours: 'id, slug, title, orderIndex, isEnabled',
  chatSessions: 'id, title, createdAt, updatedAt, messageCount',
  chatMessages: '++id, sessionId, role, text, timestamp, inputType, source, confidence',
  facilities: 'id, code, name, floor, category, isEnabled, sortOrder',
}).upgrade(async (tx) => {
  const facilityCount = await tx.table('facilities').count();
  if (facilityCount === 0) {
    await tx.table('facilities').bulkAdd(DEFAULT_FACILITIES);
  }
});

// Version 10: Re-seed facilities with exact 9 official facilities from classic Aurra app
db.version(10).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
  robotTours: 'id, slug, title, orderIndex, isEnabled',
  chatSessions: 'id, title, createdAt, updatedAt, messageCount',
  chatMessages: '++id, sessionId, role, text, timestamp, inputType, source, confidence',
  facilities: 'id, code, name, floor, category, isEnabled, sortOrder',
}).upgrade(async (tx) => {
  await tx.table('facilities').clear();
  await tx.table('facilities').bulkAdd(DEFAULT_FACILITIES);
});

// Version 11: Re-seed with Nexus 9 Public Facilities
db.version(11).stores({
  userFaces: '++id, name',
  cards: '++id, title, href, isEnabled, voiceAccessEnabled',
  images: '++id, title, isSelected',
  headers: '++id, headerName',
  qaQuestions: '++id, question, category',
  visitors: '++id, name, phone, email, company, purpose, host, badgeType, badgeNumber, checkInTime, checkOutTime, status',
  weblinks: 'id, title, category, url, isEnabled, sortOrder',
  tourStops: '++id, name, area, orderIndex, isEnabled',
  robotTours: 'id, slug, title, orderIndex, isEnabled',
  chatSessions: 'id, title, createdAt, updatedAt, messageCount',
  chatMessages: '++id, sessionId, role, text, timestamp, inputType, source, confidence',
  facilities: 'id, code, name, floor, category, isEnabled, sortOrder',
}).upgrade(async (tx) => {
  await tx.table('facilities').clear();
  await tx.table('facilities').bulkAdd(DEFAULT_FACILITIES);
});





