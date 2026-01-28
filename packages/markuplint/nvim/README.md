# vue-html-bridge.nvim

Neovim plugin for vue-html-bridge LSP server, providing HTML validation for Vue Single File Components.

## Features

- Automatic LSP server detection (Mason, global, and local installs)
- Real-time diagnostics for Vue files
- Integration with nvim-lspconfig
- Health check support (`:checkhealth vue-html-bridge`)

## Requirements

- Neovim >= 0.8.0
- [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
- Node.js >= 18.0.0
- vue-html-bridge-lsp (see Installation)

## Installation

### 1. Install the LSP Server

#### Option A: Mason (Recommended)

If you use [mason.nvim](https://github.com/williamboman/mason.nvim):

```vim
:MasonInstall vue-html-bridge-lsp
```

Or with mason-lspconfig:

```lua
require('mason').setup()
require('mason-lspconfig').setup {
  ensure_installed = { 'vue_html_bridge_lsp' }
}
```

#### Option B: npm (Global)

```bash
npm install -g vue-html-bridge-markuplint
```

#### Option C: npm (Local)

```bash
npm install vue-html-bridge-markuplint
```

### 2. Install the Plugin

#### lazy.nvim

```lua
{
  'nagashimam/vue-html-bridge.nvim',
  dependencies = { 'neovim/nvim-lspconfig' },
  ft = 'vue',
  opts = {},
}
```

#### packer.nvim

```lua
use {
  'nagashimam/vue-html-bridge.nvim',
  requires = { 'neovim/nvim-lspconfig' },
  ft = 'vue',
  config = function()
    require('vue-html-bridge').setup()
  end,
}
```

#### vim-plug

```vim
Plug 'neovim/nvim-lspconfig'
Plug 'nagashimam/vue-html-bridge.nvim'

" In your init.lua or after/plugin/vue-html-bridge.lua:
" lua require('vue-html-bridge').setup()
```

## Configuration

### Default Options

```lua
require('vue-html-bridge').setup {
  -- Automatically start LSP when opening Vue files
  autostart = true,

  -- Custom command (auto-detected if nil)
  cmd = nil,

  -- File types to attach to
  filetypes = { 'vue' },

  -- Patterns to find project root
  root_patterns = { 'package.json', '.git' },

  -- Additional options passed to lspconfig.vue_html_bridge.setup()
  lsp_opts = {},
}
```

### Custom LSP Server Path

```lua
require('vue-html-bridge').setup {
  cmd = { '/path/to/vue-html-bridge-lsp', '--stdio' },
}
```

### With Custom LSP Options

```lua
require('vue-html-bridge').setup {
  lsp_opts = {
    on_attach = function(client, bufnr)
      -- Your custom on_attach logic
    end,
    capabilities = require('cmp_nvim_lsp').default_capabilities(),
  },
}
```

## Commands

| Command | Description |
|---------|-------------|
| `:VueHtmlBridgeSetup` | Manually setup the LSP server |
| `:VueHtmlBridgeHealth` | Run health check |

## Health Check

Run `:checkhealth vue-html-bridge` to verify your setup:

```
vue-html-bridge: require("vue-html-bridge.health").check()

vue-html-bridge ~
- OK nvim-lspconfig is installed
- OK Node.js is installed: v20.10.0
- OK vue-html-bridge-lsp found (global): /usr/local/bin/vue-html-bridge-lsp
- OK Markuplint config found: .markuplintrc
```

## Markuplint Configuration

Create a `.markuplintrc` file in your project root:

```json
{
  "extends": ["markuplint:recommended"]
}
```

See [markuplint documentation](https://markuplint.dev/docs/configuration) for more options.

## Troubleshooting

### LSP server not starting

1. Run `:checkhealth vue-html-bridge` to diagnose issues
2. Verify the server is installed: `which vue-html-bridge-lsp`
3. Check `:LspInfo` for LSP client status

### No diagnostics appearing

1. Ensure you have a `.markuplintrc` config file
2. Check `:LspLog` for server errors
3. Verify the file is a `.vue` file

### Using with other Vue LSP servers

vue-html-bridge can run alongside Volar or other Vue LSP servers:

```lua
-- Both servers will attach to Vue files
require('vue-html-bridge').setup {}
require('lspconfig').volar.setup {}
```

## License

MIT
