import { AdminSidebar } from "@/components/AdminSidebar";
import { SchemaDriftBanner } from "@/components/SchemaDriftBanner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Video,
  FileText,
  Link as LinkIcon,
  File,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";

type Resource = {
  id: number;
  title: string;
  description: string | null;
  type: "video" | "pdf" | "link" | "document";
  url: string;
  thumbnailUrl: string | null;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  video: Video,
  pdf: FileText,
  link: LinkIcon,
  document: File,
};

const TYPE_COLORS: Record<string, string> = {
  video: "bg-purple-100 text-purple-700",
  pdf: "bg-red-100 text-red-700",
  link: "bg-blue-100 text-blue-700",
  document: "bg-gray-100 text-gray-700",
};

type ResourceType = "video" | "pdf" | "link" | "document";

type ResourceForm = {
  title: string;
  description: string;
  type: ResourceType;
  url: string;
  thumbnailUrl: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
};

const CATEGORIES = ["general", "training", "marketing", "compliance"];

const BLANK_FORM: ResourceForm = {
  title: "",
  description: "",
  type: "link",
  url: "",
  thumbnailUrl: "",
  category: "general",
  sortOrder: 0,
  isPublished: true,
};

export default function AdminResources() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Resource | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: resources = [], isLoading } = useQuery<Resource[]>({
    queryKey: [api.admin.resources.list.path],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof BLANK_FORM) =>
      apiRequest("POST", api.admin.resources.create.path, {
        ...data,
        description: data.description || null,
        thumbnailUrl: data.thumbnailUrl || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.resources.list.path] });
      toast({ title: "Resource created" });
      setIsOpen(false);
      setForm(BLANK_FORM);
    },
    onError: () => toast({ title: "Failed to create resource", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof BLANK_FORM> }) =>
      apiRequest("PATCH", buildUrl(api.admin.resources.update.path, { id }), {
        ...data,
        ...('description' in data ? { description: data.description || null } : {}),
        ...('thumbnailUrl' in data ? { thumbnailUrl: data.thumbnailUrl || null } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.resources.list.path] });
      toast({ title: "Resource updated" });
      setIsOpen(false);
      setEditing(null);
      setForm(BLANK_FORM);
    },
    onError: () => toast({ title: "Failed to update resource", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", buildUrl(api.admin.resources.delete.path, { id })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.resources.list.path] });
      toast({ title: "Resource deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK_FORM);
    setIsOpen(true);
  }

  function openEdit(r: Resource) {
    setEditing(r);
    setForm({
      title: r.title,
      description: r.description ?? "",
      type: r.type,
      url: r.url,
      thumbnailUrl: r.thumbnailUrl ?? "",
      category: r.category,
      sortOrder: r.sortOrder,
      isPublished: r.isPublished,
    });
    setIsOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.url.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const filtered = categoryFilter === "all"
    ? resources
    : resources.filter((r) => r.category === categoryFilter);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 ml-64 p-8">
        <SchemaDriftBanner />
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                Resources
              </h1>
              <p className="text-gray-500 mt-1">Manage training materials, marketing assets, and documents</p>
            </div>
            <Button data-testid="button-create-resource" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Add Resource
            </Button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {["all", ...CATEGORIES].map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                data-testid={`button-filter-${cat}`}
                onClick={() => setCategoryFilter(cat)}
                className="capitalize"
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                No resources found. Add your first resource.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((r) => {
                const Icon = TYPE_ICONS[r.type] ?? File;
                return (
                  <Card key={r.id} data-testid={`card-resource-${r.id}`} className="border border-gray-200">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TYPE_COLORS[r.type] ?? "bg-gray-100 text-gray-700"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={r.isPublished ? "default" : "secondary"} className={r.isPublished ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                            {r.isPublished ? "Published" : "Draft"}
                          </Badge>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{r.title}</h3>
                      {r.description && (
                        <p className="text-sm text-gray-500 mb-2 line-clamp-2">{r.description}</p>
                      )}
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline" className="capitalize text-xs">{r.category}</Badge>
                        <Badge variant="outline" className="uppercase text-xs">{r.type}</Badge>
                      </div>
                      <p className="text-xs text-gray-400 mb-3">
                        Added {format(new Date(r.createdAt), "MMM d, yyyy")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          data-testid={`button-toggle-published-${r.id}`}
                          onClick={() => updateMutation.mutate({ id: r.id, data: { isPublished: !r.isPublished } })}
                          disabled={updateMutation.isPending}
                        >
                          {r.isPublished ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                          {r.isPublished ? "Unpublish" : "Publish"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-edit-resource-${r.id}`}
                          onClick={() => openEdit(r)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-delete-resource-${r.id}`}
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteId(r.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Resource" : "Add Resource"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                data-testid="input-resource-title"
                placeholder="Resource title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea
                data-testid="input-resource-description"
                placeholder="Brief description..."
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ResourceType })}>
                  <SelectTrigger data-testid="select-resource-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="select-resource-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>URL</Label>
              <Input
                data-testid="input-resource-url"
                placeholder="https://"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Thumbnail URL (optional)</Label>
              <Input
                data-testid="input-resource-thumbnail"
                placeholder="https://"
                value={form.thumbnailUrl}
                onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  data-testid="input-resource-sort-order"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="res-published"
                  data-testid="switch-resource-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="res-published">Published</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            <Button data-testid="button-save-resource" onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Add Resource"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Resource</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">Are you sure you want to delete this resource? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-delete-resource"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
