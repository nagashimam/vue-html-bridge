#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Assuming the core library exports a function named 'processSFC'
// I will verify this in a later step if needed
import { bridge } from "@vue-html-bridge/core";

const main = () => {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error("Usage: vue-html-bridge <path-to-vue-sfc>");
    process.exit(1);
  }

  const absolutePath = resolve(process.cwd(), filePath);

  try {
    const sfcContent = readFileSync(absolutePath, "utf-8");
    const result = bridge(sfcContent);
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error(`Error processing file ${filePath}: ${error.message}`);
    process.exit(1);
  }
};

main();
