import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB Hard limit

// Configure pdf.js worker safely
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
}

export interface ParseResult {
  text: string;
  isLegacyDocWarning: boolean;
  charCount: number;
  wordCount: number;
}

/**
 * Strips Markdown syntax so TTS does not read formatting symbols aloud.
 */
export function stripMarkdown(raw: string): string {
  let text = raw;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, ' [code section omitted] ');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Remove images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '');

  // Convert links [anchor](url) -> anchor
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove reference-style links [anchor][id]
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // Remove headings (#, ##, etc.)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // Remove bold/italics (***word***, **word**, *word*, ___word___, __word__, _word_)
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, '$2');

  // Remove strikethrough (~~word~~)
  text = text.replace(/~~(.*?)~~/g, '$1');

  // Remove blockquotes (> quote)
  text = text.replace(/^>\s+/gm, '');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // Clean bullet list markers (* item, - item, + item)
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');

  // Remove inline code ticks
  text = text.replace(/`([^`]+)`/g, '$1');

  return text;
}

/**
 * Best-effort binary extractor for legacy .doc files
 * Scans printable UTF-8 / ASCII strings and groups them into coherent paragraphs
 */
function extractTextFromBinaryDoc(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const chunks: string[] = [];
  let currentWord = '';

  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // Check if printable ASCII (32 to 126), newline (10), carriage return (13), or tab (9)
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentWord += String.fromCharCode(b);
    } else {
      if (currentWord.trim().length > 3) {
        chunks.push(currentWord.trim());
      }
      currentWord = '';
    }
  }

  if (currentWord.trim().length > 3) {
    chunks.push(currentWord.trim());
  }

  // Filter out binary metadata artifacts and join coherent sentences
  const cleaned = chunks
    .filter((c) => !c.includes('WordDocument') && !c.includes('Microsoft') && !c.includes('CompObj') && !c.includes('\u0000'))
    .join(' ');

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Extracts clean text from an uploaded manuscript file
 */
export async function parseManuscriptFile(file: File): Promise<ParseResult> {
  // 1. Strict 5 MB Size Validation
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(
      `File size exceeds the 5 MB limit (Current: ${sizeInMb} MB). Please upload a smaller file.`
    );
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  let extractedText = '';
  let isLegacyDocWarning = false;

  switch (extension) {
    case 'txt': {
      const text = await file.text();
      extractedText = text;
      break;
    }

    case 'md': {
      const rawText = await file.text();
      extractedText = stripMarkdown(rawText);
      break;
    }

    case 'docx': {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      extractedText = result.value;
      break;
    }

    case 'pdf': {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const pageTexts: string[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let lastY: number | null = null;
        let pageStr = '';

        for (const item of textContent.items as any[]) {
          if ('str' in item) {
            // If vertical position changed substantially, treat as paragraph break
            const currentY = item.transform ? item.transform[5] : null;
            if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 12) {
              pageStr += '\n\n' + item.str;
            } else {
              pageStr += (pageStr.length && !pageStr.endsWith(' ') && !pageStr.endsWith('\n') ? ' ' : '') + item.str;
            }
            lastY = currentY;
          }
        }

        if (pageStr.trim()) {
          pageTexts.push(pageStr.trim());
        }
      }

      extractedText = pageTexts.join('\n\n');
      break;
    }

    case 'doc': {
      const arrayBuffer = await file.arrayBuffer();
      extractedText = extractTextFromBinaryDoc(arrayBuffer);
      isLegacyDocWarning = true;
      break;
    }

    default:
      throw new Error(
        `Unsupported file format ".${extension}". Supported formats: .txt, .md, .docx, .pdf, and .doc`
      );
  }

  if (!extractedText || !extractedText.trim()) {
    throw new Error('Could not extract any readable text from this document. Please ensure the file is not empty or encrypted.');
  }

  const cleanText = extractedText.trim();
  const wordCount = (cleanText.match(/\b\S+\b/g) || []).length;

  return {
    text: cleanText,
    isLegacyDocWarning,
    charCount: cleanText.length,
    wordCount,
  };
}
