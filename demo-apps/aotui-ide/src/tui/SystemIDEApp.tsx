/**
 * System IDE Application
 * 
 * [View Type Mechanism] 使用新的View API：
 * - id prop必填，手动指定
 * - type prop用于同类View聚合
 * - Workspace: id="workspace", type="Workspace"
 * - FileDetail: id="fd_0", "fd_1"..., type="FileDetail"
 * - SearchResult: id="search", type="SearchResult"
 */
import { createTUIApp, View, useState, useMemo, useAppEnv, useEffect, useCallback, usePersistentState } from '@aotui/sdk';
import Emittery from 'emittery';
import { WorkspaceContent } from './WorkspaceContent.js';
import { FileDetailView } from './FileDetailContent.js';
import { SearchResultView } from './SearchResultView.js';
import { RootView } from './RootView.js';
import { mergeWorkspaceFolders } from './workspace-folders.js';
import { lspService } from '../core/index.js';
import { persistenceService } from '../core/persistence-service.js';
import type { FileInfo, AppEvents } from '../types.js';

// ═══════════════════════════════════════════════════════════════
//  SystemIDEApp 根组件
// ═══════════════════════════════════════════════════════════════

/**
 * SystemIDEApp 根组件
 * 
 * View 结构编排：
 * - 1个固定的 Workspace View（id="workspace"）
 * - N个动态的 FileDetail Views（id="fd_0", "fd_1"...）
 * - 0或1个 SearchResult View（id="search"）
 */
