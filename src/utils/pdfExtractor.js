/**
 * Client-Side PDF Text Extraction & Chunking Engine for Aurra 4.0
 * Uses Mozilla pdfjs-dist with Vite asset bundling for 100% offline & Android WebView compatibility.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { apiTelemetryService } from '../services/apiTelemetryService';

// Configure local offline worker
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

/**
 * Converts Google Drive sharing / preview URLs to direct binary download URLs
 */
export function parseGoogleDriveDirectUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  // 1. Google Drive file URL: /file/d/{ID}
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}&confirm=t`;
  }

  // 2. Google Drive open id URL: id={ID}
  const driveIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (driveIdMatch && driveIdMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${driveIdMatch[1]}&confirm=t`;
  }

  // 3. Google Docs document: /document/d/{ID}
  const docMatch = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch && docMatch[1]) {
    return `https://docs.google.com/document/d/${docMatch[1]}/export?format=pdf`;
  }

  // 4. Google Sheets: /spreadsheets/d/{ID}
  const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (sheetMatch && sheetMatch[1]) {
    return `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=pdf`;
  }

  // 5. Google Slides: /presentation/d/{ID}
  const slideMatch = trimmed.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
  if (slideMatch && slideMatch[1]) {
    return `https://docs.google.com/presentation/d/${slideMatch[1]}/export/pdf`;
  }

  return trimmed;
}

/**
 * Downloads a PDF from a direct URL or Google Drive link
 * Uses Android native downloader bridge when on tablet (bypassing CORS)
 * Falls back to browser fetch with arrayBuffer
 */
