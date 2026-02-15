// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Preprocessor } from './Configuration';
import CompileLessCommand from './CompileLessCommand';
import { importsTargetFile } from './LessImportResolver';

const LESS_EXT = '.less';
const COMPILE_COMMAND = 'easyLess.compile';
const COMPILE_ALL_CONCURRENCY = 8;

let lessDiagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
  lessDiagnosticCollection = vscode.languages.createDiagnosticCollection();

  const preprocessors: Preprocessor[] = [];

  // compile less command
  const compileLessSub = vscode.commands.registerCommand(COMPILE_COMMAND, () => {
    const activeEditor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
    if (activeEditor) {
      const document = activeEditor.document;

      if (document.fileName.endsWith(LESS_EXT)) {
        document.save();
        new CompileLessCommand(document, lessDiagnosticCollection).setPreprocessors(preprocessors).execute();
      } else {
        vscode.window.showWarningMessage('This command only works for .less files.');
      }
    } else {
      vscode.window.showInformationMessage('This command is only available when a .less editor is open.');
    }
  });

  // compile less on save when file is dirty
  const didSaveEvent = vscode.workspace.onDidSaveTextDocument(async document => {
    if (document.fileName.endsWith(LESS_EXT)) {
      await compileDocumentAndImporters(document, preprocessors);
    }
  });

  // compile less on save when file is clean (clean saves don't trigger onDidSaveTextDocument, so use this as fallback)
  const willSaveEvent = vscode.workspace.onWillSaveTextDocument(async e => {
    if (e.document.fileName.endsWith(LESS_EXT) && !e.document.isDirty) {
      await compileDocumentAndImporters(e.document, preprocessors);
    }
  });

  // dismiss less errors on file close
  const didCloseEvent = vscode.workspace.onDidCloseTextDocument((doc: vscode.TextDocument) => {
    if (doc.fileName.endsWith(LESS_EXT)) {
      lessDiagnosticCollection.delete(doc.uri);
    }
  });

  // compile all less files in workspace
  const compileAllLessCommand = vscode.commands.registerCommand('extension.compileAllLess', async () => {
    const files = await vscode.workspace.findFiles('**/*.less', '**/node_modules/**');
    if (files.length === 0) {
      vscode.window.showInformationMessage('No .less files found in workspace.');
      return;
    }

    await runWithConcurrencyLimit(files, COMPILE_ALL_CONCURRENCY, async file => {
      const document = await vscode.workspace.openTextDocument(file);
      await compileDocument(document, preprocessors);
    });
  });

  context.subscriptions.push(compileLessSub);
  context.subscriptions.push(willSaveEvent);
  context.subscriptions.push(didSaveEvent);
  context.subscriptions.push(didCloseEvent);
  context.subscriptions.push(compileAllLessCommand);

  // Return an API for other extensions to build upon EasyLESS.
  return {
    registerPreprocessor: (processor: Preprocessor): void => void preprocessors.push(processor),
  };
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (lessDiagnosticCollection) {
    lessDiagnosticCollection.dispose();
  }
}

async function compileDocumentAndImporters(
  document: vscode.TextDocument,
  preprocessors: Preprocessor[],
): Promise<void> {
  await compileDocument(document, preprocessors);
  await compileImporterFiles(document, preprocessors);
}

async function compileDocument(document: vscode.TextDocument, preprocessors: Preprocessor[]): Promise<void> {
  await new CompileLessCommand(document, lessDiagnosticCollection).setPreprocessors(preprocessors).execute();
}

async function compileImporterFiles(
  importedDocument: vscode.TextDocument,
  preprocessors: Preprocessor[],
): Promise<void> {
  const lessFiles = await vscode.workspace.findFiles('**/*.less', '**/node_modules/**');
  const importedFilePath = importedDocument.uri.fsPath;

  for (const lessFile of lessFiles) {
    if (lessFile.fsPath === importedFilePath) {
      continue;
    }

    const importerDocument = await vscode.workspace.openTextDocument(lessFile);
    if (importsTargetFile(importerDocument.fileName, importerDocument.getText(), importedFilePath)) {
      await compileDocument(importerDocument, preprocessors);
    }
  }
}

async function runWithConcurrencyLimit<T>(
  items: T[],
  concurrencyLimit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const limit = Math.max(1, concurrencyLimit);
  const queue = [...items];

  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item !== undefined) {
        await task(item);
      }
    }
  });

  await Promise.all(workers);
}
