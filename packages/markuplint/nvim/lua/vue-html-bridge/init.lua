local M = {}

M.defaults = {
  autostart = true,
  cmd = nil, -- Auto-detect or user override
  filetypes = { 'vue' },
  root_patterns = { 'package.json', '.git' },
}

--- Find the vue-html-bridge-lsp executable
---@return string[]|nil
local function get_cmd()
  -- Try Mason install path first (highest priority)
  local mason_path = vim.fn.stdpath('data') .. '/mason/bin/vue-html-bridge-lsp'
  if vim.fn.executable(mason_path) == 1 then
    return { mason_path, '--stdio' }
  end

  -- Try global npm install
  local global_path = vim.fn.exepath('vue-html-bridge-lsp')
  if global_path and global_path ~= '' then
    return { global_path, '--stdio' }
  end

  -- Fallback: check node_modules in current directory
  local node_modules_path = vim.fn.getcwd() .. '/node_modules/.bin/vue-html-bridge-lsp'
  if vim.fn.executable(node_modules_path) == 1 then
    return { node_modules_path, '--stdio' }
  end

  -- Check node_modules relative to root_dir (will be handled by on_new_config)
  return nil
end

--- Setup the vue-html-bridge LSP server
---@param opts table|nil Configuration options
function M.setup(opts)
  opts = vim.tbl_deep_extend('force', M.defaults, opts or {})

  local ok, lspconfig = pcall(require, 'lspconfig')
  if not ok then
    vim.notify(
      'vue-html-bridge: nvim-lspconfig is required. Install it first.',
      vim.log.levels.ERROR
    )
    return
  end

  local configs = require('lspconfig.configs')

  local cmd = opts.cmd or get_cmd()
  if not cmd then
    vim.notify(
      'vue-html-bridge-lsp not found. Install with: npm install -g vue-html-bridge-markuplint',
      vim.log.levels.WARN
    )
    return
  end

  if not configs.vue_html_bridge then
    configs.vue_html_bridge = {
      default_config = {
        cmd = cmd,
        filetypes = opts.filetypes,
        root_dir = lspconfig.util.root_pattern(unpack(opts.root_patterns)),
        settings = {},
        on_new_config = function(new_config, new_root_dir)
          -- Try to find local node_modules binary if global not found
          if not new_config.cmd or vim.fn.executable(new_config.cmd[1]) ~= 1 then
            local local_path = new_root_dir .. '/node_modules/.bin/vue-html-bridge-lsp'
            if vim.fn.executable(local_path) == 1 then
              new_config.cmd = { local_path, '--stdio' }
            end
          end
        end,
      },
    }
  end

  if opts.autostart then
    lspconfig.vue_html_bridge.setup(opts.lsp_opts or {})
  end
end

return M
