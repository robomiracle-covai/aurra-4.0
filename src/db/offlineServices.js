import { db } from './dexieDb';
import { DEFAULT_REGISTRATION_CARDS, DEFAULT_SLIDES } from '../data/defaultCards';
import { DEFAULT_QA_QUESTIONS } from '../data/defaultQuestions';
import { OFFICIAL_WEBLINKS } from '../pages/WebLinks/weblinksData';
import { DEFAULT_TOUR_STOPS } from '../data/defaultTourStops';

const parseNumericId = (id) => {
  const n = Number(id);
  return Number.isNaN(n) ? id : n;
};

/**
 * Offline User Faces Services (IndexedDB)
 */
export const offlineFaceService = {
  getUsers: async () => {
    return await db.userFaces.toArray();
  },
  getFaces: async () => {
    return await db.userFaces.toArray();
  },

  uploadFace: async ({ name, faceEmbedding, imgUrl, info }) => {
    const id = await db.userFaces.add({
      name,
      faceEmbedding, // Array of 128 embedding floats
      imgUrl,        // Relative image URL or Base64
      info,
      createdAt: new Date().toISOString(),
    });
    return { id, name, faceEmbedding, imgUrl, info };
  },

  updateUser: async (idOrName, data) => {
    let record = null;
    try {
      record = await db.userFaces.get(parseNumericId(idOrName));
    } catch {
      record = await db.userFaces.where('name').equals(idOrName).first();
    }
    if (!record?.id) {
      throw new Error('User not found');
    }
    await db.userFaces.update(record.id, data);
    return await db.userFaces.get(record.id);
  },

  deleteUser: async (idOrName) => {
    let record = null;
    try {
      record = await db.userFaces.get(parseNumericId(idOrName));
    } catch {
      record = await db.userFaces.where('name').equals(idOrName).first();
    }
    if (!record?.id) {
      throw new Error('User not found');
    }
    await db.userFaces.delete(record.id);
    return { message: 'User face deleted successfully (Offline IndexedDB)' };
  },
};

/**
 * Offline Action Cards Services (IndexedDB) with Voice Access Control
 */
export const offlineCardService = {
  getCards: async () => {
    let cards = await db.cards.toArray();
    if (!cards || cards.length === 0) {
      await db.cards.bulkAdd(DEFAULT_REGISTRATION_CARDS);
      cards = await db.cards.toArray();
    }
    return cards;
  },

  saveCard: async (cardData) => {
    const id = await db.cards.add({
      ...cardData,
      isEnabled: cardData.isEnabled ?? true,
      voiceAccessEnabled: cardData.voiceAccessEnabled ?? true,
      createdAt: new Date().toISOString(),
    });
    return await db.cards.get(id);
  },

  updateCard: async (id, data) => {
    const numId = parseNumericId(id);
    await db.cards.update(numId, data);
    return await db.cards.get(numId);
  },

  toggleCardEnabled: async (id, isEnabled) => {
    const numId = parseNumericId(id);
    await db.cards.update(numId, { isEnabled });
    return await db.cards.get(numId);
  },

  toggleVoiceAccess: async (id, voiceAccessEnabled) => {
    const numId = parseNumericId(id);
    await db.cards.update(numId, { voiceAccessEnabled });
    return await db.cards.get(numId);
  },

  deleteCard: async (id) => {
    const numId = parseNumericId(id);
    await db.cards.delete(numId);
    return { message: 'Card deleted successfully' };
  },

  restoreDefaultCards: async () => {
    await db.cards.clear();
    await db.cards.bulkAdd(DEFAULT_REGISTRATION_CARDS);
    return await db.cards.toArray();
  },
};

/**
 * Offline Slideshow Services (IndexedDB)
 */
