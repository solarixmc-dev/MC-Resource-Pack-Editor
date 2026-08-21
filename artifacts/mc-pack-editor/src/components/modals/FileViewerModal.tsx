import { useState, useMemo } from "react";
import { Pack } from "../../types";

export interface FileViewerModalProps {
  pack: Pack;
  onClose: () => void;
  onDeleteFile: (path: string) => void;
  darkMode: boolean;
  stripColorCodes: (name: string) => string;
}

export function FileViewerModal({
  pack,
  onClose,
  onDeleteFile,
  darkMode,
  stripColorCodes,
}: FileViewerModalProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Build file tree structure
  const fileTree = useMemo(() => {
    const tree: Record<string, { type: 'file' | 'folder'; children?: Record<string, any>; size?: number }> = {};
    
    pack.files.forEach((buffer, path) => {
      const parts = path.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const key = part;
        
        if (!current[key]) {
          current[key] = isFile 
            ? { type: 'file', size: buffer.byteLength }
            : { type: 'folder', children: {} };
        }
        
        if (!isFile && current[key].children) {
          current = current[key].children;
        }
      });
    });
    
    return tree;
  }, [pack]);

  // Filter files based on search
  const filteredTree = useMemo(() => {
    if (!searchQuery) return fileTree;
    
    const query = searchQuery.toLowerCase();
    const filterNode = (node: any, path: string = ''): any => {
      if (node.type === 'file') {
        return path.toLowerCase().includes(query) ? node : null;
      }
      
      if (node.type === 'folder' && node.children) {
        const filteredChildren: any = {};
        let hasMatchingChild = false;
        
        Object.entries(node.children).forEach(([key, child]) => {
          const childPath = path ? `${path}/${key}` : key;
          const filtered = filterNode(child, childPath);
          if (filtered) {
            filteredChildren[key] = filtered;
            hasMatchingChild = true;
          }
        });
        
        if (hasMatchingChild) {
          return { ...node, children: filteredChildren };
        }
      }
      
      return null;
    };
    
    return filterNode(fileTree);
  }, [fileTree, searchQuery]);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderNode = (node: any, name: string, path: string = '', level: number = 0) => {
    const fullPath = path ? `${path}/${name}` : name;
    const isExpanded = expandedFolders.has(fullPath);
    
    // Count files in folder
    const countFilesInNode = (n: any): number => {
      if (n.type === 'file') return 1;
      if (n.type === 'folder' && n.children) {
        return (Object.values(n.children) as any[]).reduce((sum: number, child: any) => sum + countFilesInNode(child), 0);
      }
      return 0;
    };
    
    const fileCount = node.type === 'folder' ? countFilesInNode(node) : 0;
    
    if (node.type === 'file') {
      return (
        <div 
          key={fullPath}
          className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer group
            ${darkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <span className="text-slate-400">📄</span>
          <span className="flex-1 truncate text-sm">{name}</span>
          <span className="text-xs text-muted-foreground">{formatSize(node.size || 0)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(fullPath);
            }}
            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity"
            title="Delete file"
          >
            🗑️
          </button>
        </div>
      );
    }
    
    if (node.type === 'folder' && node.children) {
      const childKeys = Object.keys(node.children);
      return (
        <div key={fullPath}>
          <div
            className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent cursor-pointer
              ${darkMode ? "text-slate-300 hover:text-slate-100" : "text-slate-600 hover:text-slate-900"}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => toggleFolder(fullPath)}
          >
            <span>{isExpanded ? '📂' : '📁'}</span>
            <span className="flex-1 truncate text-sm font-medium">{name}</span>
            <span className="text-xs text-muted-foreground">{fileCount} files</span>
          </div>
          {isExpanded && (
            <div>
              {childKeys.map(key => renderNode(node.children[key], key, fullPath, level + 1))}
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const totalSize = Array.from(pack.files.values()).reduce((sum, buffer) => sum + buffer.byteLength, 0);
  const fileCount = pack.files.size;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={`flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-border bg-white dark:bg-dark-secondary shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">File Viewer</p>
            <h3 className="text-lg font-semibold text-foreground">{stripColorCodes(pack.name)}</h3>
            <p className="text-sm text-muted-foreground">{fileCount.toLocaleString()} files • {formatSize(totalSize)}</p>
          </div>
          <button onClick={onClose} className={`rounded-full border-2 border-border bg-secondary px-2.5 py-1 text-sm text-muted-foreground hover:text-foreground`}>✕</button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${darkMode ? "sleek-input" : "sleek-input-light"}`}
          />
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {Object.keys(filteredTree).length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              {searchQuery ? "No files match your search" : "This pack is empty"}
            </div>
          ) : (
            <div className="text-sm">
              {Object.entries(filteredTree).map(([name, node]) => renderNode(node, name))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex justify-between items-center">
          <p className="text-xs text-muted-foreground">Click folders to expand, click 🗑️ to delete files</p>
          <button onClick={onClose} className="rounded-lg border-2 border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default FileViewerModal;
