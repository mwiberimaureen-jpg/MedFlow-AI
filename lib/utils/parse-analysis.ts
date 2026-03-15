/**
 * Utility functions for parsing AI-generated analysis text
 */

import { AnalysisSection } from '@/lib/types/analysis';

/**
 * Parses raw analysis text into structured sections.
 *
 * Only `## Markdown headers` start new sections. Bold lines (`**Title**`) and
 * uppercase lines (`TITLE:`) are treated as content within sections — they are
 * sub-headers used inside Test Interpretation, Differential Diagnoses,
 * Complications, etc. and must NOT split those sections apart.
 *
 * For legacy text that has no `##` headers, falls back to bold / uppercase
 * header detection.
 */
export function parseAnalysisText(raw: string): AnalysisSection[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const lines = raw.split('\n');

  // Detect whether the text uses ## markdown headers at all
  const hasMarkdownHeaders = lines.some(l => /^#{1,3}\s+/.test(l.trim()));

  const sections: AnalysisSection[] = [];
  let currentSection: { title: string; content: string[] } | null = null;
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    let headerMatch: RegExpMatchArray | null = null;

    // Primary: Markdown headers (## Title or ### Title)
    headerMatch = trimmedLine.match(/^#{1,3}\s+(.+)$/);

    // Fallback: only use bold / uppercase headers when the text has NO ## headers
    if (!headerMatch && !hasMarkdownHeaders) {
      headerMatch = trimmedLine.match(/^\*\*(.+?)\*\*:?\s*$/);
      if (!headerMatch) {
        const uppercaseMatch = trimmedLine.match(/^([A-Z][A-Z\s]{2,}):?\s*$/);
        if (uppercaseMatch && !trimmedLine.match(/^[A-Z]{1,3}\s/)) {
          headerMatch = uppercaseMatch;
        }
      }
    }

    if (headerMatch && headerMatch[1]) {
      // Save previous section
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim(),
          order: order++,
        });
      }
      currentSection = {
        title: headerMatch[1].trim().replace(/:$/, ''),
        content: [],
      };
    } else if (currentSection) {
      if (trimmedLine.length > 0 || currentSection.content.length > 0) {
        currentSection.content.push(line);
      }
    } else if (trimmedLine.length > 0) {
      currentSection = {
        title: 'Summary',
        content: [line],
      };
    }
  }

  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim(),
      order: order++,
    });
  }

  return sections;
}

/**
 * Format text with basic markdown support
 * - __text__ or **text** -> bold
 * - _text_ or *text* -> italic
 */
export function formatMarkdown(text: string): string {
  return text
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

/**
 * Extract section by title
 */
export function getSectionByTitle(sections: AnalysisSection[], title: string): AnalysisSection | undefined {
  return sections.find(
    section => section.title.toLowerCase() === title.toLowerCase()
  );
}

/**
 * Get common medical analysis section titles
 */
export const COMMON_SECTIONS = {
  SUMMARY: 'Clinical Summary',
  GAPS: 'Gaps in History',
  TEST_INTERPRETATION: 'Test Interpretation',
  IMPRESSIONS: 'Impression(s)',
  DIFFERENTIAL: 'Differential Diagnoses',
  CONFIRMATORY_TESTS: 'Confirmatory Tests',
  MANAGEMENT: 'Management Plan',
  COMPLICATIONS: 'Possible Complications & Prevention',
} as const;

/**
 * Merge "Missing Information" sub-header into "Follow-up Questions".
 * Old analyses stored both; new analyses only have follow-up questions.
 */
export function mergeGapsContent(content: string): string {
  const lines = content.split('\n')
  const outputLines: string[] = []
  let skipMissingHeader = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (/^\*?\*?Missing Information:?\*?\*?:?\s*$/.test(trimmed)) {
      skipMissingHeader = true
      continue
    }
    if (skipMissingHeader) {
      // Stop skipping when we hit the next bold sub-header
      if (/^\*\*/.test(trimmed)) {
        skipMissingHeader = false
      } else {
        continue  // skip items under Missing Information
      }
    }
    outputLines.push(line)
  }

  let result = outputLines.join('\n')
  if (!/follow.up questions/i.test(result) && result.trim().length > 0) {
    result = '**Follow-up Questions:**\n' + result
  }
  return result.trim()
}
