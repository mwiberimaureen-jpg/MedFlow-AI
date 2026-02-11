/**
 * Utility functions for parsing AI-generated analysis text
 */

import { AnalysisSection } from '@/lib/types/analysis';

/**
 * Parses raw analysis text into structured sections
 * Supports multiple header formats:
 * - Markdown headers: ## Section Title
 * - Bold headers: **Section Title**
 * - Plain headers: SECTION TITLE:
 */
export function parseAnalysisText(raw: string): AnalysisSection[] {
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const sections: AnalysisSection[] = [];
  const lines = raw.split('\n');

  let currentSection: { title: string; content: string[] } | null = null;
  let order = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if line is a header
    let headerMatch =
      // Markdown headers: ## Title or ### Title
      trimmedLine.match(/^#{1,3}\s+(.+)$/) ||
      // Bold headers: **Title** or **Title:**
      trimmedLine.match(/^\*\*(.+?)\*\*:?\s*$/);

    // Uppercase headers: TITLE: or TITLE (but not single/double letters)
    if (!headerMatch) {
      const uppercaseMatch = trimmedLine.match(/^([A-Z][A-Z\s]{2,}):?\s*$/);
      if (uppercaseMatch && !trimmedLine.match(/^[A-Z]{1,3}\s/)) {
        headerMatch = uppercaseMatch;
      }
    }

    if (headerMatch && headerMatch[1]) {
      // Save previous section if exists
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim(),
          order: order++,
        });
      }

      // Start new section
      currentSection = {
        title: headerMatch[1].trim().replace(/:$/, ''),
        content: [],
      };
    } else if (currentSection) {
      // Add line to current section
      if (trimmedLine.length > 0 || currentSection.content.length > 0) {
        currentSection.content.push(line);
      }
    } else if (trimmedLine.length > 0) {
      // Content before first header - create "Summary" section
      if (!currentSection) {
        currentSection = {
          title: 'Summary',
          content: [line],
        };
      }
    }
  }

  // Don't forget the last section
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
