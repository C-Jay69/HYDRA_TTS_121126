import { Chunk } from '../types';

export const MIN_CHUNK_CHARS = 1200;
export const TARGET_CHUNK_CHARS = 1800;
export const MAX_CHUNK_CHARS = 2500;

/**
 * Sanitizes input text: normalizes Unicode, removes non-printable control characters,
 * collapses redundant whitespace, and normalizes paragraph breaks.
 */
export function sanitizeText(raw: string): string {
  if (!raw) return '';

  return raw
    .normalize('NFC')
    // Remove non-printable ASCII control characters (keeping \t, \n, \r)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Windows/Mac line endings to \n
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with spaces
    .replace(/\t/g, ' ')
    // Collapse multiple inline spaces to single space
    .replace(/[^\S\n]+/g, ' ')
    // Collapse 3 or more consecutive newlines to \n\n (paragraph break)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Splits a long piece of text into sentences without cutting words.
 */
function splitIntoSentences(text: string): string[] {
  // Regex matches sentences ending with . ! ? followed by space and uppercase or end of text
  const sentenceRegex = /[^.!?]+(?:[.!?]+["'”’]?\s*|$)/g;
  const matches = text.match(sentenceRegex);
  if (!matches || matches.length === 0) {
    return [text];
  }
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Handles unusually long sentences that exceed MAX_CHUNK_CHARS by splitting
 * at clause boundaries (commas, semicolons, dashes) or word boundaries.
 */
function splitLongSentence(sentence: string, maxLimit = MAX_CHUNK_CHARS): string[] {
  if (sentence.length <= maxLimit) return [sentence];

  const words = sentence.split(' ');
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxLimit) {
      current = current ? current + ' ' + word : word;
    } else {
      if (current) parts.push(current);
      current = word;
    }
  }

  if (current) parts.push(current);
  return parts;
}

/**
 * Smart Audio Chunking Engine:
 * - Targets 1,500 to 2,500 characters per chunk
 * - Always splits at paragraph boundaries (\n\n) first
 * - Falls back to sentence boundaries (. ! ?) if a paragraph exceeds MAX_CHUNK_CHARS
 * - Never splits mid-sentence unless single sentence exceeds MAX_CHUNK_CHARS
 */
export function smartChunkManuscript(
  rawText: string,
  options: {
    minChars?: number;
    targetChars?: number;
    maxChars?: number;
  } = {}
): Chunk[] {
  const sanitized = sanitizeText(rawText);
  if (!sanitized) return [];

  const maxLimit = options.maxChars ?? MAX_CHUNK_CHARS;
  const target = options.targetChars ?? TARGET_CHUNK_CHARS;

  // Step 1: Split into paragraphs
  const rawParagraphs = sanitized.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  // Step 2: Break oversized paragraphs into smaller units (sentences or clauses)
  const atomicUnits: string[] = [];

  for (const paragraph of rawParagraphs) {
    if (paragraph.length <= maxLimit) {
      atomicUnits.push(paragraph);
    } else {
      // Paragraph is too long, split by sentences
      const sentences = splitIntoSentences(paragraph);
      for (const sentence of sentences) {
        if (sentence.length <= maxLimit) {
          atomicUnits.push(sentence);
        } else {
          // Sentence exceeds max limit, split safely at words
          const subSentences = splitLongSentence(sentence, maxLimit);
          atomicUnits.push(...subSentences);
        }
      }
    }
  }

  // Step 3: Greedily bundle units into chunks
  const chunkTexts: string[] = [];
  let currentChunk = '';

  for (const unit of atomicUnits) {
    if (!currentChunk) {
      currentChunk = unit;
      continue;
    }

    // Try joining with double newline (if unit looks like a paragraph) or single space
    const separator = currentChunk.includes('\n\n') || unit.length > 300 ? '\n\n' : ' ';
    const candidate = currentChunk + separator + unit;

    if (candidate.length <= maxLimit) {
      currentChunk = candidate;
      // If we have reached our comfortable target threshold, close chunk at natural paragraph break
      if (currentChunk.length >= target && separator === '\n\n') {
        chunkTexts.push(currentChunk.trim());
        currentChunk = '';
      }
    } else {
      // Exceeds limit, push current and start new
      chunkTexts.push(currentChunk.trim());
      currentChunk = unit;
    }
  }

  if (currentChunk.trim()) {
    chunkTexts.push(currentChunk.trim());
  }

  // Map to structured Chunk objects
  return chunkTexts.map((text, index) => {
    const wordMatches = text.match(/\b\S+\b/g);
    const wordCount = wordMatches ? wordMatches.length : 0;

    return {
      id: index + 1,
      text,
      status: 'pending',
      audioUrl: null,
      duration: 0,
      charCount: text.length,
      wordCount,
      retryCount: 0,
    };
  });
}