export async function downloadPdfFromUrl(url) {
  const directUrl = parseGoogleDriveDirectUrl(url);
  if (!directUrl) throw new Error('Invalid URL provided.');
  const startTime = performance.now();

  // Try Android native bridge if available (avoids any CORS blocks on tablet)
  if (typeof window !== 'undefined' && window.AndroidLauncher?.downloadBase64) {
    try {
      const respJson = window.AndroidLauncher.downloadBase64(directUrl);
      const durationMs = performance.now() - startTime;
      if (respJson) {
        const parsed = JSON.parse(respJson);
        if (parsed.ok && parsed.base64) {
          apiTelemetryService.record({
            service: 'Google Drive / Android Bridge',
            method: 'GET',
            url: directUrl,
            status: 200,
            durationMs,
            request: { rawUrl: url, directUrl },
            response: { ok: true, sizeBytes: parsed.base64.length },
          });

          const binaryString = atob(parsed.base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        } else if (parsed.error) {
          apiTelemetryService.record({
            service: 'Google Drive / Android Bridge',
            method: 'GET',
            url: directUrl,
            status: 'ERR',
            durationMs,
            request: { rawUrl: url, directUrl },
            error: parsed.error,
          });
          console.warn('Native downloadBase64 returned error:', parsed.error);
        }
      }
    } catch (bridgeErr) {
      console.warn('Android downloadBase64 bridge failed, falling back to fetch:', bridgeErr);
    }
  }

  // Web Browser fetch (will also be intercepted by apiTelemetryService)
  const response = await fetch(directUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF (HTTP ${response.status})`);
  }
  return await response.arrayBuffer();
}

/**
 * Extracts text from a PDF File or ArrayBuffer page-by-page
 * @param {File|Blob|ArrayBuffer} fileOrBuffer
 * @param {Function} onProgress - Optional progress callback (page, totalPages)
 * @returns {Promise<{ pages: Array<{ pageNumber: number, text: string }>, fullText: string, pageCount: number }>}
 */
export async function extractTextFromPdf(fileOrBuffer, onProgress = null) {
  let arrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    arrayBuffer = fileOrBuffer;
  } else if (fileOrBuffer && typeof fileOrBuffer.arrayBuffer === 'function') {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else {
    throw new Error('Invalid PDF data format. Expected File, Blob, or ArrayBuffer.');
  }

  // Load document
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
    cMapPacked: true,
  });

  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pages = [];
  let fullText = '';

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Stitch text items together with proper line breaks
    let pageText = '';
    let lastY = null;

    for (const item of content.items) {
      if (typeof item.str !== 'string') continue;

      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 6) {
        pageText += '\n' + item.str;
      } else {
        pageText += (pageText.endsWith(' ') || pageText.endsWith('\n') || item.str.startsWith(' ') ? '' : ' ') + item.str;
      }
      lastY = item.transform[5];
    }

    const cleanPageText = pageText.replace(/\s+/g, ' ').trim();
    pages.push({
      pageNumber: pageNum,
      text: cleanPageText,
    });

    fullText += `\n--- Page ${pageNum} ---\n` + cleanPageText;

    if (onProgress) {
      onProgress(pageNum, pageCount);
    }
  }

  return {
    pages,
    fullText: fullText.trim(),
    pageCount,
  };
}

/**
 * Breaks extracted pages into overlapping semantic chunks for retrieval
 * @param {Array<{ pageNumber: number, text: string }>} pages
 * @param {number} maxWordsPerChunk - Target chunk size
 * @param {number} overlapWords - Overlap between consecutive chunks
 * @returns {Array<{ pageNumber: number, chunkIndex: number, text: string }>}
 */
export function chunkPdfPages(pages, maxWordsPerChunk = 250, overlapWords = 30) {
  const chunks = [];

  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (words.length <= maxWordsPerChunk) {
      chunks.push({
        pageNumber: page.pageNumber,
        chunkIndex: chunks.length,
        text: `[Page ${page.pageNumber}]: ${page.text}`,
      });
      continue;
    }

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxWordsPerChunk, words.length);
      const chunkText = words.slice(start, end).join(' ');
      chunks.push({
        pageNumber: page.pageNumber,
        chunkIndex: chunks.length,
        text: `[Page ${page.pageNumber}]: ${chunkText}`,
      });

      if (end >= words.length) break;
      start += (maxWordsPerChunk - overlapWords);
    }
  }

  return chunks;
}

/**
 * Extracts smart starter questions based on common headings, keywords, and topics
 * @param {Array<{ pageNumber: number, text: string }>} pages
 * @returns {Array<string>}
 */
export function generateStarterQuestions(pages) {
  const defaultQuestions = [
    'What is the main summary of this document?',
    'What are the key technical specifications or features mentioned?',
    'Who is the author or target audience of this document?',
    'What are the primary conclusions or instructions?',
  ];

  if (!pages || pages.length === 0) return defaultQuestions;

  const sampleText = pages.slice(0, 3).map((p) => p.text).join(' ');

  const suggestions = [];

  // Match chapter or section titles
  const headingMatches = sampleText.match(/(?:Chapter|Section|\bTopic|\bModule|\bOverview)\s+([A-Za-z0-9\s:—\-]{3,30})/gi);
  if (headingMatches && headingMatches.length > 0) {
    const firstTitle = headingMatches[0].trim();
    suggestions.push(`Tell me about ${firstTitle}`);
  }

  // Check for common business / engineering terms
  if (/\b(battery|power|charger|voltage)\b/i.test(sampleText)) {
    suggestions.push('What are the battery and power specifications?');
  }
  if (/\b(warranty|policy|terms|agreement)\b/i.test(sampleText)) {
    suggestions.push('What are the key terms or warranty policies?');
  }
  if (/\b(sensor|camera|vision|hardware|motor)\b/i.test(sampleText)) {
    suggestions.push('What sensors and hardware components are used?');
  }
  if (/\b(facility|campus|office|address|location)\b/i.test(sampleText)) {
    suggestions.push('Where is the office located and what facilities exist?');
  }

  // Deduplicate and fill up to 4 questions
  const combined = [...new Set([...suggestions, ...defaultQuestions])];
  return combined.slice(0, 4);
}
