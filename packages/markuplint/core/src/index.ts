import { MLEngine } from "markuplint";
import { bridge, type BridgeOutput } from "vue-html-bridge-core";
import type { Violation } from "./types.js";

export type { Violation } from "./types.js";

const findStartLocation = (html: string, line: number, col: number): number => {
  const lines = html.split(/\r?\n/);
  let index = 0;
  for (let i = 0; i < line - 1; i++) {
    index += lines[i].length + 1;
  }
  return index + col - 1;
};

const refineLocationWithAttribute = (
  tagContent: string,
  raw: string,
  originalLine: number,
  originalCol: number
): { line: number; col: number } => {
  const attrNameMatch = raw.match(/^([a-zA-Z0-9-:]+)(?:=|$)/);
  if (!attrNameMatch) return { line: originalLine, col: originalCol };

  const attrName = attrNameMatch[1];
  const attrLineMatch = tagContent.match(
    new RegExp(`data-${attrName}-start-line="(\\d+)"`)
  );
  const attrColMatch = tagContent.match(
    new RegExp(`data-${attrName}-start-column="(\\d+)"`)
  );

  if (attrLineMatch && attrColMatch) {
    return {
      line: parseInt(attrLineMatch[1], 10),
      col: parseInt(attrColMatch[1], 10),
    };
  }

  return { line: originalLine, col: originalCol };
};

const mapLocation = (
  html: string,
  line: number,
  col: number,
  raw: string
): { line: number; col: number } => {
  const index = findStartLocation(html, line, col);

  const tagStartIndex = html.lastIndexOf("<", index);
  if (tagStartIndex === -1) return { line, col };

  const tagEndIndex = html.indexOf(">", tagStartIndex);
  if (tagEndIndex === -1) return { line, col };

  const tagContent = html.substring(tagStartIndex, tagEndIndex + 1);

  const lineMatch = tagContent.match(/data-start-line="(\d+)"/);
  const colMatch = tagContent.match(/data-start-column="(\d+)"/);

  if (lineMatch && colMatch) {
    const originalLine = parseInt(lineMatch[1], 10);
    const originalCol = parseInt(colMatch[1], 10);
    return refineLocationWithAttribute(
      tagContent,
      raw,
      originalLine,
      originalCol
    );
  }

  return { line, col };
};

const processPermutation = async (
  perm: BridgeOutput,
  templatePath: string,
  seen: Set<string>,
  allViolations: Violation[]
) => {
  const engine = await MLEngine.fromCode(perm.annotated, {
    name: `${templatePath}.html`,
  });

  const result = await engine.exec();
  if (!result) return;

  for (const v of result.violations) {
    const key = `${v.ruleId}:${v.message}`;
    if (seen.has(key)) continue;

    const mapped = mapLocation(perm.annotated, v.line, v.col, v.raw);

    allViolations.push({
      ruleId: v.ruleId,
      message: v.message,
      line: mapped.line,
      col: mapped.col,
      raw: v.raw,
      relatedInfo: perm.plain,
    });
    seen.add(key);
  }
};

export const validate = async (
  template: string,
  templatePath: string
): Promise<Violation[]> => {
  const permutations = bridge(template);
  const allViolations: Violation[] = [];
  const seen = new Set<string>();

  for (const perm of permutations) {
    await processPermutation(perm, templatePath, seen, allViolations);
  }

  return allViolations;
};
