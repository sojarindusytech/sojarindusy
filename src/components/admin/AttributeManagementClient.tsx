"use client";

import { PageTitle } from "@/components/common/PageTitle";
import { useState, useTransition } from "react";
import { Attribute } from "@/types/database.types";
import { createAttribute, deleteAttribute, getAttributeUsage, type AttributeUsage } from "@/actions/attribute";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/common/IconAction";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sparkles,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Layers,
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
  // Delete confirmation: usage is loaded first, the delete button only shows when there is none.
  const [deleteTarget, setDeleteTarget] = useState<{
    attr: Attribute;
    loading: boolean;
    usage?: AttributeUsage;
    error?: string;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

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

  const openDelete = async (attr: Attribute) => {
    setDeleteTarget({ attr, loading: true });
    const res = await getAttributeUsage(attr.id);
    // Ignore the answer if the dialog was closed or switched to another attribute meanwhile.
    setDeleteTarget((prev) =>
      prev?.attr.id === attr.id ? { attr, loading: false, usage: res.usage, error: res.error } : prev
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { attr } = deleteTarget;
    startTransition(async () => {
      const res = await deleteAttribute(attr.id);
      if (res.error) {
        toast.error(res.error, { duration: 6000 });
      } else {
        toast.success(`Attribute "${attr.name}" deleted.`);
        setAttributes((prev) => prev.filter((t) => t.id !== attr.id));
      }
      setDeleteTarget(null);
    });
  };

  const usage = deleteTarget?.usage;
  const inUse = Boolean(usage && (usage.products.length > 0 || usage.skuCount > 0));

  const filteredAttributes = attributes.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    return !query || t.name.toLowerCase().includes(query) || t.slug.includes(query);
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <PageTitle icon={Sparkles}>Attributes</PageTitle>
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

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200 bg-white shadow-none rounded-xl p-4">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
            Total Attributes
          </p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{filteredAttributes.length}</h3>
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
                      <IconAction label="Delete attribute" tone="danger" disabled={isPending} onClick={() => openDelete(attr)}><Trash2 /></IconAction>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-2xl p-6">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                  inUse ? "bg-amber-50 text-amber-600 border-amber-200" : "bg-rose-50 text-rose-600 border-rose-200"
                }`}
              >
                {inUse ? <AlertCircle className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
              </div>
              <AlertDialogTitle className="text-base font-bold text-slate-900">
                {deleteTarget?.loading
                  ? "Checking attribute usage..."
                  : inUse
                  ? `"${deleteTarget?.attr.name}" is in use`
                  : `Delete "${deleteTarget?.attr.name}"?`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-xs text-slate-600 pt-2 leading-relaxed space-y-3">
                {deleteTarget?.loading ? (
                  <p className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Looking for product families and SKUs that use it.
                  </p>
                ) : deleteTarget?.error ? (
                  <p className="text-rose-700">{deleteTarget.error}</p>
                ) : inUse && usage ? (
                  <>
                    <p>This attribute can&apos;t be deleted while it is used. Remove it from these first:</p>
                    {usage.products.length > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" /> {usage.products.length} product famil{usage.products.length === 1 ? "y" : "ies"}
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {usage.products.slice(0, 5).join(", ")}
                          {usage.products.length > 5 && ` and ${usage.products.length - 5} more`}
                        </p>
                      </div>
                    )}
                    {usage.skuCount > 0 && (
                      <div>
                        <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5" /> {usage.skuCount} SKU{usage.skuCount === 1 ? "" : "s"}
                        </p>
                        <p className="text-slate-500 mt-0.5 font-mono">
                          {usage.skus.join(", ")}
                          {usage.skuCount > usage.skus.length && ` and ${usage.skuCount - usage.skus.length} more`}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p>It is not assigned to any product family or SKU. This deletes it permanently.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <AlertDialogCancel className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-50">
              {inUse || deleteTarget?.error ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!deleteTarget?.loading && !deleteTarget?.error && !inUse && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
                disabled={isPending}
                className="h-8 text-xs font-medium text-white shadow-none bg-rose-600 hover:bg-rose-700"
              >
                {isPending ? "Deleting..." : "Delete attribute"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Backward compatibility export
export const TagManagementClient = AttributeManagementClient;
