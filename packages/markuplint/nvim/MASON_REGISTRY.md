# Mason Registry Integration

This document describes how to add vue-html-bridge-lsp to the Mason registry for one-click installation via `:MasonInstall`.

## Prerequisites

1. The `vue-html-bridge-markuplint` package must be published to npm
2. The package must export a `vue-html-bridge-lsp` binary

## Steps to Submit PR

### 1. Fork mason-registry

Fork the repository: https://github.com/mason-org/mason-registry

### 2. Create Package Definition

Create the file `packages/vue-html-bridge-lsp/package.yaml`:

```yaml
---
name: vue-html-bridge-lsp
description: HTML validation LSP server for Vue Single File Components using markuplint
homepage: https://github.com/nagashimam/vue-html-bridge
licenses:
  - MIT
languages:
  - Vue
categories:
  - LSP

source:
  id: pkg:npm/vue-html-bridge-markuplint

bin:
  vue-html-bridge-lsp: npm:vue-html-bridge-lsp
```

### 3. Test Locally

```bash
cd mason-registry
make test PACKAGE=vue-html-bridge-lsp
```

### 4. Submit Pull Request

1. Commit your changes
2. Push to your fork
3. Create a PR to `mason-org/mason-registry`
4. Follow their [CONTRIBUTING.md](https://github.com/mason-org/mason-registry/blob/main/CONTRIBUTING.md) guidelines

## Package Definition Fields

| Field | Description |
|-------|-------------|
| `name` | Package name as used in `:MasonInstall` |
| `description` | Brief description shown in Mason UI |
| `homepage` | Link to the project repository |
| `licenses` | SPDX license identifiers |
| `languages` | Languages the server supports |
| `categories` | Must include `LSP` for language servers |
| `source.id` | Package URL (purl) format for npm package |
| `bin` | Binary mappings (name: npm package binary) |

## After Merge

Once the PR is merged:

1. Users can install via `:MasonInstall vue-html-bridge-lsp`
2. The plugin auto-detects Mason-installed binaries
3. Update documentation to recommend Mason as the primary install method

## Verification

After installation via Mason:

```vim
:checkhealth vue-html-bridge
```

Should show:
```
- OK vue-html-bridge-lsp found (Mason): ~/.local/share/nvim/mason/bin/vue-html-bridge-lsp
```
