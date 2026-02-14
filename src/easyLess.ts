// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Preprocessor } from './Configuration';
import CompileLessCommand from './CompileLessCommand';

const LESS_EXT = '.less';
const COMPILE_COMMAND = 'easyLess.compile';

let lessDiagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {
  lessDiagnosticCollection = vscode.languages.createDiagnosticCollection();

  await initializeDefaultFolderSettings(context);

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
  const didSaveEvent = vscode.workspace.onDidSaveTextDocument(document => {
    if (document.fileName.endsWith(LESS_EXT)) {
      new CompileLessCommand(document, lessDiagnosticCollection).setPreprocessors(preprocessors).execute();
    }
  });

  // compile less on save when file is clean (clean saves don't trigger onDidSaveTextDocument, so use this as fallback)
  const willSaveEvent = vscode.workspace.onWillSaveTextDocument(e => {
    if (e.document.fileName.endsWith(LESS_EXT) && !e.document.isDirty) {
      new CompileLessCommand(e.document, lessDiagnosticCollection).setPreprocessors(preprocessors).execute();
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
    files.forEach(file => {
      vscode.workspace.openTextDocument(file).then(document => {
        new CompileLessCommand(document, lessDiagnosticCollection).setPreprocessors(preprocessors).execute();
      });
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


async function initializeDefaultFolderSettings(context: vscode.ExtensionContext): Promise<void> {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    return;
  }

  const initializationKey = `easyLess.defaults.initialized:${workspaceFolder.uri.toString()}`;
  if (context.globalState.get<boolean>(initializationKey)) {
    return;
  }

  const lessConfiguration = vscode.workspace.getConfiguration('less', workspaceFolder.uri);
  const compileSettings = lessConfiguration.get<Record<string, unknown>>('compile') || {};

  const hasSourceDir = typeof compileSettings.sourceDir === 'string' && compileSettings.sourceDir.length > 0;
  const hasOutputDir = typeof compileSettings.outputDir === 'string' && compileSettings.outputDir.length > 0;

  if (!hasSourceDir && !hasOutputDir) {
    const defaultCompileSettings = {
      ...compileSettings,
      sourceDir: '${workspaceFolder}/less/',
      outputDir: '${workspaceFolder}/css/',
    };

    await lessConfiguration.update('compile', defaultCompileSettings, vscode.ConfigurationTarget.WorkspaceFolder);
  }

  await context.globalState.update(initializationKey, true);
}

// this method is called when your extension is deactivated
export function deactivate() {
  if (lessDiagnosticCollection) {
    lessDiagnosticCollection.dispose();
  }
}
