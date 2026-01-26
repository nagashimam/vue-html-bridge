# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx vitest run packages/core/src/index.test.ts

# Run markuplint tests
npx vitest run packages/markuplint/core/src/index.test.ts

# Run tests matching a pattern
npx vitest run -t "v-if"

# Build core package
npm run build -w vue-html-bridge-core

# Build markuplint package (includes core + lsp)
npm run build -w vue-html-bridge-markuplint

# Build VSCode extension
npm run build:vscode

# Build all packages
npm run build -w vue-html-bridge-core && npm run build -w vue-html-bridge-markuplint && npm run compile -w vue-html-bridge-vscode

# Run CLI on a Vue file
npx tsx packages/cli/src/index.ts path/to/file.vue

# Run markuplint CLI on a Vue file
npx vue-html-bridge-markuplint path/to/file.vue
```

## Quality Guidelines

1. **ESLint with TypeScript:** Use ESLint with the TypeScript plugin and their recommended rules to follow best practices
2. **Prettier:** Use Prettier to maintain consistent coding style
3. **Low Coupling, High Cohesion:** Code should aim for low coupling and high cohesion
4. **Nesting Limit:** Functions should not nest 4 levels or more (Guideline 3 takes priority)
5. **Function Length:** Each function should not exceed 30 lines (Guideline 3 takes priority)
6. **No dead code:** Remove unused variables, functions, and imports
7. **Arrow Functions:** Prefer arrow functions for function declarations
8. **No any** Don't use `any` type; prefer specific types or generics

## Architecture Overview

This project is a **static analysis bridge** that converts Vue.js Single File Components (SFCs) into validatable HTML snapshots using **Cartesian coverage** (generating all structurally possible states without executing business logic).

### Pipeline

1. **Script Analysis** (`@babel/parser`) - Extracts props and variables with their possible values
2. **Template Permutation** (`@vue/compiler-dom`) - Forks template AST at control flow directives
3. **Rendering** - Produces plain HTML and annotated HTML with source locations
4. **Validation** (`markuplint`) - Validates HTML permutations and maps violations to source
5. **LSP Server** (`vscode-languageserver`) - Provides real-time validation in editors
6. **VSCode Extension** - User interface for the validation pipeline

### Key Files

- `packages/core/src/index.ts` - Main bridge implementation (exports `bridge()` function)
- `packages/core/src/index.test.ts` - Test suite based on TEST_SPECIFICATION.md
- `packages/cli/src/index.ts` - CLI wrapper that reads .vue files and outputs JSON
- `packages/markuplint/core/src/index.ts` - Markuplint validation integration
- `packages/markuplint/lsp/src/index.ts` - LSP server implementation
- `packages/markuplint/vscode/src/extension.ts` - VSCode extension entry point
- `TEST_SPECIFICATION.md` - Test cases with expected inputs/outputs

### Package Dependency Graph

```
vue-html-bridge-vscode → vue-html-bridge-markuplint/lsp → vue-html-bridge-markuplint → vue-html-bridge-core
vue-html-bridge-cli → vue-html-bridge-core
```

---

## Requirements Specification

### Project Goal
Create a static analysis bridge that converts Vue.js SFCs into pure, validatable HTML snapshots for HTML validators (markuplint, Nu HTML Checker) with 100% logic coverage.

### Core Philosophy: Cartesian Coverage
Generate a **Cartesian Product** of all structurally possible states without evaluating JavaScript business logic.

* **Logic Agnostic:** Test **both** branches regardless of runtime values
* **Permutations:** Total Output = (Prop Combinations) × (Variable Combinations) × (Template Branch Combinations)

---

### Phase 1: Script Analysis (`@babel/parser`)
Analyze `<script>` and `<script setup>` blocks to build a "Data Context":

* **`defineProps` Extraction:**
    * **Union Types:** `status: "open" | "closed"` → generate variation for each member
    * **Booleans:** `boolean` → expand to `[true, false]`
    * **Complex Types:** Fallback to mock strings (`mock-propName`)
* **Variable Extraction:**
    * **Type Priority:** Use type annotation members if present (`const tab: 'home' | 'settings'`)
    * **Value Fallback:** Use initial value if no type (`const title = "Hello"`)
    * **Refs:** Unwrap `ref('value')` to extract inner value
    * **Arrays:** Capture array literals for `v-for` data sources

### Phase 2: Template Permutation (The "Multiverse Engine")
Traverse the Template AST recursively, "forking" at control flow directives:

| Directive | Permutation Logic |
| :--- | :--- |
| **`v-if`** | Fork: Create one branch per `v-if`/`v-else-if`/`v-else` |
| **Implicit Else** | If `v-if` has no `v-else`, create an explicit empty branch |
| **`v-show`** | Fork: Visible state + Hidden (empty) state |
| **`v-for`** | **Known arrays:** Empty + Plural (all items). **Unknown arrays:** Empty, Single, Plural with mock values (`mock-{iteratorName}`) |
| **`<template>`** | Unwrap: Render children directly, discard wrapper tag |

### Phase 3: Rendering & Scope Injection
Render permuted AST to HTML strings:

* **Directive Stripping:** Remove `v-*`, `@click`, etc. from output
* **Scope Substitution:**
    * Interpolation: `{{ var }}` → concrete value
    * Bindings: `:attr="var"` → `attr="value"`
    * Loop Variables: Inject actual array data into child scope
* **Annotation Mode (Source Mapping):**
    * **Line Reference:** Line 1 is the `<template>` tag itself
    * **Elements:** `data-start-line`, `data-start-column`, `data-end-line`, `data-end-column`
    * **Attributes:** `data-{attrName}-start-line`, `data-{attrName}-start-column`, `data-{attrName}-end-line`, `data-{attrName}-end-column` (covers the entire directive, e.g., `:disabled="isDisabled"`)
    * **v-for copies:** All copies point back to the original source location

---

### Input / Output Specification

**Input:** A valid `.vue` file content string

**Output:**
```typescript
type BridgeOutput = {
  plain: string;      // Pure HTML for validation
  annotated: string;  // HTML with data-line/column attributes
}[]
```

### Technology Stack

- **Parser (Script):** @babel/parser (with TypeScript plugin)
- **Parser (Template):** @vue/compiler-dom
- **SFC Splitter:** @vue/compiler-sfc
- **Validator:** markuplint
- **LSP:** vscode-languageserver
- **VSCode Client:** vscode-languageclient

---

## Test Specification

Test cases are in `TEST_SPECIFICATION.md` with format:

```markdown
## {{test suite name}}

### {{test case name}}

#### input
{{input string}}

#### output
{{output array}}
```
