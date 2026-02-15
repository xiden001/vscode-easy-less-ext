import fs from 'fs/promises';
import less from 'less';
import * as path from 'path';
import * as vscode from 'vscode';
import * as Configuration from './Configuration';
import { EasyLessOptions } from './Configuration';
import * as FileOptionsParser from './FileOptionsParser';
import { LessDocumentResolverPlugin } from './LessDocumentResolverPlugin';

const DEFAULT_EXT = '.css';

// compile the given less file
export async function compile(
  lessFile: string,
  content: string,
  defaults: Configuration.EasyLessOptions,
  preprocessors: Configuration.Preprocessor[] = [],
): Promise<void> {
  const options: Configuration.EasyLessOptions = FileOptionsParser.parse(content, defaults);
  const lessPath: string = path.dirname(lessFile);

  // Option `main`.
  if (options.main) {
    // When `main` is set: compile the referenced file(s) instead.
    const mainFilePaths: string[] = resolveMainFilePaths(options.main, lessFile, lessFile);
    if (mainFilePaths.length > 0) {
      for (const filePath of mainFilePaths) {
        const mainPath: path.ParsedPath = path.parse(filePath);
        const mainRootFileInfo = Configuration.getRootFileInfo(mainPath);
        const mainDefaults = { ...defaults, rootFileInfo: mainRootFileInfo };
        const mainContent = await fs.readFile(filePath, { encoding: 'utf-8' });
        await compile(filePath, mainContent, mainDefaults);
      }
      return;
    }
  }

  // No output.
  if (options.out === null || options.out === false) {
    return;
  }

  // Option `out`
  const cssFilepath = chooseOutputFilename(options, lessFile, lessPath);
  delete options.out;

  // Option `sourceMap`.
  let sourceMapFile: string | undefined;
  if (options.sourceMap) {
    options.sourceMap = configureSourceMap(options, lessFile, cssFilepath);

    if (!options.sourceMap.sourceMapFileInline) {
      sourceMapFile = `${cssFilepath}.map`;
      options.sourceMap.sourceMapURL = `./${path.parse(sourceMapFile).base}`;
    }
  }

  // Option `autoprefixer`.
  options.plugins = [];
  if (options.autoprefixer) {
    const LessPluginAutoPrefix = require('less-plugin-autoprefix');
    const browsers: string[] = cleanBrowsersList(options.autoprefixer);
    const autoprefixPlugin = new LessPluginAutoPrefix({ browsers });

    options.plugins.push(autoprefixPlugin);
  }

  options.plugins.push(new LessDocumentResolverPlugin());

  if (preprocessors.length > 0) {
    // Clear options.rootFileInfo to ensure that less will not reload the content from the filepath again.
    delete options.rootFileInfo;

    // Used to cache some variables for use by other preprocessors.
    const ctx = new Map<string, any>();
    for await (const p of preprocessors) {
      content = await p(content, ctx);
    }
  }

  // Render to CSS.
  const output = await less.render(content, options);
  await writeFileContents(cssFilepath, output.css);
  if (output.map && sourceMapFile) {
    await writeFileContents(sourceMapFile, output.map);
  }
}

function chooseOutputFilename(options: Configuration.EasyLessOptions, lessFile: string, lessPath: string): string {
  const out: string | boolean | undefined = options.out;
  const extension: string = chooseExtension(options);
  const filenameNoExtension: string = path.parse(lessFile).name;
  const compilationRoot = getCompilationRoot(lessFile);

  let cssRelativeFilename: string;
  if (typeof out === 'string') {
    const interpolatedOut = interpolatePath(out.replace('$1', filenameNoExtension).replace('$2', extension), lessFile);

    cssRelativeFilename = interpolatedOut;

    if (isFolder(cssRelativeFilename)) {
      cssRelativeFilename = `${cssRelativeFilename}${filenameNoExtension}${extension}`;
    } else if (hasNoExtension(cssRelativeFilename)) {
      cssRelativeFilename = `${cssRelativeFilename}${extension}`;
    }
  } else {
    const mappedOutputFile = chooseMappedOutputFilename(options, lessFile, filenameNoExtension, extension);
    if (mappedOutputFile) {
      return assertPathWithinRoot(mappedOutputFile, compilationRoot, 'out');
    }

    cssRelativeFilename = filenameNoExtension + extension;
  }

  const cssFile = path.resolve(lessPath, cssRelativeFilename);
  return assertPathWithinRoot(cssFile, compilationRoot, 'out');
}

function chooseMappedOutputFilename(
  options: Configuration.EasyLessOptions,
  lessFile: string,
  filenameNoExtension: string,
  extension: string,
): string | undefined {
  if (!options.sourceDir || !options.outputDir) {
    return undefined;
  }

  const sourceRoot = resolveConfiguredDirectory(options.sourceDir, lessFile);
  const outputRoot = resolveConfiguredDirectory(options.outputDir, lessFile);
  const relativeFilePath = path.relative(sourceRoot, lessFile);

  if (relativeFilePath.startsWith('..') || path.isAbsolute(relativeFilePath)) {
    return undefined;
  }

  const relativeDir = path.dirname(relativeFilePath);
  const outputDirectory = relativeDir === '.' ? outputRoot : path.join(outputRoot, relativeDir);
  return path.join(outputDirectory, `${filenameNoExtension}${extension}`);
}

