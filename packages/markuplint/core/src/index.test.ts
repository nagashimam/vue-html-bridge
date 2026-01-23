import { describe, expect, it } from "vitest";
import { validate } from "./index";
import { resolve } from "path";

describe("Markuplint Integration", () => {
  // Use a dummy path for templatePath so markuplint looks up the .markuplintrc in this package
  // Since we are running from root, 'packages/markuplint/dummy.vue' should work if we rely on CWD resolution
  // or relative path from CWD.
  const templatePath = resolve(__dirname, "../dummy.vue");

  it("should detect violations and map them back to source", async () => {
    // Input is now a Vue SFC string
    const input = `<template>
  <img src="foo">
</template>`;

    const violations = await validate(input, templatePath);

    // markuplint:recommended should flag missing alt on <img>
    const requiredAttr = violations.find((v) => v.ruleId === "required-attr");
    expect(requiredAttr).toBeDefined();
    // In Vue SFC:
    // Line 1: <template>
    // Line 2:   <img src="foo">
    // So line should be 2.
    // Col start of <img is 3 (2 spaces indentation + 1 for <)
    expect(requiredAttr?.line).toBe(2);
    expect(requiredAttr?.col).toBe(3);
  });

  it("should filter duplicate violations", async () => {
    const input = `<template>
  <img src="a">
  <img src="b">
</template>`;

    const violations = await validate(input, templatePath);

    // Both images are missing 'alt', 'width', 'height'.
    // Filtering should ensure each unique (ruleId, message) is only reported once.

    // required-attr reports for 'width' and 'height' (2 violations).
    const requiredAttrCount = violations.filter(
      (v) => v.ruleId === "required-attr"
    ).length;
    expect(requiredAttrCount).toBe(2);

    // require-accessible-name reports for 'alt' (1 violation).
    const accessibleNameCount = violations.filter(
      (v) => v.ruleId === "require-accessible-name"
    ).length;
    expect(accessibleNameCount).toBe(1);
  });

  it("should map to attribute-specific location if available", async () => {
    const input = `<template>
  <div aria-hidden="invalid"></div>
</template>`;

    const violations = await validate(input, templatePath);

    // aria-hidden="invalid" should be a violation
    const invalidAttr = violations.find((v) => v.ruleId === "wai-aria");
    // Note: Rule ID might be different based on config, but previous output showed "wai-aria"

    if (invalidAttr) {
      expect(invalidAttr.line).toBe(2);
      // <div aria-hidden="invalid"></div>
      // 12345678...
      //   <div aria-hidden="invalid">
      // Start of <div is col 3.
      // Start of aria-hidden is col 8.
      expect(invalidAttr.col).toBe(8);
    } else {
      // Fail if not found
      expect(violations.map((v) => v.ruleId)).toContain("wai-aria");
    }
  });

  it("should handle v-if permutations", async () => {
    // This ensures bridge is actually running and generating permutations
    const input = `<template>
  <div v-if="true">
     <img src="a">
  </div>
  <div v-else>
     <img src="b">
  </div>
</template>`;

    const violations = await validate(input, templatePath);

    // Should find violations for img tags.
    // Should filter duplicates.

    const accessibleNameCount = violations.filter(
      (v) => v.ruleId === "require-accessible-name"
    ).length;
    expect(accessibleNameCount).toBe(1);
  });
});
