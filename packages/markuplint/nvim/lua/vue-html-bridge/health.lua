local M = {}

function M.check()
  vim.health.start('vue-html-bridge')

  -- Check nvim-lspconfig
  local ok, _ = pcall(require, 'lspconfig')
  if ok then
    vim.health.ok('nvim-lspconfig is installed')
  else
    vim.health.error('nvim-lspconfig is not installed', {
      'Install nvim-lspconfig: https://github.com/neovim/nvim-lspconfig',
    })
  end

  -- Check Node.js
  if vim.fn.executable('node') == 1 then
    local handle = io.popen('node --version')
    if handle then
      local version = handle:read('*a')
      handle:close()
      vim.health.ok('Node.js is installed: ' .. vim.trim(version))
    else
      vim.health.ok('Node.js is installed')
    end
  else
    vim.health.error('Node.js is not installed', {
      'Install Node.js: https://nodejs.org/',
    })
  end

  -- Check LSP server binary
  local found_lsp = false

  -- Check Mason install first
  local mason_path = vim.fn.stdpath('data') .. '/mason/bin/vue-html-bridge-lsp'
  if vim.fn.executable(mason_path) == 1 then
    vim.health.ok('vue-html-bridge-lsp found (Mason): ' .. mason_path)
    found_lsp = true
  end

  -- Check global install
  if not found_lsp then
    local global_path = vim.fn.exepath('vue-html-bridge-lsp')
    if global_path and global_path ~= '' then
      vim.health.ok('vue-html-bridge-lsp found (global): ' .. global_path)
      found_lsp = true
    end
  end

  -- Check local node_modules
  if not found_lsp then
    local local_path = vim.fn.getcwd() .. '/node_modules/.bin/vue-html-bridge-lsp'
    if vim.fn.executable(local_path) == 1 then
      vim.health.ok('vue-html-bridge-lsp found (local): ' .. local_path)
      found_lsp = true
    end
  end

  if not found_lsp then
    vim.health.warn('vue-html-bridge-lsp not found', {
      'Install via Mason: :MasonInstall vue-html-bridge-lsp',
      'Or install globally: npm install -g vue-html-bridge-markuplint',
      'Or install locally: npm install vue-html-bridge-markuplint',
    })
  end

  -- Check for markuplint config
  local config_files = {
    '.markuplintrc',
    '.markuplintrc.json',
    '.markuplintrc.yaml',
    '.markuplintrc.yml',
    '.markuplintrc.js',
    '.markuplintrc.cjs',
    'markuplint.config.js',
    'markuplint.config.cjs',
  }

  local found_config = false
  for _, config_file in ipairs(config_files) do
    if vim.fn.filereadable(vim.fn.getcwd() .. '/' .. config_file) == 1 then
      vim.health.ok('Markuplint config found: ' .. config_file)
      found_config = true
      break
    end
  end

  if not found_config then
    vim.health.info('No markuplint config found (optional)', {
      'Create .markuplintrc to customize validation rules',
      'See: https://markuplint.dev/docs/configuration',
    })
  end
end

return M
