import { defineParams, useViewTypeTool } from '@aotui/sdk';
import path from 'path';
import type Emittery from 'emittery';
import { fileSystemService } from '../core/file-system-service.js';
import { lspService } from '../core/lsp-service.js';
import { persistenceService } from '../core/persistence-service.js';
import type { AppEvents, EditTool, FileInfo } from '../types.js';

const searchByPatternParams = defineParams({
  pattern: {
    type: 'string',
    required: true,
    desc: 'Glob pattern (e.g., "**/*.ts", "src/**/*.json", "*.test.ts")'
  }
});

const searchByContentParams = defineParams({
  pattern: {
    type: 'string',
    required: true,
    desc: 'Regex pattern to match against file content'
  },
  include: {
    type: 'string',
    required: false,
    desc: 'Optional glob pattern to filter files (e.g., "**/*.ts")'
  }
});

const writeFileParams = defineParams({
  filePath: {
    type: 'string',
    required: true,
    desc: 'Absolute path to the file'
  },
  content: {
    type: 'string',
    required: true,
    desc: 'New file content (replaces entire file)'
  }
});

const editFileParams = defineParams({
  filePath: {
    type: 'string',
    required: true,
    desc: 'Absolute path to the file'
  },
  oldString: {
    type: 'string',
    required: true,
    desc: 'Exact string to replace (whitespace-sensitive)'
  },
  newString: {
    type: 'string',
    required: true,
    desc: 'Replacement string'
  },
  replaceAll: {
    type: 'boolean',
    required: false,
    desc: 'Replace all occurrences? (default: false)'
  }
});

const createFileParams = defineParams({
  filePath: {
    type: 'string',
    required: true,
    desc: 'Path for new file (parent dirs created automatically)'
  },
  content: {
    type: 'string',
    required: true,
    desc: 'Initial file content'
  }
});

const deleteFileParams = defineParams({
  filePath: {
    type: 'string',
    required: true,
    desc: 'Path to file to delete'
  }
});

const renameFileParams = defineParams({
  oldPath: {
    type: 'string',
    required: true,
    desc: 'Current file path'
  },
  newPath: {
    type: 'string',
    required: true,
    desc: 'New file path (can move to different dir)'
  }
});

const batchEditParams = defineParams({
  edits: {
    type: 'array',
    required: true,
    itemType: 'object',
    desc: 'Array of edit tools: [{ filePath, oldString, newString }, ...]'
  }
});

