#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validate } from "vue-html-bridge-markuplint";

const main = async () => {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: vue-html-bridge-markuplint <path-to-vue-file>");
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);

  try {
    const content = readFileSync(absolutePath, "utf-8");
    const violations = await validate(content, absolutePath);
    console.log(JSON.stringify(violations, null, 2));
    process.exit(violations.length > 0 ? 1 : 0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
};

main();
