import { MLEngine } from "markuplint";
import { bridge, type BridgeOutput } from "@vue-html-bridge/core";

export type Violation = {
  ruleId: string;
  message: string;
  line: number;
  col: number;
  raw: string;
};

export async function validate(
  template: string,
  templatePath: string
): Promise<Violation[]> {
  const permutations = bridge(template);
  const allViolations: Violation[] = [];
  const seen = new Set<string>();

  for (const perm of permutations) {
    // We append .html to templatePath to trick markuplint into treating it as HTML
    // while still respecting directory-based config.
    const engine = await MLEngine.fromCode(perm.annotated, {
      name: `${templatePath}.html`,
    });

    const result = await engine.exec();

    for (const v of result.violations) {
      const key = `${v.ruleId}:${v.message}`;
      if (seen.has(key)) continue;

      // Map back to original location
      const mapped = mapLocation(perm.annotated, v.line, v.col, v.raw);
      
      const violation: Violation = {
        ruleId: v.ruleId,
        message: v.message,
        line: mapped.line,
        col: mapped.col,
        raw: v.raw,
      };

      allViolations.push(violation);
      seen.add(key);
    }
  }

  return allViolations;
}

function mapLocation(
  html: string,
  line: number,
  col: number,
  raw: string
): { line: number; col: number } {
  // 1. Find the index in the string corresponding to line/col
  const lines = html.split(/\r?\n/);
  let index = 0;
  for (let i = 0; i < line - 1; i++) {
    index += lines[i].length + 1; // +1 for newline
  }
  index += col - 1;

  // 2. Search backwards for the start of the tag '<'
  // We want the nearest preceding '<' that isn't part of a comment or inside quotes? 
  // Simplified: just look for the last '<' before this index.
  const tagStartIndex = html.lastIndexOf("<", index);
  if (tagStartIndex === -1) return { line, col };

  // 3. Extract the tag content to parse attributes
  const tagEndIndex = html.indexOf(">", tagStartIndex);
  if (tagEndIndex === -1) return { line, col };

  const tagContent = html.substring(tagStartIndex, tagEndIndex + 1);

  // 4. Try to find the specific attribute if 'raw' matches a known attribute pattern
  // Or just fall back to element start.
  
  // Regex to find data-start-line and data-start-column
  const lineMatch = tagContent.match(/data-start-line="(\d+)"/);
  const colMatch = tagContent.match(/data-start-column="(\d+)"/);

  if (lineMatch && colMatch) {
    let originalLine = parseInt(lineMatch[1], 10);
    let originalCol = parseInt(colMatch[1], 10);

    // Try to refine for attribute-specific errors
    // If the violation 'raw' corresponds to an attribute, we might check for data-{attr}-... 
    // But 'raw' is just the substring. 
    // Example: raw="aria-hidden". We look for data-aria-hidden-start-line.
    
    // Attempt to extract attribute name from raw if it looks like an attribute
    // raw could be 'foo="bar"' or just 'foo'
    const attrNameMatch = raw.match(/^([a-zA-Z0-9-:]+)(?:=|$)/);
    if (attrNameMatch) {
      const attrName = attrNameMatch[1];
      const attrLineMatch = tagContent.match(
        new RegExp(`data-${attrName}-start-line="(\\d+)"`),
      );
      const attrColMatch = tagContent.match(
        new RegExp(`data-${attrName}-start-column="(\\d+)"`),
      );
        
        if (attrLineMatch && attrColMatch) {
            originalLine = parseInt(attrLineMatch[1], 10);
            originalCol = parseInt(attrColMatch[1], 10);
        }
    }

    return { line: originalLine, col: originalCol };
  }

  return { line, col };
}