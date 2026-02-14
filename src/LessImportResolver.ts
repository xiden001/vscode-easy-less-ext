import * as path from 'path';

const IMPORT_REGEX = /@import\s*(?:\([^)]*\)\s*)?["']([^"']+)["']/g;

export function importsTargetFile(importerFilePath: string, importerContent: string, targetFilePath: string): boolean {
  const resolvedTarget = normalizePath(targetFilePath);
  const importedPaths = extractImportPaths(importerContent);

  for (const importPath of importedPaths) {
    for (const resolvedImport of resolveImportCandidates(importerFilePath, importPath)) {
      if (normalizePath(resolvedImport) === resolvedTarget) {
        return true;
      }
    }
  }

  return false;
}

function extractImportPaths(content: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const rawPath = match[1]?.trim();
    if (rawPath) {
      results.push(rawPath);
    }
  }

  return results;
}

function resolveImportCandidates(importerFilePath: string, importPath: string): string[] {
  if (isExternalImport(importPath)) {
    return [];
  }

  const importerDir = path.dirname(importerFilePath);
  const absoluteImportPath = path.resolve(importerDir, importPath);
  const extension = path.extname(absoluteImportPath);

  if (extension) {
    return [absoluteImportPath];
  }

  return [
    `${absoluteImportPath}.less`,
    path.join(absoluteImportPath, 'index.less'),
  ];
}

function isExternalImport(importPath: string): boolean {
  return /^(https?:)?\/\//.test(importPath) || importPath.startsWith('data:');
}

function normalizePath(filePath: string): string {
  return path.normalize(filePath).toLowerCase();
}
