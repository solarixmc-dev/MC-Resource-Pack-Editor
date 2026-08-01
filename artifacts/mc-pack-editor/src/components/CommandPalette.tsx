import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { CornerDownLeft, Image as ImageIcon, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FolderIcon } from "./icons";
import { Kbd } from "./ui-kit";

export interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

const MAX_TEXTURE_RESULTS = 40;

export function CommandPalette({
  open,
  onOpenChange,
  folders,
  onSelectFolder,
  actions,
  texturePaths,
  onSelectTexture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: { key: string; label: string; count: number }[];
  onSelectFolder: (key: string) => void;
  actions: PaletteAction[];
  texturePaths: string[];
  onSelectTexture: (path: string) => void;
}) {
  const [query, setQuery] = useState("");

  // Only search textures once the query is specific enough to be useful.
  const textureMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out: string[] = [];
    for (const path of texturePaths) {
      if (path.toLowerCase().includes(q)) {
        out.push(path);
        if (out.length >= MAX_TEXTURE_RESULTS) break;
      }
    }
    return out;
  }, [query, texturePaths]);

  const close = () => {
    onOpenChange(false);
    setQuery("");
  };

  const itemClass =
    "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-foreground";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setQuery("");
      }}
      label="Command palette"
      shouldFilter={false}
      className="animate-overlay fixed inset-0 z-[80] flex items-start justify-center bg-background/70 p-4 pt-[12vh] backdrop-blur-sm"
      overlayClassName="hidden"
      contentClassName="animate-pop w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3.5">
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          autoFocus
          placeholder="Search textures, jump to a folder, run a command…"
          className="h-11 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>

      <Command.List className="max-h-[22rem] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
          No matches for &ldquo;{query}&rdquo;
        </Command.Empty>

        {actions.filter((a) => match(a.label, query) && !a.disabled).length > 0 && (
          <Command.Group
            heading="Actions"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {actions
              .filter((a) => match(a.label, query) && !a.disabled)
              .map((action) => (
                <Command.Item
                  key={action.id}
                  value={action.id}
                  onSelect={() => {
                    action.run();
                    close();
                  }}
                  className={itemClass}
                >
                  <action.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1 truncate">{action.label}</span>
                  {action.shortcut && <Kbd>{action.shortcut}</Kbd>}
                </Command.Item>
              ))}
          </Command.Group>
        )}

        {folders.filter((f) => match(f.label, query)).length > 0 && (
          <Command.Group
            heading="Folders"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {folders
              .filter((f) => match(f.label, query))
              .map((folder) => (
                <Command.Item
                  key={folder.key}
                  value={`folder-${folder.key}`}
                  onSelect={() => {
                    onSelectFolder(folder.key);
                    close();
                  }}
                  className={itemClass}
                >
                  <FolderIcon folderKey={folder.key} className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 truncate">{folder.label}</span>
                  <span className="tabular text-xs text-muted-foreground">{folder.count}</span>
                </Command.Item>
              ))}
          </Command.Group>
        )}

        {textureMatches.length > 0 && (
          <Command.Group
            heading="Textures"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            {textureMatches.map((path) => (
              <Command.Item
                key={path}
                value={`texture-${path}`}
                onSelect={() => {
                  onSelectTexture(path);
                  close();
                }}
                className={itemClass}
              >
                <ImageIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate">
                  <span className="text-foreground">{path.split("/").pop()}</span>
                  <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{path}</span>
                </span>
                <CornerDownLeft className="h-3 w-3 flex-shrink-0 opacity-50" aria-hidden="true" />
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

function match(label: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return label.toLowerCase().includes(q);
}
