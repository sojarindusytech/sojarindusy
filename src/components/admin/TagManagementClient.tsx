"use client";

import { useState, useTransition } from "react";
import { Tag } from "@/types/database.types";
import { createTag, deleteTag } from "@/actions/tag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tag as TagIcon,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface TagManagementClientProps {
  initialTags: Tag[];
}

export function TagManagementClient({ initialTags }: TagManagementClientProps) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [typeInput, setTypeInput] = useState("hardness");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const totalCount = tags.length;
  const hardnessCount = tags.filter((t) => t.type === "hardness").length;
  const coatingCount = tags.filter((t) => t.type === "coating").length;
  const materialCount = tags.filter((t) => t.type === "material").length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!nameInput.trim()) {
      setFormError("Tag name is required.");
      return;
    }

    startTransition(async () => {
      const res = await createTag(nameInput, typeInput);
      if (res.error) {
        setFormError(res.error);
      } else {
        setFormSuccess(`Tag "${nameInput}" created successfully.`);
        if (res.tag) {
          setTags((prev) => [res.tag!, ...prev]);
        }
        setNameInput("");
        setIsModalOpen(false);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    startTransition(async () => {
      const res = await deleteTag(id);
      if (!res.error) {
        setTags((prev) => prev.filter((t) => t.id !== id));
      }
    });
  };

  const filteredTags = tags.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = !query || t.name.toLowerCase().includes(query) || t.slug.includes(query);
    const matchesType = typeFilter === "all" || t.type === typeFilter;
    return matchesQuery && matchesType;
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Product Tags Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Define hardness ratings (HRC 55, HRC 45, HRC 65), material grades, and coating specifications.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-2 font-bold cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add New Tag</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Total Tags</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Hardness Ratings</p>
          <h3 className="text-2xl font-bold text-[#024AE5] mt-1">{hardnessCount}</h3>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Coating Types</p>
          <h3 className="text-2xl font-bold text-[#3C8B4F] mt-1">{coatingCount}</h3>
        </Card>
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Material Grades</p>
          <h3 className="text-2xl font-bold text-slate-700 mt-1">{materialCount}</h3>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#024AE5]" /> Add New Tag
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Create a new tag attribute for your products.
            </DialogDescription>
          </DialogHeader>

          <div className="pt-4 space-y-4">
            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/20 bg-rose-50 p-2.5 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <p>{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                <p>{formSuccess}</p>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Tag Name *</Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. HRC 55, HRC 65, TiAlN"
                  required
                  className="h-9 text-xs border-slate-200"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium text-slate-700">Tag Type</Label>
                <Select value={typeInput} onValueChange={setTypeInput}>
                  <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hardness">Hardness Rating (e.g. HRC 55)</SelectItem>
                    <SelectItem value="material">Material Grade (e.g. Carbide)</SelectItem>
                    <SelectItem value="coating">Coating (e.g. TiAlN)</SelectItem>
                    <SelectItem value="general">General Tag</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="h-8 text-xs font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="h-8 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] font-medium px-6"
                >
                  {isPending ? "Creating..." : "Create Tag"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tags Table (12 cols) */}
        <Card className="lg:col-span-12 border border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-slate-50/60 border-slate-200"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-8 text-xs bg-white border-slate-200 w-36">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hardness">Hardness</SelectItem>
                <SelectItem value="coating">Coating</SelectItem>
                <SelectItem value="material">Material</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow className="border-0">
                <TableHead className="w-[40%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5">
                  Tag Name
                </TableHead>
                <TableHead className="w-[30%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5">
                  Type
                </TableHead>
                <TableHead className="w-[20%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5">
                  Slug
                </TableHead>
                <TableHead className="w-[10%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5 text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-400">
                    No tags found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTags.map((tag) => (
                  <TableRow key={tag.id} className="text-xs hover:bg-slate-50 border-b border-slate-100">
                    <TableCell className="py-2.5 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                      <TagIcon className="h-3.5 w-3.5 text-[#024AE5]" />
                      <span>{tag.name}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 uppercase text-[10px]">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded border border-slate-200">
                        {tag.type}
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                      {tag.slug}
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tag.id, tag.name)}
                        className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
