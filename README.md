# vue-html-bridge

A static analysis bridge that converts Vue.js Single File Components (SFCs) into validatable HTML snapshots using Cartesian coverage.

## Overview

vue-html-bridge generates all structurally possible states of Vue templates without executing business logic, enabling comprehensive HTML validation with tools like markuplint.

### Core Philosophy: Cartesian Coverage

- **Logic Agnostic:** Tests both branches of conditionals regardless of runtime values
- **Permutations:** Total Output = (Prop Combinations) x (Variable Combinations) x (Template Branch Combinations)

## Packages

| Package | Description |
|---------|-------------|
| [vue-html-bridge-core](./packages/core) | Core bridge implementation |
| [vue-html-bridge-cli](./packages/cli) | Command-line interface |
| [vue-html-bridge-markuplint](./packages/markuplint) | Markuplint integration with LSP server |
| [vue-html-bridge-vscode](./packages/markuplint/vscode) | VSCode extension |
| [vue-html-bridge.nvim](./packages/markuplint/nvim) | Neovim plugin |

## Installation

### VSCode

Install the [vue-html-bridge extension](https://marketplace.visualstudio.com/items?itemName=nagashimam.vue-html-bridge) from the VSCode marketplace.

### Neovim

#### Option 1: Using vue-html-bridge.nvim (Recommended)

1. Install the LSP server:

```bash
npm install -g vue-html-bridge-markuplint
```

2. Add the plugin to your config (lazy.nvim example):

```lua
{
  'nagashimam/vue-html-bridge.nvim',
  dependencies = { 'neovim/nvim-lspconfig' },
  ft = 'vue',
  opts = {},
}
```

#### Option 2: Manual nvim-lspconfig Setup

1. Install the LSP server:

```bash
npm install -g vue-html-bridge-markuplint
```

2. Add to your Neovim config (`init.lua`):

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

if not configs.vue_html_bridge then
  configs.vue_html_bridge = {
    default_config = {
      cmd = { 'vue-html-bridge-lsp', '--stdio' },
      filetypes = { 'vue' },
      root_dir = lspconfig.util.root_pattern('package.json', '.git'),
      settings = {},
    },
  }
end

lspconfig.vue_html_bridge.setup {}
```

#### Option 3: Mason (Coming Soon)

```lua
require('mason').setup()
require('mason-lspconfig').setup {
  ensure_installed = { 'vue_html_bridge_lsp' }
}
```

### CLI

```bash
npm install -g vue-html-bridge-markuplint

# Validate a Vue file
vue-html-bridge-markuplint path/to/component.vue
```

### As a Library

```bash
npm install vue-html-bridge-core
```

```typescript
import { bridge } from 'vue-html-bridge-core';

const results = bridge(`
<template>
  <div v-if="show">Hello</div>
</template>

<script setup lang="ts">
const show = ref(true);
</script>
`);

// results is an array of { plain: string, annotated: string }
```

## Markuplint Configuration

Create a `.markuplintrc` file in your project:

```json
{
  "extends": ["markuplint:recommended"]
}
```

See [markuplint documentation](https://markuplint.dev/docs/configuration) for configuration options.

## How It Works

1. **Script Analysis** - Extracts props and variables with possible values
2. **Template Permutation** - Forks template at `v-if`, `v-show`, `v-for` directives
3. **Rendering** - Produces HTML permutations with source location annotations
4. **Validation** - Validates each permutation and maps violations back to source

## License

MIT