export const offlineSliderService = {
  getSlideImages: async () => {
    let slides = await db.images.toArray();
    if (!slides || slides.length === 0) {
      await db.images.bulkAdd(DEFAULT_SLIDES);
      slides = await db.images.toArray();
    }
    return slides;
  },

  addSlideImage: async (slideData) => {
    const id = await db.images.add({
      ...slideData,
      isSelected: slideData.isSelected ?? true,
      createdAt: new Date().toISOString(),
    });
    return await db.images.get(id);
  },

  toggleSlideSelected: async (id, isSelected) => {
    const numId = parseNumericId(id);
    await db.images.update(numId, { isSelected });
    return await db.images.get(numId);
  },

  deleteSlideImage: async (id) => {
    const numId = parseNumericId(id);
    await db.images.delete(numId);
    return { message: 'Slide deleted successfully' };
  },

  restoreDefaultSlides: async () => {
    await db.images.clear();
    await db.images.bulkAdd(DEFAULT_SLIDES);
    return await db.images.toArray();
  },
};

/**
 * Offline Branding & Header Services (IndexedDB)
 */
export const offlineBrandingService = {
  getHeader: async () => {
    const headers = await db.headers.toArray();
    if (!headers || headers.length === 0) {
      const defaultHeader = { headerName: 'Robomiracle Technologies Private Limited' };
      const id = await db.headers.add(defaultHeader);
      return { id, ...defaultHeader };
    }
    return headers[0];
  },

  saveHeader: async (headerName) => {
    const headers = await db.headers.toArray();
    if (headers && headers.length > 0) {
      await db.headers.update(headers[0].id, { headerName });
      return await db.headers.get(headers[0].id);
    }
    const id = await db.headers.add({ headerName });
    return { id, headerName };
  },
};

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'could',
  'do', 'does', 'for', 'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my',
  'of', 'on', 'or', 'our', 'please', 'tell', 'that', 'the', 'this', 'to',
  'was', 'what', 'when', 'where', 'which', 'who', 'why', 'will', 'with', 'would', 'you', 'your'
]);

const tokenize = (text) => {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
};

/**
 * Offline Q&A Knowledge Services (IndexedDB)
 * Ultra-fast tokenized scoring (< 3ms) with zero cloud dependencies
 */