function isFolder(filename: string): filename is `${string}/` | `${string}\\` {
  const lastCharacter = filename.slice(-1);
  return lastCharacter === '/' || lastCharacter === '\\';
}

function hasNoExtension(filename: string): boolean {
  return path.extname(filename) === '';
}

function configureSourceMap(options: Configuration.EasyLessOptions, lessFile: string, cssFile: string) {
  const lessPath: string = path.parse(lessFile).dir;
  const cssPath: string = path.parse(cssFile).dir;
  const lessRelativeToCss: string = path.relative(cssPath, lessPath);

  const sourceMapOptions: Less.SourceMapOption = {
    outputSourceFiles: false,
    sourceMapBasepath: lessPath,
    sourceMapFileInline: options.sourceMapFileInline,
    sourceMapRootpath: lessRelativeToCss,
  };

  return sourceMapOptions;
}

function cleanBrowsersList(autoprefixOption: string | string[]): string[] {
  const browsers: string[] = Array.isArray(autoprefixOption) ? autoprefixOption : `${autoprefixOption}`.split(/,|;/);

  return browsers.map(browser => browser.trim());
}

function interpolatePath(interpolatedPath: string, lessFilePath: string): string {
  if (interpolatedPath.includes('${workspaceFolder}')) {
    const lessFileUri = vscode.Uri.file(lessFilePath);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(lessFileUri);
    if (workspaceFolder) {
      interpolatedPath = interpolatedPath.replace(/\$\{workspaceFolder\}/g, workspaceFolder.uri.fsPath);
    }
  }

  if (interpolatedPath.includes('${workspaceRoot}')) {
    const workspaceRoot = getWorkspaceRootForFile(lessFilePath);
    if (workspaceRoot) {
      interpolatedPath = interpolatedPath.replace(/\$\{workspaceRoot\}/g, workspaceRoot);
    }
  }

  return interpolatedPath;
}

function resolveConfiguredDirectory(configuredPath: string, lessFilePath: string): string {
  const interpolatedPath = interpolatePath(configuredPath, lessFilePath);
  if (path.isAbsolute(interpolatedPath)) {
    return interpolatedPath;
  }

  const baseDirectory = getWorkspaceRootForFile(lessFilePath) ?? path.dirname(lessFilePath);
  return path.resolve(baseDirectory, interpolatedPath);
}

function resolveMainFilePaths(this: void, main: string | string[], lessFilePath: string, currentLessFile: string): string[] {
  const lessPath = path.dirname(lessFilePath);
  const compilationRoot = getCompilationRoot(lessFilePath);

  const mainFiles = typeof main === 'string' ? [main] : Array.isArray(main) ? main : [];
  const resolvedMainFilePaths: string[] = mainFiles.map(mainFile => {
    const interpolatedMainFilePath = interpolatePath(mainFile, lessFilePath);
    const resolvedPath = path.resolve(lessPath, interpolatedMainFilePath);
    return assertPathWithinRoot(resolvedPath, compilationRoot, 'main');
  });

  if (resolvedMainFilePaths.indexOf(currentLessFile) >= 0) {
    return [];
  }

  return resolvedMainFilePaths;
}

function getWorkspaceRootForFile(lessFilePath: string): string | undefined {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(lessFilePath));
  if (workspaceFolder) {
    return workspaceFolder.uri.fsPath;
  }

  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function getCompilationRoot(lessFilePath: string): string {
  return getWorkspaceRootForFile(lessFilePath) ?? path.dirname(lessFilePath);
}

function assertPathWithinRoot(targetPath: string, rootPath: string, optionName: 'out' | 'main'): string {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedRoot = path.resolve(rootPath);
  const relativePath = path.relative(resolvedRoot, resolvedTarget);

  if (relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))) {
    return resolvedTarget;
  }

  throw new Error(`Invalid \"${optionName}\" path '${targetPath}' resolves outside the workspace folder.`);
}

// Writes a file's contents to a path and creates directories if they don't exist.
async function writeFileContents(filepath: string, content: any): Promise<void> {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, content.toString());
}

function chooseExtension(options: EasyLessOptions): string {
  if (options?.outExt) {
    if (options.outExt === '') {
      return '';
    }

    return ensureDotPrefixed(options.outExt) || DEFAULT_EXT;
  }

  return DEFAULT_EXT;
}

function ensureDotPrefixed(extension: string): string {
  if (extension.startsWith('.')) {
    return extension;
  }

  return extension ? `.${extension}` : '';
}
