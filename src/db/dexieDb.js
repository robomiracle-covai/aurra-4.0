import Dexie from 'dexie';
import { DEFAULT_REGISTRATION_CARDS, DEFAULT_SLIDES } from '../data/defaultCards';
import { DEFAULT_QA_QUESTIONS } from '../data/defaultQuestions';
import { OFFICIAL_WEBLINKS } from '../pages/WebLinks/weblinksData';

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