export const offlineQaService = {
  getQuestions: async () => {
    let questions = await db.qaQuestions.toArray();
    if (!questions || questions.length === 0) {
      await db.qaQuestions.bulkAdd(DEFAULT_QA_QUESTIONS);
      questions = await db.qaQuestions.toArray();
    }
    return questions;
  },

  addQuestion: async ({ question, answer, category = 'General', keywords = [], actionRoute = null }) => {
    const id = await db.qaQuestions.add({
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim(),
      keywords: Array.isArray(keywords) ? keywords : keywords.split(',').map((k) => k.trim()).filter(Boolean),
      actionRoute: actionRoute ? actionRoute.trim() : null,
      createdAt: new Date().toISOString(),
    });
    return await db.qaQuestions.get(id);
  },

  updateQuestion: async (id, data) => {
    const numId = parseNumericId(id);
    await db.qaQuestions.update(numId, data);
    return await db.qaQuestions.get(numId);
  },

  deleteQuestion: async (id) => {
    const numId = parseNumericId(id);
    await db.qaQuestions.delete(numId);
    return { message: 'Question deleted successfully' };
  },

  restoreDefaultQuestions: async () => {
    await db.qaQuestions.clear();
    await db.qaQuestions.bulkAdd(DEFAULT_QA_QUESTIONS);
    return await db.qaQuestions.toArray();
  },

  normalizeQueryText: (text) => {
    if (!text) return '';
    let norm = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    norm = norm
      .replace(/\bwho r u\b/g, 'who are you')
      .replace(/\bwho u r\b/g, 'who are you')
      .replace(/\bwho are u\b/g, 'who are you')
      .replace(/\bwho u are\b/g, 'who are you')
      .replace(/\bwhos u\b/g, 'who are you')
      .replace(/\bwhats ur\b/g, 'what is your')
      .replace(/\bwhats your\b/g, 'what is your')
      .replace(/\bwhat r u\b/g, 'who are you')
      .replace(/\bwho r ya\b/g, 'who are you')
      .replace(/\bur name\b/g, 'your name')
      .replace(/\bu r\b/g, 'you are')
      .replace(/\bu\b/g, 'you')
      .replace(/\br\b/g, 'are');

    return norm.replace(/\s+/g, ' ').trim();
  },

  /**
   * Fast tokenized matching against IndexedDB Q&A base
   */
  findBestAnswer: async (rawQuery) => {
    if (!rawQuery || typeof rawQuery !== 'string') return null;
    const cleanQuery = rawQuery.trim().toLowerCase();
    const normalizedQuery = offlineQaService.normalizeQueryText(cleanQuery);
    const queryTokens = tokenize(normalizedQuery);

    const questions = await offlineQaService.getQuestions();
    let bestMatch = null;
    let highestScore = 0;

    for (const item of questions) {
      let score = 0;
      const questionLower = (item.question || '').toLowerCase();
      const questionNorm = offlineQaService.normalizeQueryText(questionLower);
      const questionTokens = tokenize(questionNorm);
      const categoryLower = (item.category || '').toLowerCase();
      const keywords = (item.keywords || []).map((k) => k.toLowerCase());
      const normKeywords = keywords.map((k) => offlineQaService.normalizeQueryText(k));

      // 1. Exact match with question or keywords (raw or normalized)
      if (cleanQuery === questionLower || normalizedQuery === questionNorm) {
        score += 120;
      } else if (keywords.some((kw) => kw === cleanQuery) || normKeywords.some((kw) => kw === normalizedQuery)) {
        score += 110;
      }

      // 2. Phrase containment
      if (normalizedQuery.length >= 4 && questionNorm.includes(normalizedQuery)) {
        score += 70;
      }
      for (const kw of normKeywords) {
        if (normalizedQuery.includes(kw)) {
          score += 60;
        } else if (kw.includes(normalizedQuery) && normalizedQuery.length >= 4) {
          score += 45;
        }
      }

      // 3. Category match
      if (cleanQuery.includes(categoryLower) && categoryLower.length > 3) {
        score += 25;
      }

      // 4. Token overlap scoring
      let tokenOverlapCount = 0;
      for (const qToken of queryTokens) {
        if (questionTokens.includes(qToken)) {
          score += 20;
          tokenOverlapCount++;
        }
        for (const kw of keywords) {
          if (kw.includes(qToken)) {
            score += 15;
            tokenOverlapCount++;
            break;
          }
        }
      }

      // If multiple tokens match, apply synergy bonus
      if (tokenOverlapCount >= 2) {
        score += 25;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    if (bestMatch && highestScore >= 25) {
      return {
        match: bestMatch,
        score: highestScore,
        confidence: Math.min(100, Math.round((highestScore / 120) * 100)),
      };
    }

    return null;
  },
};

/**
 * Offline Database Backup & Restore Services (IndexedDB)
 */
export const offlineBackupService = {
  exportDatabase: async () => {
    const data = {
      version: 3,
      exportedAt: new Date().toISOString(),
      headers: await db.headers.toArray(),
      cards: await db.cards.toArray(),
      images: await db.images.toArray(),
      qaQuestions: await db.qaQuestions.toArray(),
      userFaces: await db.userFaces.toArray(),
      visitors: await db.visitors.toArray(),
      weblinks: await db.weblinks.toArray(),
      tourStops: await db.tourStops.toArray(),
    };
    return data;
  },

  importDatabase: async (backupData) => {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup file format');
    }
    if (Array.isArray(backupData.headers) && backupData.headers.length > 0) {
      await db.headers.clear();
      await db.headers.bulkAdd(backupData.headers);
    }
    if (Array.isArray(backupData.cards) && backupData.cards.length > 0) {
      await db.cards.clear();
      await db.cards.bulkAdd(backupData.cards);
    }
    if (Array.isArray(backupData.images) && backupData.images.length > 0) {
      await db.images.clear();
      await db.images.bulkAdd(backupData.images);
    }
    if (Array.isArray(backupData.qaQuestions) && backupData.qaQuestions.length > 0) {
      await db.qaQuestions.clear();
      await db.qaQuestions.bulkAdd(backupData.qaQuestions);
    }
    if (Array.isArray(backupData.userFaces)) {
      await db.userFaces.clear();
      if (backupData.userFaces.length > 0) {
        await db.userFaces.bulkAdd(backupData.userFaces);
      }
    }
    if (Array.isArray(backupData.visitors)) {
      await db.visitors.clear();
      if (backupData.visitors.length > 0) {
        await db.visitors.bulkAdd(backupData.visitors);
      }
    }
    if (Array.isArray(backupData.weblinks)) {
      await db.weblinks.clear();
      if (backupData.weblinks.length > 0) {
        await db.weblinks.bulkAdd(backupData.weblinks);
      }
    }
    if (Array.isArray(backupData.tourStops)) {
      await db.tourStops.clear();
      if (backupData.tourStops.length > 0) {
        await db.tourStops.bulkAdd(backupData.tourStops);
      }
    }
    return { success: true };
  },

  resetAllToFactoryDefaults: async () => {
    await db.headers.clear();
    await db.headers.add({ headerName: 'Robomiracle Technologies Private Limited' });
    await db.cards.clear();
    await db.cards.bulkAdd(DEFAULT_REGISTRATION_CARDS);
    await db.images.clear();
    await db.images.bulkAdd(DEFAULT_SLIDES);
    await db.qaQuestions.clear();
    await db.qaQuestions.bulkAdd(DEFAULT_QA_QUESTIONS);
    await db.tourStops.clear();
    await db.tourStops.bulkAdd(DEFAULT_TOUR_STOPS);
    await db.userFaces.clear();
    await db.visitors.clear();
    await db.weblinks.clear();
    await db.weblinks.bulkAdd(OFFICIAL_WEBLINKS.map((link, index) => ({
      ...link,
      isEnabled: true,
      sortOrder: index,
    })));
    return { success: true };
  },
};

/**
 * Offline Visitor Registration Services (IndexedDB)
 */
export const offlineVisitorService = {
  getVisitors: async () => {
    try {
      const visitors = await db.visitors.toArray();
      return visitors.sort((a, b) => new Date(b.checkInTime || 0) - new Date(a.checkInTime || 0));
    } catch (e) {
      console.warn('Failed to load visitors from DB:', e);
      return [];
    }
  },

  getVisitorById: async (id) => {
    return await db.visitors.get(parseNumericId(id));
  },

  registerVisitor: async (visitorData) => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const badgeNumber = visitorData.badgeNumber || `AUR-VIS-2026-${randomSuffix}`;
    const checkInTime = visitorData.checkInTime || new Date().toISOString();
    
    const record = {
      name: visitorData.name || 'Anonymous Visitor',
      phone: visitorData.phone || '',
      email: visitorData.email || '',
      company: visitorData.company || 'Independent',
      purpose: visitorData.purpose || 'General Inquiry',
      host: visitorData.host || 'Reception Desk',
      badgeType: visitorData.badgeType || 'Standard Visitor',
      badgeNumber,
      checkInTime,
      checkOutTime: null,
      status: 'ACTIVE',
      photo: visitorData.photo || null,
      notes: visitorData.notes || '',
      createdAt: new Date().toISOString(),
    };

    const id = await db.visitors.add(record);
    return { ...record, id };
  },

  checkoutVisitor: async (id) => {
    const numId = parseNumericId(id);
    const checkoutTime = new Date().toISOString();
    await db.visitors.update(numId, {
      status: 'CHECKED_OUT',
      checkOutTime: checkoutTime,
    });
    return await db.visitors.get(numId);
  },

  updateVisitor: async (id, data) => {
    const numId = parseNumericId(id);
    await db.visitors.update(numId, data);
    return await db.visitors.get(numId);
  },

  deleteVisitor: async (id) => {
    const numId = parseNumericId(id);
    await db.visitors.delete(numId);
    return { success: true, message: 'Visitor record deleted' };
  },

  exportVisitorsCSV: async () => {
    const visitors = await db.visitors.toArray();
    if (!visitors || visitors.length === 0) return '';
    
    const headers = ['ID', 'Name', 'Phone', 'Email', 'Company', 'Purpose', 'Host', 'Badge Type', 'Badge Number', 'Check-In Time', 'Check-Out Time', 'Status'];
    const rows = visitors.map((v) => [
      v.id,
      `"${(v.name || '').replace(/"/g, '""')}"`,
      `"${(v.phone || '').replace(/"/g, '""')}"`,
      `"${(v.email || '').replace(/"/g, '""')}"`,
      `"${(v.company || '').replace(/"/g, '""')}"`,
      `"${(v.purpose || '').replace(/"/g, '""')}"`,
      `"${(v.host || '').replace(/"/g, '""')}"`,
      `"${(v.badgeType || '').replace(/"/g, '""')}"`,
      `"${(v.badgeNumber || '').replace(/"/g, '""')}"`,
      `"${v.checkInTime || ''}"`,
      `"${v.checkOutTime || ''}"`,
      `"${v.status || ''}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  },
};

/**
 * Offline QR Codes & Official Web Links Services (IndexedDB)
 */
export const offlineWebLinksService = {
  getWebLinks: async () => {
    try {
      let links = await db.weblinks.toArray();
      if (!links || links.length === 0) {
        const initialLinks = OFFICIAL_WEBLINKS.map((link, index) => ({
          ...link,
          isEnabled: link.isEnabled !== false,
          sortOrder: link.sortOrder ?? index,
        }));
        await db.weblinks.bulkAdd(initialLinks);
        links = await db.weblinks.toArray();
      }
      return links.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } catch (e) {
      console.warn('Failed to load weblinks from DB, falling back to static:', e);
      return OFFICIAL_WEBLINKS.map((l, i) => ({ ...l, isEnabled: true, sortOrder: i }));
    }
  },

  addWebLink: async (linkData) => {
    const existing = await db.weblinks.toArray();
    const maxOrder = existing.reduce((max, l) => Math.max(max, l.sortOrder ?? 0), -1);
    const newId = linkData.id || `link_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    
    // Auto-clean displayUrl
    let displayUrl = linkData.displayUrl || '';
    if (!displayUrl && linkData.url) {
      displayUrl = linkData.url.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }

    const newRecord = {
      id: newId,
      category: linkData.category || 'web',
      title: linkData.title || 'Official Portal',
      subtitle: linkData.subtitle || '',
      url: linkData.url || 'https://robomiracle.com',
      displayUrl,
      description: linkData.description || '',
      tag: (linkData.tag || 'OFFICIAL LINK').toUpperCase(),
      tagColor: linkData.tagColor || '#00ffff',
      accentColor: linkData.accentColor || '#00D5FF',
      badge: linkData.badge || 'Verified Link',
      isEnabled: linkData.isEnabled !== false,
      hasInKioskPreview: !!linkData.hasInKioskPreview,
      sortOrder: maxOrder + 1,
      createdAt: new Date().toISOString(),
    };

    await db.weblinks.put(newRecord);
    return newRecord;
  },

  updateWebLink: async (id, data) => {
    let record = await db.weblinks.get(id);
    if (!record) {
      record = await db.weblinks.where('id').equals(id).first();
    }
    if (!record) {
      throw new Error(`Web link not found with ID: ${id}`);
    }

    let displayUrl = data.displayUrl !== undefined ? data.displayUrl : record.displayUrl;
    if (!displayUrl && (data.url || record.url)) {
      displayUrl = (data.url || record.url).replace(/^https?:\/\//i, '').replace(/\/$/, '');
    }

    const updated = {
      ...record,
      ...data,
      displayUrl,
      tag: data.tag ? data.tag.toUpperCase() : record.tag,
      updatedAt: new Date().toISOString(),
    };

    await db.weblinks.put(updated);
    return updated;
  },

  toggleWebLinkEnabled: async (id, isEnabled) => {
    let record = await db.weblinks.get(id);
    if (!record) {
      record = await db.weblinks.where('id').equals(id).first();
    }
    if (record) {
      await db.weblinks.update(record.id, { isEnabled });
      return { success: true, isEnabled };
    }
    return { success: false };
  },

  deleteWebLink: async (id) => {
    let record = await db.weblinks.get(id);
    if (!record) {
      record = await db.weblinks.where('id').equals(id).first();
    }
    if (record) {
      await db.weblinks.delete(record.id);
      return { success: true };
    }
    return { success: false };
  },

  resetToDefaults: async () => {
    await db.weblinks.clear();
    const initialLinks = OFFICIAL_WEBLINKS.map((link, index) => ({
      ...link,
      isEnabled: true,
      sortOrder: index,
    }));
    await db.weblinks.bulkAdd(initialLinks);
    return await db.weblinks.toArray();
  },
};

/**
 * Offline Guided Robot Tour Services (IndexedDB)
 * Complete management of tour waypoints, hardware sync, order, and narration
 */
export const offlineTourService = {
  getStops: async () => {
    let stops = await db.tourStops.orderBy('orderIndex').toArray();
    if (!stops || stops.length === 0) {
      await db.tourStops.bulkAdd(DEFAULT_TOUR_STOPS);
      stops = await db.tourStops.orderBy('orderIndex').toArray();
    }
    return stops;
  },

  addStop: async (stopData) => {
    const existing = await db.tourStops.toArray();
    const nextOrder = existing.length > 0 
      ? Math.max(...existing.map((s) => s.orderIndex ?? 0)) + 1 
      : 0;

    const newStop = {
      name: (stopData.name || 'New Tour Waypoint').trim(),
      area: (stopData.area || 'Facility Area').trim(),
      orderIndex: nextOrder,
      isEnabled: stopData.isEnabled !== false,
      durationSec: Number(stopData.durationSec) || 12,
      highlights: Array.isArray(stopData.highlights) 
        ? stopData.highlights 
        : (stopData.highlights || '').split(',').map((h) => h.trim()).filter(Boolean),
      narration: (stopData.narration || '').trim(),
      rgbColor: stopData.rgbColor || '#00FFFF',
      servoTilt: Number(stopData.servoTilt) || 90,
      servoPan: Number(stopData.servoPan) || 90,
      mapX: Number(stopData.mapX) || 50,
      mapY: Number(stopData.mapY) || 50,
      createdAt: new Date().toISOString(),
    };

    const id = await db.tourStops.add(newStop);
    return await db.tourStops.get(id);
  },

  updateStop: async (id, data) => {
    const numId = parseNumericId(id);
    const existing = await db.tourStops.get(numId);
    if (!existing) {
      throw new Error(`Tour stop not found with ID: ${id}`);
    }

    const updated = {
      ...existing,
      ...data,
      highlights: Array.isArray(data.highlights) 
        ? data.highlights 
        : (data.highlights !== undefined ? data.highlights.split(',').map((h) => h.trim()).filter(Boolean) : existing.highlights),
      updatedAt: new Date().toISOString(),
    };

    await db.tourStops.put(updated);
    return updated;
  },

  deleteStop: async (id) => {
    const numId = parseNumericId(id);
    await db.tourStops.delete(numId);
    return { success: true };
  },

  toggleStopEnabled: async (id, isEnabled) => {
    const numId = parseNumericId(id);
    await db.tourStops.update(numId, { isEnabled });
    return { success: true, isEnabled };
  },

  reorderStops: async (orderedIds) => {
    for (let index = 0; index < orderedIds.length; index++) {
      const numId = parseNumericId(orderedIds[index]);
      await db.tourStops.update(numId, { orderIndex: index });
    }
    return await offlineTourService.getStops();
  },

  restoreDefaultStops: async () => {
    await db.tourStops.clear();
    await db.tourStops.bulkAdd(DEFAULT_TOUR_STOPS);
    return await db.tourStops.orderBy('orderIndex').toArray();
  },
};



