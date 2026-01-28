# vue-html-bridge-lsp

Language Server Protocol (LSP) server for validating Vue Single File Components using vue-html-bridge and markuplint.

## What It Does

This LSP server provides real-time HTML validation for Vue SFCs by:

1. Converting Vue templates into validatable HTML snapshots (Cartesian coverage)
2. Running markuplint validation on each generated permutation
3. Mapping violations back to original source locations
4. Reporting diagnostics to your editor

## Installation

### Global Install (Recommended for Neovim)

```bash
npm install -g vue-html-bridge-markuplint
```

This installs the `vue-html-bridge-lsp` binary globally.

### Local Install

```bash
npm install vue-html-bridge-markuplint
```

The binary is available at `./node_modules/.bin/vue-html-bridge-lsp`.

## Neovim Configuration

### Using nvim-lspconfig

Add to your Neovim config (`init.lua`):

```lua
local lspconfig = require('lspconfig')
local configs = require('lspconfig.configs')

-- Register the server if not already defined
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

-- Enable the server
lspconfig.vue_html_bridge.setup {}
```

### Using vue-html-bridge.nvim Plugin

For a simpler setup, use the dedicated Neovim plugin:

```lua
-- lazy.nvim
{
  'nagashimam/vue-html-bridge.nvim',
  dependencies = { 'neovim/nvim-lspconfig' },
  ft = 'vue',
  opts = {},
}
```

See [packages/markuplint/nvim](../nvim/) for more details.

## VSCode

For VSCode users, install the [vue-html-bridge extension](https://marketplace.visualstudio.com/items?itemName=nagashimam.vue-html-bridge) instead.

## Supported Features

- Real-time diagnostics for Vue files
- Source location mapping (violations point to original `.vue` file locations)
- Integration with markuplint configuration files

## Markuplint Configuration

Create a `.markuplintrc` file in your project root to configure validation rules:

```json
{
  "extends": ["markuplint:recommended"]
}
```

See [markuplint documentation](https://markuplint.dev/docs/configuration) for more configuration options.

## Requirements

- Node.js >= 18.0.0
- An editor with LSP client support (Neovim, VSCode, etc.)

## License

MIT
