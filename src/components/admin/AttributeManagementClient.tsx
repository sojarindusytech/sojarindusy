"use client";

import { useState, useTransition } from "react";
import { Attribute } from "@/types/database.types";
import { createAttribute, deleteAttribute } from "@/actions/attribute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sparkles,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface AttributeManagementClientProps {
  initialAttributes?: Attribute[];
  initialTags?: Attribute[];
}

export function AttributeManagementClient({
  initialAttributes,
  initialTags,
}: AttributeManagementClientProps) {
  const [attributes, setAttributes] = useState<Attribute[]>(
    initialAttributes || initialTags || []
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [nameInput, setNameInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const totalCount = attributes.length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setActionError(null);

    if (!nameInput.trim()) {
      setFormError("Attribute name is required.");
      return;
    }

    startTransition(async () => {
      const res = await createAttribute(nameInput);
      if (res.error) {
        setFormError(res.error);
        toast.error(res.error);
      } else {
        setFormSuccess(`Attribute "${nameInput}" created successfully.`);
        toast.success(`Attribute "${nameInput}" created successfully.`);
        if (res.attribute) {
          setAttributes((prev) => [res.attribute!, ...prev]);
        }
        setNameInput("");
        setIsModalOpen(false);
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    setActionError(null);
    if (!confirm(`Are you sure you want to delete attribute "${name}"?`)) return;

    startTransition(async () => {
      const res = await deleteAttribute(id);
      if (res.error) {
        setActionError(res.error);
        toast.error(res.error, { duration: 6000 });
      } else {
        toast.success(`Attribute "${name}" deleted.`);
        setAttributes((prev) => prev.filter((t) => t.id !== id));
      }
    });
  };

  const filteredAttributes = attributes.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    return !query || t.name.toLowerCase().includes(query) || t.slug.includes(query);
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Product Attributes Management
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="h-9 px-4 text-xs bg-[#024AE5] text-white hover:bg-[#023ecc] gap-2 font-bold cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add New Attribute</span>
          </Button>
        </div>
      </div>

      {/* Global Action Error Alert */}
      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-xs text-rose-900 shadow-xs animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 mt-0.5 shrink-0">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-rose-900 text-sm">Cannot Delete Attribute</p>
              <p className="text-slate-700 leading-relaxed">{actionError}</p>
            </div>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-semibold px-2 py-1 rounded-md hover:bg-rose-100/50 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Total Attributes
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</h3>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md bg-white p-6">
          <DialogHeader className="pb-3 border-b border-slate-200">
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#024AE5]" /> Add New Attribute
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Create a new attribute for grouping product SKUs.
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-700">Attribute Name <span className="text-red-500">*</span></Label>
                <Input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="e.g. HRC 45, HRC 55, HRC 65"
                  required
                  className="h-9 text-xs border-slate-200"
                />
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
                  {isPending ? "Creating..." : "Create Attribute"}
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Attributes Table (12 cols) */}
        <Card className="lg:col-span-12 border border-slate-200 bg-white shadow-none rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search attributes by name or slug..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs bg-slate-50/60 border-slate-200"
              />
            </div>
          </div>

          <Table className="w-full table-fixed">
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow className="border-0">
                <TableHead className="w-[60%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5">
                  Attribute Name
                </TableHead>
                <TableHead className="w-[30%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5">
                  Slug
                </TableHead>
                <TableHead className="w-[10%] text-[11px] font-semibold text-slate-600 uppercase py-2.5 px-3.5 text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttributes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-xs text-slate-400">
                    No attributes found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttributes.map((attr) => (
                  <TableRow key={attr.id} className="text-xs hover:bg-slate-50 border-b border-slate-100">
                    <TableCell className="py-2.5 px-3.5 font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-[#024AE5]" />
                      <span>{attr.name}</span>
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                      {attr.slug}
                    </TableCell>
                    <TableCell className="py-2.5 px-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(attr.id, attr.name)}
                        className="h-7 w-7 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="Delete Attribute (Only if unassigned)"
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

// Backward compatibility export
export const TagManagementClient = AttributeManagementClient;
