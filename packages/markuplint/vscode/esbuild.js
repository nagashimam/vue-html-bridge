const esbuild = require("esbuild");

const production = process.argv.includes("--production");

// Optional dependencies from @vue/compiler-sfc that we don't need
// These are template engines for consolidate.js
const optionalDeps = [
  "velocityjs",
  "dustjs-linkedin",
  "atpl",
  "liquor",
  "twig",
  "ejs",
  "eco",
  "jazz",
  "jqtpl",
  "hamljs",
  "hamlet",
  "whiskers",
  "haml-coffee",
  "hogan.js",
  "templayed",
  "handlebars",
  "underscore",
  "lodash",
  "walrus",
  "mustache",
  "just",
  "ect",
  "mote",
  "toffee",
  "dot",
  "bracket-template",
  "ractive",
  "nunjucks",
  "htmling",
  "babel-core",
  "plates",
  "react-dom/server",
  "react",
  "vash",
  "slm",
  "marko",
  "teacup/lib/express",
  "coffee-script",
  "squirrelly",
  "twing",
  "pug",
  "then-pug",
];

// Shared options
const baseOptions = {
  bundle: true,
  platform: "node",
  format: "cjs",
  sourcemap: !production,
  minify: production,
  target: "node18",
};

// Build extension client
const buildExtension = () =>
  esbuild.build({
    ...baseOptions,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    external: ["vscode"],
  });

// Build LSP server (bundles all dependencies)
const buildServer = () =>
  esbuild.build({
    ...baseOptions,
    entryPoints: ["../lsp/src/index.ts"],
    outfile: "dist/server.js",
    external: optionalDeps,
  });

const build = async () => {
  console.log("Building extension client...");
  await buildExtension();
  console.log("Building LSP server...");
  await buildServer();
  console.log("Build complete!");
};

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
