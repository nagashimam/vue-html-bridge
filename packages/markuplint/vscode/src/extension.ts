import * as path from "path";
import { workspace, ExtensionContext } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

let client: LanguageClient;

export const activate = (context: ExtensionContext) => {
  // The server is implemented in node
  // In this monorepo setup, we'll look for the server in the sibling package
  // Adjust this path if the structure changes or for production bundling
  const serverModule = context.asAbsolutePath(
    path.join("..", "lsp", "dist", "index.js")
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: "file", language: "vue" }],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contained in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "vueHtmlBridge",
    "Vue HTML Bridge Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
