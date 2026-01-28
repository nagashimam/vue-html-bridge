# Vue HTML Bridge

Real-time HTML validation for Vue Single File Components (SFCs) using [markuplint](https://markuplint.dev/).

## Features

- **Real-time validation**: Get instant feedback as you edit Vue templates
- **markuplint integration**: Leverages markuplint's powerful HTML validation rules
- **Cartesian coverage**: Validates all possible template states by generating permutations of conditional branches (`v-if`/`v-else`, `v-show`, `v-for`)

## How It Works

Vue HTML Bridge is a static analysis tool that converts Vue SFCs into validatable HTML snapshots. Instead of executing your component, it analyzes the template structure and generates HTML for all possible states:

- **`v-if`/`v-else-if`/`v-else`**: Creates separate HTML outputs for each branch
- **`v-show`**: Generates both visible and hidden states
- **`v-for`**: Produces empty, single-item, and multiple-item variations

This ensures your HTML is valid across all runtime conditions without needing to run the component.

## Requirements

- VS Code 1.75.0 or higher
- A `.markuplintrc` configuration file (optional, uses defaults if not present)

## Configuration

The extension uses markuplint's standard configuration. Create a `.markuplintrc` file in your project root:

```json
{
  "rules": {
    "doctype": false,
    "required-h1": false
  }
}
```

See [markuplint documentation](https://markuplint.dev/docs/configuration) for all available rules.

## Links

- [GitHub Repository](https://github.com/nagashimam/vue-html-bridge)
- [Issue Tracker](https://github.com/nagashimam/vue-html-bridge/issues)
- [markuplint](https://markuplint.dev/)
