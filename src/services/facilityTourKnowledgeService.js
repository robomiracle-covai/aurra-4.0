/**
 * Campus Facilities & Robot Tour Knowledge Service for Aurra LLM
 * - Formats IndexedDB facilities & robot tours into token-efficient knowledge blocks
 * - In-memory zero-latency cache (<0.1ms access) so LLM calls never lag
 * - Event-driven auto-invalidation on user changes in Admin Dashboard
 * - Dynamic prompt merger allowing seamless admin customization
 */

import { DEFAULT_FACILITIES } from '../data/defaultFacilities.js';
import { DEFAULT_ROBOT_TOURS } from '../data/defaultRobotTours.js';
import { logger } from './logger.js';

let cachedKnowledgeBlock = null;
let lastCacheTimestamp = 0;
const CACHE_TTL_MS = 60000; // 60s soft TTL, invalidated instantly on DB writes

/**
 * Formats campus facilities into compact, high-density text for LLM prompt context
 */
export function formatFacilitiesKnowledge(facilities) {
  const items = Array.isArray(facilities) && facilities.length > 0 ? facilities : DEFAULT_FACILITIES;
  const active = items.filter((f) => f.isEnabled !== false);

  if (active.length === 0) return '';

  const ground = active.filter((f) => f.floor === 'ground');
  const level1 = active.filter((f) => f.floor === 'first' || f.floor === 'level1');
  const level2 = active.filter((f) => f.floor === 'second' || f.floor === 'level2');

  const formatList = (list) =>
    list
      .map((f) => {
        const dir = f.directions ? ` | Path: ${f.directions}` : '';
        const hrs = f.hours ? ` (${f.hours})` : '';
        return `• [${f.code}] ${f.name} (${f.wing || 'Central'})${hrs}${dir}`;
      })
      .join('\n');

  let output = 'CAMPUS ROOM DIRECTORY & PUBLIC FACILITIES:\n';
  if (ground.length > 0) output += `[Ground Floor (Level 0)]:\n${formatList(ground)}\n`;
  if (level1.length > 0) output += `[Level 1 (First Floor)]:\n${formatList(level1)}\n`;
  if (level2.length > 0) output += `[Level 2 (Executive Floor)]:\n${formatList(level2)}\n`;

  return output.trim();
}

/**
 * Formats robot tours into compact knowledge for LLM prompt context
 */
export function formatRobotsKnowledge(robots) {
  const items = Array.isArray(robots) && robots.length > 0 ? robots : DEFAULT_ROBOT_TOURS;
  const active = items.filter((r) => r.isEnabled !== false);

  if (active.length === 0) return '';

  const lines = active.map((r) => {
    const subtitle = r.subtitle ? ` - ${r.subtitle}` : '';
    const badge = r.badge ? ` (${r.badge})` : '';
    const stepNames = (r.steps || []).map((s) => s.stepName || s.name).filter(Boolean).slice(0, 3).join(', ');
    const highlights = stepNames ? ` | Tour stops: ${stepNames}` : '';
    return `• ${r.title}${subtitle}${badge}${highlights}`;
  });

  return `GUIDED ROBOT TOUR SHOWCASE:\n${lines.join('\n')}`.trim();
}

/**
 * Returns formatted default baseline knowledge block
 */
export function getDefaultKnowledgeBlock() {
  const facBlock = formatFacilitiesKnowledge(DEFAULT_FACILITIES);
  const robotBlock = formatRobotsKnowledge(DEFAULT_ROBOT_TOURS);
  return `${robotBlock}\n\n${facBlock}`;
}

/**
 * Retrieves the live knowledge block using an in-memory cache (0ms lookup time)
 * Automatically falls back to defaults if database is still initializing
 */
export async function getLiveKnowledgeBlock(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedKnowledgeBlock && (now - lastCacheTimestamp < CACHE_TTL_MS)) {
    return cachedKnowledgeBlock;
  }

  try {
    // Dynamic import to avoid circular dependency with offlineServices
    const { offlineFacilityService, offlineRobotTourService } = await import('../db/offlineServices.js');
    
    const [facilities, robots] = await Promise.all([
      offlineFacilityService.getFacilities().catch(() => DEFAULT_FACILITIES),
      offlineRobotTourService.getRobots().catch(() => DEFAULT_ROBOT_TOURS),
    ]);

    const facBlock = formatFacilitiesKnowledge(facilities);
    const robotBlock = formatRobotsKnowledge(robots);
    cachedKnowledgeBlock = `${robotBlock}\n\n${facBlock}`.trim();
    lastCacheTimestamp = now;
    return cachedKnowledgeBlock;
  } catch (err) {
    logger.warn('KNOWLEDGE', `Could not load live IndexedDB knowledge, using defaults: ${err.message}`);
    cachedKnowledgeBlock = getDefaultKnowledgeBlock();
    lastCacheTimestamp = now;
    return cachedKnowledgeBlock;
  }
}

/**
 * Instantly invalidates the in-memory cache and triggers asynchronous background warm-up
 */
export function invalidateKnowledgeCache() {
  cachedKnowledgeBlock = null;
  lastCacheTimestamp = 0;
  // Non-blocking pre-warm in background
  setTimeout(() => {
    getLiveKnowledgeBlock(true).catch(() => {});
  }, 10);
}

/**
 * Merges live facilities and tour knowledge cleanly into an existing system prompt
 */
export function mergeKnowledgeIntoPrompt(existingPrompt, liveBlock) {
  if (!existingPrompt) return liveBlock;
  let updated = existingPrompt;

  // 1. If existing prompt already contains the sections, replace them cleanly
  const hasFac = updated.includes('CAMPUS ROOM DIRECTORY');
  const hasRobots = updated.includes('GUIDED ROBOT TOUR SHOWCASE');

  if (hasFac || hasRobots) {
    // Remove old blocks
    updated = updated.replace(/GUIDED ROBOT TOUR SHOWCASE:[\s\S]*?(?=\n\n[A-Z0-9\s\[\]_-]+:|$)/gi, '');
    updated = updated.replace(/CAMPUS ROOM DIRECTORY & PUBLIC FACILITIES:[\s\S]*?(?=\n\n[A-Z0-9\s\[\]_-]+:|$)/gi, '');
    updated = updated.trim();
  }

  // Insert before CONVERSATIONAL RULES if present
  if (updated.includes('CONVERSATIONAL RULES:')) {
    const parts = updated.split('CONVERSATIONAL RULES:');
    return `${parts[0].trim()}\n\n${liveBlock}\n\nCONVERSATIONAL RULES:${parts[1]}`.trim();
  }

  return `${updated}\n\n${liveBlock}`.trim();
}

// Pre-warm cache on application start and listen for admin updates
if (typeof window !== 'undefined') {
  window.addEventListener('aurra:knowledge-updated', () => {
    logger.info('KNOWLEDGE', 'Detected admin data update, refreshing LLM knowledge cache');
    invalidateKnowledgeCache();
  });

  // Pre-warm after initial thread boot
  setTimeout(() => {
    getLiveKnowledgeBlock(true).catch(() => {});
  }, 200);
}