export function RootView({
  workspacePath,
  activeFiles,
  searchResultView,
  onOpenFileDetail,
  onCloseFile,
  onCreateSearchView,
  onCloseSearchView,
  onExpandDirs,
  onCollapseDirs,
  onRefreshWorkspace,
  eventBus
}: {
  workspacePath: string;
  activeFiles: string[];
  searchResultView: { query: string; results: FileInfo[] } | null;
  onOpenFileDetail: (filePath: string) => void;
  onCloseFile: (filePath: string) => void;
  onCreateSearchView: (query: string, results: FileInfo[]) => void;
  onCloseSearchView: () => void;
  onExpandDirs: (dirPaths: string[]) => void;
  onCollapseDirs: (dirPaths: string[]) => void;
  onRefreshWorkspace: () => void;
  eventBus: Emittery<AppEvents>;
}) {
  const availableFileDetailViews = activeFiles
    .map((filePath, index) => `- fd_${index}: ${filePath}`)
    .join('\n');
  const viewIdForFile = (filePath: string) => {
    const index = activeFiles.indexOf(filePath);
    return index >= 0 ? `fd_${index}` : undefined;
  };

  /**
   * File Content View Tools
   */
  const [LSPHoverUI] = useViewTypeTool('FileDetail', 'lsp_hover', {
    description: `Get type information at cursor position.

REQUIRED PARAMETER:
- file_path: Absolute path to the file
AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' },
      line: { type: 'number', required: true, desc: 'Line number (1-based)' },
      character: { type: 'number', required: true, desc: 'Column number (1-based)' }
    })
  }, async (args: { file_path: string; line: number; character: number }) => {
    const { file_path, line, character } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }
    try {
      const result = await lspService.hover(file_path, line, character);
      const viewId = viewIdForFile(file_path);
      const resultCount = result ? 1 : 0;
      await eventBus.emit('lsp_hover_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: result,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_hover',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `Hover written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_hover_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_hover',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPGotoDefinitionUI] = useViewTypeTool('FileDetail', 'lsp_goto_definition', {
    description: `Jump to the definition of a symbol.

REQUIRED PARAMETER:
- file_path: Absolute path to the file
AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' },
      line: { type: 'number', required: true, desc: 'Line number (1-based)' },
      character: { type: 'number', required: true, desc: 'Column number (1-based)' }
    })
  }, async (args: { file_path: string; line: number; character: number }) => {
    const { file_path, line, character } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }

    try {
      const result = await lspService.goToDefinition(file_path, line, character);
      const viewId = viewIdForFile(file_path);
      const resultCount = result.length;
      await eventBus.emit('lsp_definition_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: result,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_goto_definition',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `Definition written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_definition_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_goto_definition',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPFindReferencesUI] = useViewTypeTool('FileDetail', 'lsp_find_references', {
    description: `Find all references to a symbol.

REQUIRED PARAMETER:
- file_path: Absolute path to the file
AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' },
      line: { type: 'number', required: true, desc: 'Line number (1-based)' },
      character: { type: 'number', required: true, desc: 'Column number (1-based)' }
    })
  }, async (args: { file_path: string; line: number; character: number }) => {
    const { file_path, line, character } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }
    try {
      const result = await lspService.findReferences(file_path, line, character);
      const viewId = viewIdForFile(file_path);
      const resultCount = result.length;
      await eventBus.emit('lsp_references_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: result,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_find_references',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `References written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_references_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_find_references',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPGetDiagnosticsUI] = useViewTypeTool('FileDetail', 'lsp_get_diagnostics', {
    description: `Get errors and warnings (diagnostics) for a file.

REQUIRED PARAMETER:
- file_path: Absolute path to the file
AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' }
    })
  }, async (args: { file_path: string }) => {
    const { file_path } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }

    try {
      const diagnostics = await lspService.getDiagnostics(file_path);
      const viewId = viewIdForFile(file_path);
      const resultCount = diagnostics.length;
      await eventBus.emit('lsp_diagnostics_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: diagnostics,
        updatedAt: Date.now(),
        operationName: 'lsp_get_diagnostics',
        resultCount,
        source: 'manual'
      });
      return {
        success: true,
        data: {
          message: `Diagnostics written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_diagnostics_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        operationName: 'lsp_get_diagnostics',
        resultCount: 0,
        source: 'manual'
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPDocumentSymbolUI] = useViewTypeTool('FileDetail', 'lsp_document_symbol', {
    description: `Get document outline (functions, classes, etc.).

REQUIRED PARAMETER:
- file_path: Absolute path to the file

AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' }
    })
  }, async (args: { file_path: string }) => {
    const { file_path } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }

    try {
      const symbols = await lspService.documentSymbol(file_path);
      const viewId = viewIdForFile(file_path);
      const resultCount = symbols.length;
      await eventBus.emit('lsp_document_symbol_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: symbols,
        updatedAt: Date.now(),
        operationName: 'lsp_document_symbol',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `Document Symbols written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_document_symbol_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        operationName: 'lsp_document_symbol',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPIncomingCallsUI] = useViewTypeTool('FileDetail', 'lsp_incoming_calls', {
    description: `Find functions that call this symbol.

REQUIRED PARAMETER:
- file_path: Absolute path to the file

AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' },
      line: { type: 'number', required: true, desc: 'Line number (1-based)' },
      character: { type: 'number', required: true, desc: 'Column number (1-based)' }
    })
  }, async (args: { file_path: string; line: number; character: number }) => {
    const { file_path, line, character } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }

    try {
      const result = await lspService.incomingCalls(file_path, line, character);
      const viewId = viewIdForFile(file_path);
      const resultCount = result.length;
      await eventBus.emit('lsp_incoming_calls_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: result,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_incoming_calls',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `Incoming Calls written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_incoming_calls_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_incoming_calls',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [LSPOutgoingCallsUI] = useViewTypeTool('FileDetail', 'lsp_outgoing_calls', {
    description: `Find functions this symbol calls.

REQUIRED PARAMETER:
- file_path: Absolute path to the file

AVAILABLE VIEWS:
${availableFileDetailViews}`,
    params: defineParams({
      file_path: { type: 'string', required: true, desc: 'Absolute path to the file' },
      line: { type: 'number', required: true, desc: 'Line number (1-based)' },
      character: { type: 'number', required: true, desc: 'Column number (1-based)' }
    })
  }, async (args: { file_path: string; line: number; character: number }) => {
    const { file_path, line, character } = args as any;
    if (!file_path) {
      return {
        success: false,
        error: { code: 'INVALID_FILE_PATH', message: 'File path is required' }
      };
    }

    try {
      const result = await lspService.outgoingCalls(file_path, line, character);
      const viewId = viewIdForFile(file_path);
      const resultCount = result.length;
      await eventBus.emit('lsp_outgoing_calls_result', {
        filePath: file_path,
        viewId,
        status: 'success',
        data: result,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_outgoing_calls',
        resultCount
      });
      return {
        success: true,
        data: {
          message: `Outgoing Calls written to FileDetail View${viewId ? ` (${viewId})` : ''}. Check that View's result panel.`,
          view_id: viewId
        }
      };
    } catch (error) {
      const message = (error as Error).message;
      const viewId = viewIdForFile(file_path);
      await eventBus.emit('lsp_outgoing_calls_result', {
        filePath: file_path,
        viewId,
        status: 'error',
        error: message,
        updatedAt: Date.now(),
        request: { line, character },
        operationName: 'lsp_outgoing_calls',
        resultCount: 0
      });
      return {
        success: false,
        error: { code: 'LSP_ERROR', message }
      };
    }
  }, { enabled: activeFiles.length > 0 });

  const [CloseFileDetailUI] = useViewTypeTool('FileDetail', 'close_file_detail', {
    description: `Close a FileDetail View.

REQUIRED PARAMETER:
- view_id: Target View ID (fd_0, fd_1, ...)`,
    params: defineParams({
      view_id: { type: 'string', required: true, desc: 'Target View ID (fd_0, fd_1, ...)' }
    })
  }, async (args: { view_id: string }) => {
    const { view_id } = args as any;
    if (!view_id || typeof view_id !== 'string') {
      return {
        success: false,
        error: { code: 'INVALID_VIEW_ID', message: 'view_id is required' }
      };
    }

    const index = Number(view_id.replace('fd_', ''));
    if (!Number.isInteger(index) || index < 0 || index >= activeFiles.length) {
      return {
        success: false,
        error: { code: 'INVALID_VIEW_ID', message: `Unknown FileDetail view: ${view_id}` }
      };
    }

    const filePath = activeFiles[index];
    onCloseFile(filePath);
    return {
      success: true,
      data: {
        message: `Closed FileDetail View (${view_id}).`,
        view_id
      }
    };
  }, { enabled: activeFiles.length > 0 });

  /**
   * Search Result View Tools
   */
  const [CloseSearchResultUI] = useViewTypeTool('SearchResult', 'close_search_view', {
    description: `Close the SearchResult View.

REQUIRED: view_id (always "search")`,
    params: defineParams({
      view_id: { type: 'string', required: true, desc: 'Target View ID (always "search")' }
    })
  }, async (args: { view_id: string }) => {
    const { view_id } = args as any;
    if (view_id !== 'search') {
      return {
        success: false,
        error: { code: 'INVALID_VIEW_ID', message: 'SearchResult View ID must be "search"' }
      };
    }

    onCloseSearchView();
    return {
      success: true,
      data: {
        message: 'Closed SearchResult View (search).',
        view_id: 'search'
      }
    };
  }, { enabled: searchResultView !== null });

  /**
   * Workspace Tools
   */
  const [SearchByPatternUI] = useViewTypeTool('Workspace', 'search_files_by_pattern', {
    description: `Search files by glob pattern (name or extension).

WHEN TO USE:
- Find files by name or extension pattern
- Example: "Find all TypeScript test files", "List all JSON configs"

HOW TO USE:
- Provide glob pattern (e.g., "**/*.test.ts", "src/**/*.tsx", "*.json")
- Results saved to searchResults (visible in Snapshot)
- Use file paths from results to call read_file

EXAMPLE:
User: "找到所有测试文件"
You call: search_files_by_pattern({ pattern: "**/*.test.ts" })
Results: ["/project/src/a.test.ts", "/project/src/b.test.ts"]
Then: read_file({ filePath: "/project/src/a.test.ts" })`,
    params: searchByPatternParams
  }, async ({ pattern }: { pattern: string }) => {
    try {
      const results = await fileSystemService.searchByPattern(pattern as string, workspacePath);

      const fileInfos: FileInfo[] = results.map(filePath => ({
        path: filePath,
        lastOpened: Date.now()
      }));
      onCreateSearchView(pattern as string, fileInfos);

      return {
        success: true,
        data: {
          message: `SearchResult View (search) updated with ${results.length} results. Check that View.`,
          view_id: 'search',
          found: results.length
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'SEARCH_ERROR', message: (error as Error).message } };
    }
  });

  const [SearchByContentUI] = useViewTypeTool('Workspace', 'search_files_by_content', {
    description: `Search files by content (grep).

WHEN TO USE:
- Find files containing specific text or code
- Example: "Find files with export class", "Find TODO comments"

HOW TO USE:
- Provide regex pattern
- Use 'include' parameter to filter file types
- Results saved to searchResults

EXAMPLE:
User: "找到所有导出类的文件"
You call: search_files_by_content({ pattern: "export class" })
Or with filter: search_files_by_content({ pattern: "TODO", include: "**/*.ts" })`,
    params: searchByContentParams
  }, async ({ pattern, include }: { pattern: string; include?: string }) => {
    try {
      const results = await fileSystemService.searchByContent(
        pattern as string,
        workspacePath,
        include as string | undefined
      );

      const fileInfos: FileInfo[] = results.map(filePath => ({
        path: filePath,
        lastOpened: Date.now()
      }));
      onCreateSearchView(pattern as string, fileInfos);

      return {
        success: true,
        data: {
          message: `SearchResult View (search) updated with ${results.length} results. Check that View.`,
          view_id: 'search',
          found: results.length
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'SEARCH_ERROR', message: (error as Error).message } };
    }
  });

  const [MultiOpenFileUI] = useViewTypeTool('Workspace', 'multi_open_file', {
    description: `Open multiple files and read their contents.

WHEN TO USE:
- User asks to open/read multiple files
- Want to view several files in Snapshot simultaneously

HOW TO USE:
- Provide array of absolute file paths
- All files added to openedFiles list
- File contents visible in Snapshot

IMPORTANT:
- This tool ONLY reads file contents (adds to openedFiles)
- Does NOT open FileDetailView for LSP analysis

EXAMPLE:
User: "打开 index.ts 和 utils.ts"
You call: multi_open_file({ filePaths: ["/project/src/index.ts", "/project/src/utils.ts"] })
Result: Files appear in openedFiles section of Snapshot

For LSP analysis: multi_open_file + LSP Tools`,
    params: defineParams({
      filePaths: {
        type: 'array',
        itemType: 'string',
        required: true,
        desc: 'Array of absolute file paths'
      },
      offset: {
        type: 'number',
        required: false,
        desc: 'Start line (0-indexed) for large files'
      },
      limit: {
        type: 'number',
        required: false,
        desc: 'Max lines per file (default: 2000)'
      }
    })
  }, async ({ filePaths }: { filePaths: string[] }) => {
    try {
      const paths = filePaths as string[];
      let opened = 0;
      const openedPaths: string[] = [];
      const openErrors: Array<{ path: string; error: string }> = [];

      for (const filePath of paths) {
        try {
          const exists = await fileSystemService.exists(filePath);
          if (!exists) {
            openErrors.push({ path: filePath, error: `File not found: ${filePath}` });
            continue;
          }
          onOpenFileDetail(filePath);
          opened++;
          openedPaths.push(filePath);
        } catch (error) {
          openErrors.push({ path: filePath, error: (error as Error).message });
          continue;
        }

        try {
          await persistenceService.addOpenFile(workspacePath, {
            path: filePath,
            lastOpened: Date.now()
          });
        } catch {
          continue;
        }
      }

      await eventBus.emit('open_files_updated', {});

      if (openErrors.length > 0 && opened === 0) {
        return {
          success: false,
          error: {
            code: 'FILE_NOT_FOUND',
            message: `Failed to open ${openErrors.length} file(s): ${openErrors.map(item => item.path).join(', ')}`,
            context: {
              opened,
              opened_paths: openedPaths,
              failed: openErrors.length,
              failed_paths: openErrors.map(item => item.path)
            }
          }
        };
      }

      return {
        success: true,
        data: {
          message: openErrors.length > 0
            ? `Opened ${opened} file(s). Failed: ${openErrors.length}. Check FileDetail Views and the Workspace opened files list.`
            : `Opened ${opened} file(s). Check FileDetail Views and the Workspace opened files list.`,
          opened,
          opened_paths: openedPaths,
          failed: openErrors.length,
          failed_paths: openErrors.map(item => item.path)
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'MULTI_OPEN_ERROR', message: (error as Error).message } };
    }
  });

  const [MultiCloseFileUI] = useViewTypeTool('Workspace', 'multi_close_file', {
    description: `Close multiple opened files.

WHEN TO USE:
- User wants to close specific files
- Clean up openedFiles list
- Free memory for large files

HOW TO USE:
- Provide array of file paths (must match exactly)
- Files removed from openedFiles
- No error if file not currently opened

EXAMPLE:
User: "关闭 index.ts"
You call: multi_close_file({ filePaths: ["/project/src/index.ts"] })`,
    params: defineParams({
      filePaths: {
        type: 'array',
        itemType: 'string',
        required: true,
        desc: 'Array of file paths to close'
      }
    })
  }, async ({ filePaths }: { filePaths: string[] }) => {
    try {
      const pathsToClose = filePaths as string[];

      for (const filePath of pathsToClose) {
        onCloseFile(filePath);
      }

      return {
        success: true,
        data: {
          message: `Closed ${pathsToClose.length} FileDetail Views. Check the Workspace opened files list.`,
          closed: pathsToClose.length,
          closed_paths: pathsToClose
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'MULTI_CLOSE_ERROR', message: (error as Error).message } };
    }
  });

  const [WriteFileUI] = useViewTypeTool('Workspace', 'write_file', {
    description: `Write file content (replace entire file).

WHEN TO USE:
- User wants to completely replace file content
- Creating a new file with full content
- Rewriting generated files (e.g., config files)

HOW TO USE:
- Provide absolute file path and new content
- ENTIRE file will be replaced
- For partial edits, use edit_file instead

WARNING: This OVERWRITES the entire file!

EXAMPLE:
User: "Create a new config.json"
You call: write_file({ filePath: "/project/config.json", content: "{...}" })`,
    params: writeFileParams
  }, async ({ filePath, content }: { filePath: string; content: string }) => {
    try {
      await fileSystemService.writeFile(filePath as string, content as string);
      await eventBus.emit('file_changed', { filePath: filePath as string });
      const viewId = viewIdForFile(filePath as string);

      return {
        success: true,
        data: {
          message: `File written and view update notified. Check the Workspace View${viewId ? ` and FileDetail View (${viewId})` : ''}.`,
          view_id: viewId
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'WRITE_ERROR', message: (error as Error).message } };
    }
  });

  const [EditFileUI] = useViewTypeTool('Workspace', 'edit_file', {
    description: `Edit file with precise string replacement.

WHEN TO USE:
- Modify specific part of file (not entire file)
- Replace function, variable, or code block
- Make surgical edits

HOW TO USE:
- oldString must match EXACTLY (including whitespace)
- Set replaceAll=true to replace all occurrences
- For complete rewrite, use write_file

IMPORTANT: Whitespace matters! Copy exact string from file content.

EXAMPLE:
User: "Change const x = 1 to const x = 2"
You call: edit_file({ filePath: "/file.ts", oldString: "const x = 1", newString: "const x = 2" })`,
    params: editFileParams
  }, async ({ filePath, oldString, newString, replaceAll }: {
    filePath: string;
    oldString: string;
    newString: string;
    replaceAll?: boolean;
  }) => {
    try {
      await fileSystemService.editFile(
        filePath as string,
        oldString as string,
        newString as string,
        replaceAll as boolean | undefined
      );

      await eventBus.emit('file_changed', { filePath: filePath as string });
      const viewId = viewIdForFile(filePath as string);

      return {
        success: true,
        data: {
          message: `File edited and view update notified. Check the Workspace View${viewId ? ` and FileDetail View (${viewId})` : ''}.`,
          view_id: viewId
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'EDIT_ERROR', message: (error as Error).message } };
    }
  });

  const [CreateFileUI] = useViewTypeTool('Workspace', 'create_file', {
    description: `Create a new file.

WHEN TO USE:
- User asks to create a new file
- Generate new code, config, or documentation
- Add files to project

HOW TO USE:
- Provide absolute file path
- Parent directories created automatically
- Fails if file already exists

EXAMPLE:
User: "Create a new utils.ts file"
You call: create_file({ filePath: "/project/src/utils.ts", content: "export class Utils {...}" })`,
    params: createFileParams
  }, async ({ filePath, content }: { filePath: string; content: string }) => {
    try {
      await fileSystemService.createFile(filePath as string, content as string);

      return {
        success: true,
        data: {
          message: `File created. Check it in the Workspace View: ${filePath}`
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'CREATE_ERROR', message: (error as Error).message } };
    }
  });

  const [DeleteFileUI] = useViewTypeTool('Workspace', 'delete_file', {
    description: `Delete a file.

WHEN TO USE:
- User asks to remove/delete a file
- Clean up temporary or obsolete files

WARNING: Deletion is permanent and cannot be undone!

HOW TO USE:
- Provide absolute file path
- File removed from openedFiles if currently open

EXAMPLE:
User: "Delete old-config.json"
You call: delete_file({ filePath: "/project/old-config.json" })`,
    params: deleteFileParams
  }, async ({ filePath }: { filePath: string }) => {
    try {
      await fileSystemService.deleteFile(filePath as string);
      onCloseFile(filePath as string);

      return {
        success: true,
        data: {
          message: `File deleted and related views closed. Check the Workspace View: ${filePath}`
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'DELETE_ERROR', message: (error as Error).message } };
    }
  });

  const [RenameFileUI] = useViewTypeTool('Workspace', 'rename_file', {
    description: `Rename or move a file.

WHEN TO USE:
- User asks to rename a file
- Move file to different directory
- Reorganize project structure

HOW TO USE:
- Provide old and new absolute paths
- Can change directory (move file)
- Updates openedFiles if file is open

EXAMPLE:
User: "Rename config.ts to settings.ts"
You call: rename_file({ oldPath: "/project/config.ts", newPath: "/project/settings.ts" })`,
    params: renameFileParams
  }, async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
    try {
      await fileSystemService.renameFile(oldPath as string, newPath as string);
      await eventBus.emit('file_renamed', {
        oldPath: oldPath as string,
        newPath: newPath as string
      });

      return {
        success: true,
        data: {
          message: `File renamed. Check the Workspace View: ${oldPath} -> ${newPath}`
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'RENAME_ERROR', message: (error as Error).message } };
    }
  });

  const [BatchEditUI] = useViewTypeTool('Workspace', 'batch_edit', {
    description: `Edit multiple files at once.

WHEN TO USE:
- Make same change across multiple files
- Example: "Replace all console.log with logger.info"
- Batch refactoring

HOW TO USE:
- Provide array of edit tools
- Each tool: { filePath, oldString, newString }
- All edits executed sequentially

EXAMPLE:
User: "Replace 'old API' with 'new API' in all files"
You call: batch_edit({  
  edits: [
    { filePath: "/project/a.ts", oldString: "old API", newString: "new API" },
    { filePath: "/project/b.ts", oldString: "old API", newString: "new API" }
  ]
})`,
    params: batchEditParams
  }, async ({ edits }: { edits: Array<Record<string, unknown>> }) => {
    try {
      const editsList = edits as unknown as EditTool[];
      let succeeded = 0;
      const succeededPaths: string[] = [];
      const errors: Array<{ filePath: string; error: string }> = [];

      for (const edit of editsList) {
        try {
          await fileSystemService.editFile(edit.filePath, edit.oldString, edit.newString);
          await eventBus.emit('file_changed', { filePath: edit.filePath });
          succeeded++;
          succeededPaths.push(edit.filePath);
        } catch (error) {
          errors.push({ filePath: edit.filePath, error: (error as Error).message });
        }
      }

      return {
        success: succeeded > 0,
        data: {
          message: `Batch edit completed. Succeeded: ${succeeded}, failed: ${errors.length}. Check the Workspace View and related FileDetail Views.`,
          edited: succeeded,
          edited_paths: succeededPaths,
          failed: editsList.length - succeeded,
          failed_paths: errors.map(item => item.filePath)
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'BATCH_EDIT_ERROR', message: (error as Error).message } };
    }
  });

  const [MultiOpenDirsUI] = useViewTypeTool('Workspace', 'multi_open_dirs', {
    description: `Expand multiple directories at once.

WHEN TO USE:
- User asks to open/expand multiple directories
- View contents of several folders
- Navigate project structure

HOW TO USE:
- Provide array of directory paths (relative or absolute)
- Each directory expanded independently
- Errors for individual directories don't stop others
- Directory tree updated in Snapshot

EXAMPLE:
User: "打开 system-todo/ 和 system-chat/src/ 目录"
You call: multi_open_dirs({ dirPaths: ["system-todo/", "system-chat/src/"] })`,
    params: defineParams({
      dirPaths: {
        type: 'array',
        itemType: 'string',
        required: true,
        desc: 'Array of directory paths to expand'
      }
    })
  }, async ({ dirPaths }: { dirPaths: string[] }) => {
    try {
      const paths = dirPaths as string[];
      let expanded = 0;
      let failed = 0;
      const validPaths: string[] = [];

      for (const dirPath of paths) {
        try {
          const absPath = path.isAbsolute(dirPath)
            ? dirPath
            : path.join(workspacePath, dirPath);

          // 使用 fileSystemService 检查是否为目录
          const content = await fileSystemService.listDirectory(absPath, {
            ignore: [],
            expandedDirs: new Set(),
            showExpandedMark: false
          });
          // 如果能成功列出目录,说明是有效目录
          validPaths.push(absPath);
          expanded++;
        } catch {
          failed++;
        }
      }

      if (validPaths.length > 0) {
        onExpandDirs(validPaths);
      }

      return {
        success: expanded > 0,
        data: {
          message: `Expanded ${expanded} directories, failed ${failed}. Check the Workspace directory tree.`,
          expanded,
          failed,
          expanded_paths: validPaths
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'MULTI_OPEN_ERROR', message: (error as Error).message } };
    }
  });

  const [MultiCloseDirsUI] = useViewTypeTool('Workspace', 'multi_close_dirs', {
    description: `Collapse multiple directories at once.

WHEN TO USE:
- User asks to close/collapse multiple directories
- Hide folder contents
- Clean up directory tree view

HOW TO USE:
- Provide array of directory paths
- Directories collapsed in tree view
- No error if directory not currently expanded

EXAMPLE:
User: "关闭所有展开的目录"
You call: multi_close_dirs({ dirPaths: ["system-todo", "system-chat"] })`,
    params: defineParams({
      dirPaths: {
        type: 'array',
        itemType: 'string',
        required: true,
        desc: 'Array of directory paths to collapse'
      }
    })
  }, async ({ dirPaths }: { dirPaths: string[] }) => {
    try {
      const paths = dirPaths as string[];
      const absPaths = paths.map(dirPath => (
        path.isAbsolute(dirPath)
          ? dirPath
          : path.join(workspacePath, dirPath)
      ));

      onCollapseDirs(absPaths);

      return {
        success: true,
        data: {
          message: `Collapsed ${paths.length} directories. Check the Workspace directory tree.`,
          collapsed: paths.length,
          collapsed_paths: absPaths
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'MULTI_CLOSE_ERROR', message: (error as Error).message } };
    }
  });

  const [RefreshWorkspaceUI] = useViewTypeTool('Workspace', 'refresh_workspace', {
    description: `Reload directory tree and clear cache.

WHEN TO USE:
- Files were added/deleted outside IDE
- Directory tree looks stale
- User asks to refresh/reload workspace

HOW TO USE:
- No parameters needed
- Resets expanded directories to root only
- Clears openedFiles and searchResults

EFFECT: Clean slate - all state reset to initial

EXAMPLE:
User: "刷新工作区"
You call: refresh_workspace({})`,
    params: {} as any
  }, async () => {
    try {
      onRefreshWorkspace();
      return {
        success: true,
        data: {
          message: 'Workspace directory tree refreshed (collapsed to root). Check the Workspace View.'
        }
      };
    } catch (error) {
      return { success: false, error: { code: 'REFRESH_ERROR', message: (error as Error).message } };
    }
  });

  return (
    <>
      <div data-role="application-instruction">
        <section>
          <h1>AOTUI IDE - Application Instruction</h1>
          
          <h2>What it is</h2>
          <p>AOTUI IDE is a text-based Integrated Development Environment designed specifically for LLM Agents. It provides semantic views and tools to explore codebases, search files, edit code with precision, and analyze code structure using Language Server Protocol (LSP).</p>
          
          <h2>When to use</h2>
          <ul>
            <li><strong>Exploring Repository Structure:</strong> Browse directory trees, view file lists, and understand project organization</li>
            <li><strong>Searching Files:</strong> Find files by glob pattern (e.g., "**/*.ts") or search content using regex patterns</li>
            <li><strong>File Operations:</strong> Read, write, edit (string replacement), create, delete, or rename files</li>
            <li><strong>Code Analysis:</strong> Use LSP to inspect types, find definitions, trace references, view diagnostics, and analyze call hierarchies</li>
            <li><strong>Batch Editing:</strong> Apply multiple edits across different files in a single operation</li>
          </ul>
          
          <h2>How to use</h2>
          <ol>
            <li><strong>Start with Workspace View:</strong> Browse the directory tree and use search tools to locate files</li>
            <li><strong>Open FileDetail Views:</strong> Use multi_open_file tool to open specific files for detailed LSP analysis</li>
            <li><strong>Perform File Operations:</strong> Use write_file, edit_file, or batch_edit tools from Workspace View</li>
            <li><strong>Analyze Code:</strong> In FileDetail views, use LSP tools (hover, goto_definition, find_references, etc.)</li>
            <li><strong>Navigate Search Results:</strong> When search creates a SearchResult view, review matches and open relevant files</li>
          </ol>
          
          <h2>What happened (Current State)</h2>
          <ul>
            <li><strong>Workspace Path:</strong> {workspacePath}</li>
            <li><strong>Open Files:</strong> {activeFiles.length > 0 ? activeFiles.length : 'None'}</li>
            {activeFiles.length > 0 && (
              <li><strong>Active FileDetail Views:</strong>
                <ul>
                  {activeFiles.map((filePath, index) => (
                    <li key={filePath}>fd_{index}: {filePath}</li>
                  ))}
                </ul>
              </li>
            )}
            <li><strong>Search Results:</strong> {searchResultView ? `Active (${searchResultView.results.length} results for "${searchResultView.query}")` : 'None'}</li>
          </ul>
          <h2>AOTUI IDE Application Views</h2>
          <h3>1. WorkSpace View Instruction</h3>
          <h4>What is WorkSpace</h4>
          <p>Workspace shows directory tree and recently opened files.</p>
          <h4>How to use</h4>
          <p>Use workspace tools to search, read, edit, and manage files and directories.</p>
        </section>
      </div>

      <div data-role="view-content">
        <section data-entity="available-tools">
          <h2>Workspace View Tools</h2>
          <section data-category="search">
            <h3>Search Tools</h3>
            <ul>
              <li><SearchByPatternUI>Search Files by Pattern (glob)</SearchByPatternUI></li>
              <li><SearchByContentUI>Search Files by Content (grep)</SearchByContentUI></li>
            </ul>
          </section>
          <section data-category="file-tools">
            <h3>File Tools</h3>
            <ul>
              <li><MultiOpenFileUI>Open Multiple Files</MultiOpenFileUI></li>
              <li><MultiCloseFileUI>Close Multiple Files</MultiCloseFileUI></li>
              <li><WriteFileUI>Write File Content</WriteFileUI></li>
              <li><EditFileUI>Edit File (String Replacement)</EditFileUI></li>
              <li><CreateFileUI>Create New File</CreateFileUI></li>
              <li><DeleteFileUI>Delete File</DeleteFileUI></li>
              <li><RenameFileUI>Rename/Move File</RenameFileUI></li>
              <li><BatchEditUI>Batch Edit Multiple Files</BatchEditUI></li>
            </ul>
          </section>
          <section data-category="directory-tools">
            <h3>Directory Tools</h3>
            <ul>
              <li><MultiOpenDirsUI>Expand Multiple Directories</MultiOpenDirsUI></li>
              <li><MultiCloseDirsUI>Collapse Multiple Directories</MultiCloseDirsUI></li>
            </ul>
          </section>
          <section data-category="workspace">
            <h3>Workspace Management</h3>
            <ul>
              <li><RefreshWorkspaceUI>Refresh Workspace</RefreshWorkspaceUI></li>
            </ul>
          </section>
          {activeFiles.length > 0 && (
            <section data-category="lsp-tools">
              <h2>FileDetail View Tools</h2>
              <ul>
                <li><LSPHoverUI>LSP Hover</LSPHoverUI></li>
                <li><LSPGotoDefinitionUI>LSP Goto Definition</LSPGotoDefinitionUI></li>
                <li><LSPFindReferencesUI>LSP Find References</LSPFindReferencesUI></li>
                <li><LSPGetDiagnosticsUI>LSP Get Diagnostics</LSPGetDiagnosticsUI></li>
                <li><LSPDocumentSymbolUI>LSP Document Symbol</LSPDocumentSymbolUI></li>
                <li><LSPIncomingCallsUI>LSP Incoming Calls</LSPIncomingCallsUI></li>
                <li><LSPOutgoingCallsUI>LSP Outgoing Calls</LSPOutgoingCallsUI></li>
                <li><CloseFileDetailUI>Close File Detail</CloseFileDetailUI></li>
              </ul>
            </section>
          )}
          {searchResultView && (
            <section data-category="search-result-tools">
              <h2>SearchResult View Tools</h2>
              <ul>
                <li><CloseSearchResultUI>Close Search Result View</CloseSearchResultUI></li>
              </ul>
            </section>
          )}
        </section>
      </div>
    </>
  );
}
