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

// Version 12: PDF Document AI & Interactive Knowledge Base
db.version(12).stores({
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
  pdfDocuments: 'id, title, fileName, fileSize, pageCount, createdAt, updatedAt',
  pdfChunks: '++id, documentId, pageNumber, chunkIndex, text',
  pdfChatMessages: '++id, documentId, role, text, citations, timestamp',
}).upgrade(async (tx) => {
  const docCount = await tx.table('pdfDocuments').count();
  if (docCount === 0) {
    const defaultDocId = 'doc_aurra_tech_specs_2026';
    const now = new Date().toISOString();
    await tx.table('pdfDocuments').add({
      id: defaultDocId,
      title: 'Aurra 4.0 Humanoid Receptionist — Technical & Architecture Manual',
      fileName: 'Aurra_4.0_Technical_Specifications_Manual.pdf',
      fileSize: 485200,
      pageCount: 3,
      createdAt: now,
      updatedAt: now,
      summary: 'Authoritative hardware architecture, vision sensors, motor degrees of freedom, battery runtime, and campus facilities directory for Aurra humanoid.',
    });

    await tx.table('pdfChunks').bulkAdd([
      {
        documentId: defaultDocId,
        pageNumber: 1,
        chunkIndex: 0,
        text: 'ROBOMIRACLE TECHNOLOGIES — AURRA 4.0 TECHNICAL MANUAL\nChapter 1: Hardware Specifications & Architecture Overview\nDisplay: 12-inch Full HD (1920x1080) Waveshare Capacitive Multi-Touch Display running at 90 FPS with anti-glare tempered glass coating.\nBattery & Power System: High-capacity 25.9V / 31.5Ah Lithium-ion battery pack delivering 10 to 14 hours of continuous operational endurance. Dedicated 29.4V / 5A smart charger with thermal protection and overcharge safeguards.\nControl Architecture: Dual-mode wireless control supporting 2.4 GHz RC Remote control and Wi-Fi Web/Mobile Cockpit telemetry. A physical toggle switch toggles between Wi-Fi and RC modes.',
      },
      {
        documentId: defaultDocId,
        pageNumber: 1,
        chunkIndex: 1,
        text: 'Power Switch: Heavy-duty illuminated physical latching push button on the rear spine for master power cut-off.\nThermal Management: Active multi-duct brushless air ventilation circulation fans maintaining internal computing temperatures below 45 degrees Celsius.',
      },
      {
        documentId: defaultDocId,
        pageNumber: 2,
        chunkIndex: 0,
        text: 'Chapter 2: Motion, Actuation & Sensor Telemetry\nMobility & Degrees of Freedom: 5 DOF (Degrees of Freedom) motor kinematic architecture offering precision head yaw, pitch, dual-axis gesture arms, and torso orientation.\nBase Drive: 100mm heavy-duty dual-bearing industrial omni/caster wheel assembly providing smooth 360-degree zero-radius turning on corporate flooring and carpet.\nSensors: Array of high-precision ultrasonic distance sensors offering 360-degree obstacle detection, edge detection, and real-time collision prevention with a 15-millisecond response window.',
      },
      {
        documentId: defaultDocId,
        pageNumber: 2,
        chunkIndex: 1,
        text: 'Vision & Camera Subsystem: Crystal Pro HD Web Camera with USB interface, 3P optical lens, automatic low-light night vision enhancement, and integrated noise-cancelling directional microphone array.\nAudio Subsystem: Fielect 8 Ohm 20W high-definition external magnet neodymium loudspeaker (78mm diameter) tuned for clear human voice articulation.',
      },
      {
        documentId: defaultDocId,
        pageNumber: 3,
        chunkIndex: 0,
        text: 'Chapter 3: Campus Headquarters & Campus Directory\nCorporate Office: Robomiracle Technologies Private Limited, RS Puram, Coimbatore, Tamil Nadu, India.\nContact Hotline: +91 63804 73177, +91 79071 08559 | Email: sales@robomiracle.com\nCampus Facilities:\n- Ground Floor East Wing: [RD-01] R&D & Engineering Workspace, [HW-02] Hardware & Electronics Lab, [PR-04] 3D Rapid Prototyping.\n- Ground Floor Central Atrium: [TB-05] Robotics Demonstration Arena (10m straight ahead).\n- Ground Floor North Wing: [MC-07] Executive Conference Rooms.\n- First Floor Central Core: [SW-03] Software Development & AI Innovation Lab.\n- Second Floor Central: [IT-08] High-Speed IT Infrastructure & Climate-Controlled Server Racks.',
      },
    ]);

    await tx.table('pdfChatMessages').bulkAdd([
      {
        documentId: defaultDocId,
        role: 'assistant',
        text: 'Welcome to PDF Document AI! I have loaded the official Aurra 4.0 Technical Manual. You can ask me any question about the robot hardware, battery, cameras, or facilities, or upload your own PDF!',
        citations: [1],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }
});





