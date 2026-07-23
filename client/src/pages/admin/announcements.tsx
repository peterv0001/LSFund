import { AdminLayout } from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import {
  Megaphone,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Pin,
  Globe,
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

type AnnouncementTarget =
  | "all"
  | "agents_only"
  | "builders_plus"
  | "leaders_plus"
  | "directors_plus"
  | "partners_only";

type Announcement = {
  id: number;
  title: string;
  content: string;
  target: AnnouncementTarget;
  isPinned: boolean;
  isPublished: boolean;
  priority: number;
  publishAt: string | null;
  expiresAt: string | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementForm = {
  title: string;
  content: string;
  target: AnnouncementTarget;
  isPinned: boolean;
  isPublished: boolean;
  priority: number;
};

const TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all: "All Members",
  agents_only: "Agents Only",
  builders_plus: "Builders+",
  leaders_plus: "Leaders+",
  directors_plus: "Directors+",
  partners_only: "Partners Only",
};

const BLANK_FORM: AnnouncementForm = {
  title: "",
  content: "",
  target: "all",
  isPinned: false,
  isPublished: false,
  priority: 0,
};

export default function AdminAnnouncements() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(BLANK_FORM);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: [api.admin.announcements.list.path],
  });

  const createMutation = useMutation({
    mutationFn: (data: AnnouncementForm) =>
      apiRequest("POST", api.admin.announcements.create.path, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.admin.announcements.list.path],
      });
      toast({ title: "Announcement created" });
      setIsOpen(false);
      setForm(BLANK_FORM);
    },
    onError: () =>
      toast({ title: "Failed to create announcement", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: Partial<AnnouncementForm>;
    }) =>
      apiRequest(
        "PATCH",
        buildUrl(api.admin.announcements.update.path, { id }),
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.admin.announcements.list.path],
      });
      toast({ title: "Announcement updated" });
      setIsOpen(false);
      setEditing(null);
      setForm(BLANK_FORM);
    },
    onError: () =>
      toast({ title: "Failed to update announcement", variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(
        "POST",
        buildUrl(api.admin.announcements.publish.path, { id }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.admin.announcements.list.path],
      });
      toast({ title: "Announcement published" });
    },
    onError: () =>
      toast({ title: "Failed to publish", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(
        "DELETE",
        buildUrl(api.admin.announcements.delete.path, { id }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [api.admin.announcements.list.path],
      });
      toast({ title: "Announcement deleted" });
      setDeleteId(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK_FORM);
    setIsOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      content: a.content,
      target: a.target,
      isPinned: a.isPinned,
      isPublished: a.isPublished,
      priority: a.priority,
    });
    setIsOpen(true);
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.content.trim()) {
      toast({
        title: "Title and content are required",
        variant: "destructive",
      });
      return;
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-primary" />
              Announcements
            </h1>
            <p className="text-gray-500 mt-1">
              Create and manage platform-wide announcements
            </p>
          </div>
          <Button data-testid="button-create-announcement" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              No announcements yet. Create your first announcement.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {announcements.map((a) => (
              <Card
                key={a.id}
                data-testid={`card-announcement-${a.id}`}
                className="border border-gray-200"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-gray-900">
                          {a.title}
                        </h3>
                        {a.isPinned && (
                          <Badge
                            variant="outline"
                            className="text-primary border-primary/20 bg-primary/5"
                          >
                            <Pin className="w-3 h-3 mr-1" />
                            Pinned
                          </Badge>
                        )}
                        {a.priority > 0 && (
                          <Badge
                            variant="outline"
                            className="text-purple-600 border-purple-300 bg-purple-50"
                          >
                            Priority {a.priority}
                          </Badge>
                        )}
                        <Badge
                          variant={a.isPublished ? "default" : "secondary"}
                          className={
                            a.isPublished
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : ""
                          }
                        >
                          {a.isPublished ? "Published" : "Draft"}
                        </Badge>
                        <Badge variant="outline">
                          <Globe className="w-3 h-3 mr-1" />
                          {TARGET_LABELS[a.target] ?? a.target}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {a.content}
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Created {format(new Date(a.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!a.isPublished && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-publish-${a.id}`}
                          onClick={() => publishMutation.mutate(a.id)}
                          disabled={publishMutation.isPending}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Publish
                        </Button>
                      )}
                      {a.isPublished && (
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid={`button-unpublish-${a.id}`}
                          onClick={() =>
                            updateMutation.mutate({
                              id: a.id,
                              data: { isPublished: false },
                            })
                          }
                          disabled={updateMutation.isPending}
                        >
                          <EyeOff className="w-4 h-4 mr-1" />
                          Unpublish
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-edit-${a.id}`}
                        onClick={() => openEdit(a)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid={`button-delete-${a.id}`}
                        onClick={() => setDeleteId(a.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Announcement" : "New Announcement"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                data-testid="input-announcement-title"
                placeholder="Announcement title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ann-content">Content</Label>
              <Textarea
                id="ann-content"
                data-testid="input-announcement-content"
                placeholder="Announcement content..."
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Target Audience</Label>
                <Select
                  value={form.target}
                  onValueChange={(v) =>
                    setForm({ ...form, target: v as AnnouncementTarget })
                  }
                >
                  <SelectTrigger data-testid="select-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TARGET_LABELS) as AnnouncementTarget[]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {TARGET_LABELS[k]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ann-priority">
                  Priority (0 = normal, higher = more prominent)
                </Label>
                <Input
                  id="ann-priority"
                  data-testid="input-announcement-priority"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="ann-pinned"
                  data-testid="switch-pinned"
                  checked={form.isPinned}
                  onCheckedChange={(v) => setForm({ ...form, isPinned: v })}
                />
                <Label htmlFor="ann-pinned">Pinned</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="ann-published"
                  data-testid="switch-published"
                  checked={form.isPublished}
                  onCheckedChange={(v) => setForm({ ...form, isPublished: v })}
                />
                <Label htmlFor="ann-published">Published</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              data-testid="button-save-announcement"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Create Announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Announcement</DialogTitle>
          </DialogHeader>
          <p className="text-gray-600">
            Are you sure you want to delete this announcement? This cannot be
            undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              data-testid="button-confirm-delete"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
