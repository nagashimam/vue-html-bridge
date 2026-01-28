-- Prevent double-loading
if vim.g.loaded_vue_html_bridge then
  return
end
vim.g.loaded_vue_html_bridge = true

-- Create user command for manual setup
vim.api.nvim_create_user_command('VueHtmlBridgeSetup', function()
  require('vue-html-bridge').setup()
end, { desc = 'Setup vue-html-bridge LSP' })

-- Create user command for health check
vim.api.nvim_create_user_command('VueHtmlBridgeHealth', function()
  vim.cmd('checkhealth vue-html-bridge')
end, { desc = 'Run vue-html-bridge health check' })
