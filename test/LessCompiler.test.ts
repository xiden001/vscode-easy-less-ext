import fs from 'fs/promises';
import less, { render } from 'less';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceFolder } from 'vscode';
import { Uri, workspace } from 'vscode';
import { compile } from '../src/LessCompiler';
import { LessDocumentResolverPlugin } from '../src/LessDocumentResolverPlugin';

vi.mock('fs/promises');
vi.mock('less');
vi.mock('vscode', () => {
  return {
    Uri: { file: vi.fn() },
    workspace: { getWorkspaceFolder: vi.fn(), workspaceFolders: [] },
  };
});

const CSS_CONTENTS = '.thing.sub { background-color: hotpink }';
const LESS_CONTENTS = `{ .thing { &.sub { background-color: hotpink; } } }`;
const MAP_CONTENTS = 'GACxB,IAAMC,GAAUD,EAAGE,SAInB';
const RENDER_RESULT = { css: CSS_CONTENTS } as Less.RenderOutput;
const RENDER_RESULT_WITH_MAP = { css: CSS_CONTENTS, map: MAP_CONTENTS } as Less.RenderOutput;
describe('compile: characterise existing behaviour', () => {
  const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
  const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);

  afterEach(() => {
    vi.resetAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('writes css file - default options', async () => {
    const renderSpy = vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT);

    const options = {};
    await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

    const plugins = renderSpy.mock.lastCall?.[1]?.plugins;
    expect(hasPlugin(plugins, LessDocumentResolverPlugin)).toBe(true);
    expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl', { recursive: true }]]);
    expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/styles.css', CSS_CONTENTS]]);
  });

  describe('out', () => {
    beforeEach(() => {
      vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT);
    });

    it('no compile for out: false', async () => {
      const options = { out: false };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy).not.toHaveBeenCalledOnce();
      expect(writeFileSpy).not.toHaveBeenCalledOnce();
    });

    it('should output to a specific filename (no extension)', async () => {
      const options = { out: '/home/mrcrowl/dist/styles' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl/dist', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/dist/styles.css', CSS_CONTENTS]]);
    });

    it('should output to a specific filename (with extension)', async () => {
      const options = { out: '/home/mrcrowl/dist/styles.css' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl/dist', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/dist/styles.css', CSS_CONTENTS]]);
    });

    it('should output to a specific folder (macOS/linux)', async () => {
      const options = { out: '/home/mrcrowl/dist/' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl/dist', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/dist/styles.css', CSS_CONTENTS]]);
    });

    it('should output with a specific extension (dot prefixed)', async () => {
      const options = { out: '/home/mrcrowl/dist/', outExt: '.wxss' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl/dist', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/dist/styles.wxss', CSS_CONTENTS]]);
    });

    it('should output with a specific extension (no dot)', async () => {
      const options = { out: '/home/mrcrowl/dist/', outExt: 'wxss' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl/dist', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/dist/styles.wxss', CSS_CONTENTS]]);
    });

    it('should resolve relative paths within workspace', async () => {
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
      const workspaceFolder = { uri: { fsPath: '/var' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      const options = { out: '../out/' };
      await compile(`/var/dev/test.less`, LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([[`/var/out`, { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([[`/var/out/test.css`, CSS_CONTENTS]]);
    });

    it("should replace $1 with the file's extensionless name", async () => {
      // Extra setup for workspace folder path interpolation.
      const options = { out: '$1' };
      await compile(`/var/dev/test.less`, LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([[`/var/dev`, { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([[`/var/dev/test.css`, CSS_CONTENTS]]);
    });

    it("should replace $2 with the file's extension", async () => {
      // Extra setup for workspace folder path interpolation.
      const options = { out: '$1$2' };
      await compile(`/var/dev/test.less`, LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([[`/var/dev`, { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([[`/var/dev/test.css`, CSS_CONTENTS]]);
    });

    it('should interpolate the workspace workspaceFolder', async () => {
      // Extra setup for workspace folder path interpolation.
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
      const workspaceFolder = { uri: { fsPath: '/home/abc/dev/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      const options = { out: '${workspaceFolder}/test.css' }; // Intentionally NOT a template string here.
      const WORKSPACE_FOLDER = '/home/abc/dev/project';
      await compile(`${WORKSPACE_FOLDER}/css/test.less`, LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([[`${WORKSPACE_FOLDER}`, { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([[`${WORKSPACE_FOLDER}/test.css`, CSS_CONTENTS]]);
    });

    it('should preserve relative folders when sourceDir and outputDir are configured', async () => {
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
      const workspaceFolder = { uri: { fsPath: '/home/abc/dev/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      const options = {
        sourceDir: '${workspaceFolder}/less',
        outputDir: '${workspaceFolder}/css',
      };

      await compile('/home/abc/dev/project/less/style/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/abc/dev/project/css/style', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/abc/dev/project/css/style/styles.css', CSS_CONTENTS]]);
    });

    it('should preserve deeper nested folders when sourceDir and outputDir are configured', async () => {
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
      const workspaceFolder = { uri: { fsPath: '/home/abc/dev/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      const options = {
        sourceDir: '${workspaceFolder}/less',
        outputDir: '${workspaceFolder}/css',
      };

      await compile('/home/abc/dev/project/less/views/calls/view.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/abc/dev/project/css/views/calls', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/abc/dev/project/css/views/calls/view.css', CSS_CONTENTS]]);
    });

    it('should fall back to the original output location when file is outside sourceDir', async () => {
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
      const workspaceFolder = { uri: { fsPath: '/home/abc/dev/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      const options = {
        sourceDir: '${workspaceFolder}/less',
        outputDir: '${workspaceFolder}/css',
      };

      await compile('/home/abc/dev/project/shared/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/abc/dev/project/shared', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/abc/dev/project/shared/styles.css', CSS_CONTENTS]]);
    });
  });


  describe('path safety', () => {
    beforeEach(() => {
      vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT);
      vi.spyOn(Uri, 'file').mockReturnValue({} as Uri);
    });

    it('throws if out escapes workspace root', async () => {
      const workspaceFolder = { uri: { fsPath: '/workspace/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      await expect(compile('/workspace/project/styles/app.less', LESS_CONTENTS, { out: '../../../tmp/evil.css' })).rejects.toThrow(
        'Invalid \"out\" path',
      );
      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('throws if main escapes workspace root', async () => {
      const workspaceFolder = { uri: { fsPath: '/workspace/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      await expect(compile('/workspace/project/styles/app.less', '// main: ../../../etc/passwd', {})).rejects.toThrow(
        'Invalid \"main\" path',
      );
    });


    it('throws if main references a non-less file', async () => {
      const workspaceFolder = { uri: { fsPath: '/workspace/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);

      await expect(compile('/workspace/project/styles/app.less', '// main: ../templates/base.css', {})).rejects.toThrow(
        'must reference a .less file',
      );
    });

    it('throws for circular main references', async () => {
      const workspaceFolder = { uri: { fsPath: '/workspace/project' } } as WorkspaceFolder;
      vi.spyOn(workspace, 'getWorkspaceFolder').mockReturnValue(workspaceFolder);
      vi.spyOn(fs, 'readFile').mockImplementation(async filePath => {
        const normalizedPath = filePath.toString().replace(/\\/g, '/');
        if (normalizedPath.endsWith('/styles/b.less')) {
          return '// main: a.less';
        }

        return '// main: b.less';
      });

      await expect(compile('/workspace/project/styles/a.less', '// main: b.less', {})).rejects.toThrow(
        'Circular "main" reference detected',
      );
      expect(writeFileSpy).not.toHaveBeenCalled();
    });
  });

  describe('sourceMap', () => {
    it('should output a sourceMap', async () => {
      vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT_WITH_MAP);

      const options = { sourceMap: true };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([
        ['/home/mrcrowl', { recursive: true }],
        ['/home/mrcrowl', { recursive: true }],
      ]);
      expect(writeFileSpy.mock.calls).toEqual([
        ['/home/mrcrowl/styles.css', CSS_CONTENTS],
        ['/home/mrcrowl/styles.css.map', MAP_CONTENTS],
      ]);
    });

    it('should output the sourceMap inline', async () => {
      vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT);

      const options = { sourceMap: true, sourceMapFileInline: true };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/styles.css', CSS_CONTENTS]]);
    });
  });

  describe('autoprefixer', () => {
    it('should enable the autoprefixer plugin', async () => {
      const renderSpy = vi.spyOn(less, 'render').mockResolvedValue(RENDER_RESULT);
      const options = { autoprefixer: '> 5%, last 2 Chrome versions, not ie 6-9' };
      await compile('/home/mrcrowl/styles.less', LESS_CONTENTS, options);

      const plugins = renderSpy.mock.lastCall?.[1]?.plugins;
      const autoprefixPluginConstructor = (await import('less-plugin-autoprefix')).default;
      expect(hasPlugin(plugins, autoprefixPluginConstructor)).toBe(true);
      expect(hasPlugin(plugins, LessDocumentResolverPlugin)).toBe(true);
      expect(mkdirSpy.mock.calls).toEqual([['/home/mrcrowl', { recursive: true }]]);
      expect(writeFileSpy.mock.calls).toEqual([['/home/mrcrowl/styles.css', CSS_CONTENTS]]);
    });
  });
});

function hasPlugin(plugins: undefined | unknown[], constructor: Function) {
  return plugins?.some(p => p instanceof constructor);
}