function SystemIDEApp() {
  // ─────────────────────────────────────────────────────────────
  //  EventBus for View Communication
  // ─────────────────────────────────────────────────────────────
  const eventBus = useMemo(() => new Emittery<AppEvents>(), []);

  // ─────────────────────────────────────────────────────────────
  //  State Management
  // ─────────────────────────────────────────────────────────────

  // FileDetailView 管理（使用数组而非Set，保持插入顺序）
  const [activeFiles, setActiveFiles] = usePersistentState<string[]>('activeFiles', [], {
    deserialize: (value) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [],
    serialize: (value) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [],
  });

  // SearchResultView 管理
  const [searchResultView, setSearchResultView] = useState<{
    query: string;
    results: FileInfo[];
  } | null>(null);

  // ─── Multi-Folder Workspace ────────────────────────────────
  const envProjectPath = useAppEnv<string>('projectPath');

  // workspaceFolders: 统一使用 multi-folder 模式
  // 若 projectPath 存在则作为初始 folder，否则空数组
  const [workspaceFolders, setWorkspaceFolders] = useState<string[]>(envProjectPath ? [envProjectPath] : []);
  const [workspaceFoldersReady, setWorkspaceFoldersReady] = useState(false);

  // 目录树展开状态管理 (State Lifting)
  const [expandedDirList, setExpandedDirList] = usePersistentState<string[]>('expandedDirs', [...workspaceFolders], {
    deserialize: (value) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [...workspaceFolders],
    serialize: (value) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [...workspaceFolders],
  });
  const expandedDirs = useMemo(() => new Set(expandedDirList), [expandedDirList]);

  // ─────────────────────────────────────────────────────────────
  //  Workspace Folder Management
  // ─────────────────────────────────────────────────────────────

  const handleAddFolder = useCallback((folderPath: string) => {
    setWorkspaceFolders(prev => {
      if (prev.includes(folderPath)) return prev;
      const next = [...prev, folderPath];
      // 自动展开新添加的 folder
      setExpandedDirList(dirs => {
        const s = new Set(dirs);
        s.add(folderPath);
        return Array.from(s);
      });
      return next;
    });
  }, []);

  const handleRemoveFolder = useCallback((folderPath: string) => {
    setWorkspaceFolders(prev => prev.filter(f => f !== folderPath));
    // 同时清理该 folder 下的 expandedDirs
    setExpandedDirList(prev => prev.filter(d => !d.startsWith(folderPath)));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initPersistence = async () => {
      await persistenceService.initDatabase();
      const persistedFolders = await persistenceService.getWorkspaceFolders();
      if (cancelled) {
        return;
      }
      setWorkspaceFolders(mergeWorkspaceFolders(persistedFolders, envProjectPath));
      setWorkspaceFoldersReady(true);
    };

    initPersistence().catch((error: Error) => {
      if (!cancelled) {
        console.error('[SystemIDEApp] Persistence init failed:', error);
        setWorkspaceFoldersReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [envProjectPath]);

  useEffect(() => {
    if (!workspaceFoldersReady) {
      return;
    }
    persistenceService.setWorkspaceFolders(workspaceFolders).catch((error: Error) => {
      console.error('[SystemIDEApp] Workspace folder persistence failed:', error);
    });
  }, [workspaceFolders, workspaceFoldersReady]);

  // ─────────────────────────────────────────────────────────────
  //  Lifecycle Callbacks
  // ─────────────────────────────────────────────────────────────

  /**
   * 打开文件详细视图（支持重复检测）
   */
  const handleOpenFile = (filePath: string) => {
    // 检查是否已经打开
    if (activeFiles.includes(filePath)) {
      console.log(`[SystemIDEApp] File ${filePath} already open, skipping...`);
      return;
    }

    // 添加到activeFiles
    setActiveFiles(prev => [...prev, filePath]);
    console.log(`[SystemIDEApp] Opened FileDetailView for: ${filePath}`);
  };

  /**
   * 关闭文件详细视图
   */
  const handleCloseFile = (filePath: string) => {
    setActiveFiles(prev => prev.filter(f => f !== filePath));
    console.log(`[SystemIDEApp] Closed FileDetailView for: ${filePath}`);
  };

  /**
   * 创建搜索结果视图
   */
  const handleCreateSearchView = (query: string, results: FileInfo[]) => {
    setSearchResultView({ query, results });
    console.log(`[SystemIDEApp] Created SearchResultView for query: "${query}" (${results.length} results)`);
  };

  /**
   * 关闭搜索结果视图
   */
  const handleCloseSearchView = () => {
    setSearchResultView(null);
    console.log(`[SystemIDEApp] Closed SearchResultView`);
  };

  /**
   * 展开目录
   */
  const handleExpandDirs = useCallback((dirPaths: string[]) => {
    setExpandedDirList(prev => {
      const next = new Set(prev);
      dirPaths.forEach(p => next.add(p));
      return Array.from(next);
    });
  }, []);

  /**
   * 折叠目录
   */
  const handleCollapseDirs = useCallback((dirPaths: string[]) => {
    setExpandedDirList(prev => {
      const next = new Set(prev);
      dirPaths.forEach(p => next.delete(p));
      return Array.from(next);
    });
  }, []);

  /**
   * 刷新工作区目录树
   */
  const handleRefreshWorkspace = useCallback(() => {
    setExpandedDirList([...workspaceFolders]);
  }, [workspaceFolders]);

  // ─────────────────────────────────────────────────────────────
  //  LSP Manager Initialization
  // ─────────────────────────────────────────────────────────────

  // LSP 使用第一个 folder 作为 workspace root
  const lspRoot = workspaceFolders[0] ?? '';

  useEffect(() => {
    if (!lspRoot) return;

    let isMounted = true;

    // 初始化 LSP Service
    lspService.init(lspRoot)
      .then(() => {
        if (isMounted) {
          console.log('[SystemIDEApp] LSP Service initialized successfully');
        }
      })
      .catch((error: Error) => {
        if (isMounted) {
          console.error('[SystemIDEApp] LSP Service initialization failed:', error);
        }
      });


    // Cleanup on unmount
    return () => {
      isMounted = false;
      lspService.shutdown().catch((err: Error) => {
        console.error('[SystemIDEApp] LSP Service shutdown error:', err);
      });
    };
  }, [lspRoot]);


  // ─────────────────────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────────────────────

  return (
    <>
      <View id="root" type="Root" name="Root">
        <RootView
          workspaceFolders={workspaceFolders}
          activeFiles={activeFiles}
          searchResultView={searchResultView}
          onOpenFileDetail={handleOpenFile}
          onCloseFile={handleCloseFile}
          onCreateSearchView={handleCreateSearchView}
          onCloseSearchView={handleCloseSearchView}
          onExpandDirs={handleExpandDirs}
          onCollapseDirs={handleCollapseDirs}
          onRefreshWorkspace={handleRefreshWorkspace}
          onAddFolder={handleAddFolder}
          onRemoveFolder={handleRemoveFolder}
          eventBus={eventBus}
        />
      </View>
      {/* ════════════════════════════════════════════════ */}
      {/* Workspace View - 固定挂载 */}
      {/* ════════════════════════════════════════════════ */}
      <View id="workspace" type="Workspace" name="Workspace">
        <WorkspaceContent
          workspaceFolders={workspaceFolders}
          activeFiles={activeFiles}
          expandedDirs={expandedDirs}
          eventBus={eventBus}
        />
      </View>

      {/* ════════════════════════════════════════════════ */}
      {/* FileDetail Views - 动态挂载 */}
      {/* id: fd_0, fd_1, fd_2... */}
      {/* ════════════════════════════════════════════════ */}
      {activeFiles.map((filePath, index) => (
        <FileDetailView
          key={filePath}
          viewId={`fd_${index}`}
          filePath={filePath}
          eventBus={eventBus}
          onClose={() => handleCloseFile(filePath)}
        />
      ))}

      {/* ════════════════════════════════════════════════ */}
      {/* SearchResult View - 按需挂载 */}
      {/* id: search */}
      {/* ════════════════════════════════════════════════ */}
      {searchResultView && (
        <View
          id="search"                    // ✅ 固定ID
          type="SearchResult"            // ✅ 类型
          name="Search Results"
        >
          <SearchResultView
            searchQuery={searchResultView.query}
            results={searchResultView.results}
          />
        </View>
      )}
    </>
  );
}

/**
 * SystemIDEApp 导出
 * 
 * LaunchConfig 配置：
 * - workspace_dir_path: 工作区根目录路径
 *   - 来源优先级: 启动参数 > 环境变量 > process.cwd()
 */
export default createTUIApp({
  app_name: 'system_ide',
  whatItIs: 'A text-based Integrated Development Environment designed for LLM Agents to explore codebases, search files by pattern or content, edit code with precise string replacement, and analyze code structure using Language Server Protocol (LSP) features like type inspection, definitions, references, and call hierarchies.',
  whenToUse: 'Use AOTUI IDE when you need to: (1) Navigate and understand a repository structure, (2) Search for files by glob pattern or grep content, (3) Read, edit, create, delete, or rename files with precision, (4) Analyze code using LSP features (hover types, go to definition, find references, diagnostics, symbols, call graphs), (5) Work with multiple files simultaneously through dynamic FileDetail views.',
  component: SystemIDEApp,
  launchConfig: {
    workspace_dir_path: process.env.WORKSPACE_DIR || process.argv[2] || '',
    projectPath: process.env.PROJECT_PATH || process.env.WORKSPACE_DIR || process.argv[2] || ''
  }
});
