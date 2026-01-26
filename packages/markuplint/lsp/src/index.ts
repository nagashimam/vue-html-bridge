import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
  DiagnosticSeverity,
  WorkspaceFoldersChangeEvent,
  TextDocumentChangeEvent,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import { validate, type Violation } from "vue-html-bridge-markuplint";
import { fileURLToPath } from "url";

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let _hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities;

  // Does the client support the `workspace/configuration` request?
  // If not, we fall back using global settings.
  hasConfigurationCapability = !!(
    capabilities.workspace && !!capabilities.workspace.configuration
  );
  hasWorkspaceFolderCapability = !!(
    capabilities.workspace && !!capabilities.workspace.workspaceFolders
  );
  _hasDiagnosticRelatedInformationCapability =
    !!capabilities.textDocument?.publishDiagnostics?.relatedInformation;

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
    },
  };
  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    };
  }
  return result;
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    // Register for all configuration changes.
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(
      (_event: WorkspaceFoldersChangeEvent) => {
        // connection.console.log('Workspace folder change event received.');
      }
    );
  }
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(
  (change: TextDocumentChangeEvent<TextDocument>) => {
    validateTextDocument(change.document);
  }
);

const processDiagnostics = (violations: Violation[]): Diagnostic[] => {
  return violations.map((v) => {
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Error,
      range: {
        start: {
          line: Math.max(0, v.line - 1),
          character: Math.max(0, v.col - 1),
        },
        end: {
          line: Math.max(0, v.line - 1),
          character: Math.max(0, v.col + v.raw.length - 1),
        },
      },
      message: `${v.message}\n\nGenerated HTML:\n${v.relatedInfo}`,
      source: "vue-html-bridge",
    };

    if (v.ruleId) {
      diagnostic.code = v.ruleId;
    }

    return diagnostic;
  });
};

const validateTextDocument = async (
  textDocument: TextDocument
): Promise<void> => {
  // Only process .vue files
  if (
    !textDocument.uri.endsWith(".vue") &&
    !textDocument.uri.endsWith(".vue.git")
  ) {
    return;
  }

  // We need a file path for markuplint to find config.
  if (!textDocument.uri.startsWith("file://")) {
    return;
  }

  try {
    const filePath = fileURLToPath(textDocument.uri);
    const text = textDocument.getText();

    const violations = await validate(text, filePath);
    const diagnostics = processDiagnostics(violations);

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
  } catch (err) {
    connection.console.error(`Error validating ${textDocument.uri}: ${err}`);
  }
};

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
