"use client";

import { useState } from "react";
import { CategoryNode } from "@/types/database.types";
import { ChevronRight, ChevronDown, Folder, Tag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryCheckboxTreeProps {
  treeNodes: CategoryNode[];
  selectedIds: string[];
  onChange: (newSelectedIds: string[]) => void;
  className?: string;
}

export function CategoryCheckboxTree({
  treeNodes,
  selectedIds,
  onChange,
  className,
}: CategoryCheckboxTreeProps) {
  // Track open/collapsed nodes
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getPathToNode = (nodes: CategoryNode[], targetId: string, currentPath: string[] = []): string[] | null => {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [...currentPath, node.id];
      }
      if (node.children && node.children.length > 0) {
        const foundPath = getPathToNode(node.children, targetId, [...currentPath, node.id]);
        if (foundPath) return foundPath;
      }
    }
    return null;
  };

  // Helper to handle checkbox toggle
  const handleToggleCategory = (nodeId: string) => {
    const isCurrentlySelected = selectedIds.includes(nodeId);
    let updatedSelected = [...selectedIds];

    if (isCurrentlySelected) {
      // Uncheck this node
      updatedSelected = updatedSelected.filter((id) => id !== nodeId);
    } else {
      // Check this node and all parents
      const pathToNode = getPathToNode(treeNodes, nodeId);
      if (pathToNode) {
        pathToNode.forEach((id) => {
          if (!updatedSelected.includes(id)) {
            updatedSelected.push(id);
          }
        });
      }
    }

    onChange(updatedSelected);
  };

  const renderNode = (node: CategoryNode) => {
    const isSelected = selectedIds.includes(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? false; // Default collapsed to show root only

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs transition-colors hover:bg-slate-50 border border-transparent",
            isSelected && "bg-slate-50/80 border-slate-200/80 font-medium"
          )}
          style={{ paddingLeft: `${node.depth * 18 + 8}px` }}
        >
          {/* Expand Toggle */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpand(node.id)}
              className="h-4 w-4 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          {/* Custom Checkbox */}
          <button
            type="button"
            onClick={() => handleToggleCategory(node.id)}
            className={cn(
              "h-4 w-4 rounded shrink-0 flex items-center justify-center border transition-all cursor-pointer",
              isSelected
                ? "bg-[#024AE5] border-[#024AE5] text-white shadow-2xs"
                : "border-slate-300 bg-white hover:border-slate-400"
            )}
          >
            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
          </button>

          {/* Node Icon & Name */}
          <div
            onClick={() => handleToggleCategory(node.id)}
            className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer select-none"
          >
            {node.depth === 0 ? (
              <Folder className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            ) : (
              <Tag className="h-3 w-3 text-slate-400 shrink-0" />
            )}
            <span className="text-slate-800 text-xs truncate">{node.name}</span>
            {node.depth === 0 && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded font-normal ml-1">
                Root
              </span>
            )}
          </div>
        </div>

        {/* Children Subtree */}
        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {node.children.map((child) => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("space-y-1 text-xs border border-slate-200 rounded-xl p-3 bg-white", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 pb-2 border-b border-slate-100 flex items-center justify-between">
        <span>Categories Tree</span>
        <span className="text-[10px] text-slate-400 font-normal">
          {selectedIds.length} Selected
        </span>
      </div>

      <div className="pt-1 space-y-1 max-h-72 overflow-y-auto">
        {treeNodes.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">No categories available.</p>
        ) : (
          treeNodes.map((node) => renderNode(node))
        )}
      </div>
    </div>
  );
}
