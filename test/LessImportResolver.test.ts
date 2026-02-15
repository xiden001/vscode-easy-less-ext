import path from 'path';
import { describe, expect, it } from 'vitest';
import { importsTargetFile } from '../src/LessImportResolver';

describe('importsTargetFile', () => {
  it('matches relative less imports', () => {
    const importer = '/workspace/project/less/main.less';
    const target = '/workspace/project/less/parts/buttons.less';
    const content = '@import "./parts/buttons";';

    expect(importsTargetFile(importer, content, target)).toBe(true);
  });

  it('is stable across repeated invocations with regex global state', () => {
    const importer = '/workspace/project/less/main.less';
    const target = '/workspace/project/less/parts/buttons.less';
    const content = '@import "./parts/buttons";';

    expect(importsTargetFile(importer, content, target)).toBe(true);
    expect(importsTargetFile(importer, content, target)).toBe(true);
  });

  it('respects case-sensitive file systems', () => {
    const importer = '/workspace/project/less/main.less';
    const content = '@import "./parts/Buttons";';
    const expected = process.platform === 'win32' || process.platform === 'darwin';

    expect(importsTargetFile(importer, content, path.resolve('/workspace/project/less/parts/buttons.less'))).toBe(expected);
  });
});
