import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MemoryImageViewer } from "@/components/MemoryImageViewer";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Plus, Search, X, Brain, Trash2, Edit2, Loader2, Star,
  Image as ImageIcon, Grid3X3, List, ArrowUpDown, ArrowLeft,
  Calendar, SortAsc, SortDesc
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Memory {
  id: string;
  user_id: string;
  content: string;
  summary: string | null;
  keywords: string[] | null;
  tags: string[] | null;
  importance: number | null;
  ai_insight: string | null;
  image_url: string | null;
  embedding: string | null;
  created_at: string;
  updated_at: string;
}

type SortField = "created_at" | "importance" | "updated_at";
type SortDir = "asc" | "desc";
type ViewMode = "grid" | "list";

const getSignedImageUrl = async (imageUrl: string): Promise<string | null> => {
  const parts = imageUrl.split("/memory-images/");
  if (parts.length < 2) return null;
  const path = parts[1].split("?")[0];
  const { data, error } = await supabase.storage
    .from("memory-images")
    .createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
};

export default function MemoryManager() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resolveSignedUrls = async (mems: Memory[]) => {
    const urls: Record<string, string> = {};
    await Promise.all(
      mems
        .filter((m) => m.image_url)
        .map(async (m) => {
          const signed = await getSignedImageUrl(m.image_url!);
          if (signed) urls[m.id] = signed;
        })
    );
    setSignedUrls(urls);
  };

  const fetchMemories = async () => {
    if (!user) return;
    setFetching(true);
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load memories");
    } else {
      const mems = (data as Memory[]) || [];
      setMemories(mems);
      resolveSignedUrls(mems);
    }
    setFetching(false);
  };

  useEffect(() => {
    fetchMemories();
  }, [user]);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("memory-images")
      .upload(path, file);
    if (error) {
      toast.error("Failed to upload image");
      return null;
    }
    const { data: urlData, error: urlError } = await supabase.storage
      .from("memory-images")
      .createSignedUrl(path, 3600);
    if (urlError || !urlData?.signedUrl) {
      toast.error("Failed to get image URL");
      return null;
    }
    return urlData.signedUrl;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    if (!user || (!newContent.trim() && !selectedImage)) return;
    setSaving(true);
    let imageUrl: string | null = null;
    if (selectedImage) {
      imageUrl = await uploadImage(selectedImage);
    }
    const { data, error } = await supabase
      .from("memories")
      .insert({
        user_id: user.id,
        content: newContent.trim() || "(Image memory)",
        image_url: imageUrl,
      } as any)
      .select()
      .single();
    if (error) {
      toast.error("Failed to save memory");
    } else {
      setMemories((prev) => [data as Memory, ...prev]);
      setNewContent("");
      setSelectedImage(null);
      setImagePreview(null);
      setShowAdd(false);
      toast.success("Memory saved! AI is processing...");
      try {
        await supabase.functions.invoke("process-memory", {
          body: { memoryId: data.id },
        });
        fetchMemories();
      } catch {}
    }
    setSaving(false);
  };

  const handleDelete = async (memory: Memory) => {
    if (memory.image_url) {
      const path = memory.image_url.split("/memory-images/")[1]?.split("?")[0];
      if (path) {
        await supabase.storage.from("memory-images").remove([path]);
      }
    }
    const { error } = await supabase.from("memories").delete().eq("id", memory.id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      setMemories((prev) => prev.filter((m) => m.id !== memory.id));
      toast.success("Memory deleted");
    }
  };

  const handleEdit = async (id: string) => {
    if (!editContent.trim()) return;
    const { error } = await supabase
      .from("memories")
      .update({ content: editContent.trim() })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update");
    } else {
      setEditingId(null);
      toast.success("Memory updated! Re-processing...");
      try {
        await supabase.functions.invoke("process-memory", {
          body: { memoryId: id },
        });
      } catch {}
      fetchMemories();
    }
  };

  const allTags = useMemo(
    () => Array.from(new Set(memories.flatMap((m) => m.tags || []))),
    [memories]
  );

  const filtered = useMemo(() => {
    let result = memories.filter((m) => {
      const matchesSearch =
        !search ||
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        m.summary?.toLowerCase().includes(search.toLowerCase()) ||
        m.keywords?.some((k) => k.toLowerCase().includes(search.toLowerCase()));
      const matchesTag = !tagFilter || (m.tags || []).includes(tagFilter);
      return matchesSearch && matchesTag;
    });

    result.sort((a, b) => {
      let valA: number, valB: number;
      if (sortField === "importance") {
        valA = a.importance ?? 0;
        valB = b.importance ?? 0;
      } else {
        valA = new Date(a[sortField]).getTime();
        valB = new Date(b[sortField]).getTime();
      }
      return sortDir === "desc" ? valB - valA : valA - valB;
    });
    return result;
  }, [memories, search, tagFilter, sortField, sortDir]);

  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background">
        <Brain className="w-10 h-10 text-primary animate-pulse" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button size="icon" variant="ghost" onClick={() => navigate("/")} className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Brain className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Memory Manager</h1>
            <Badge variant="secondary" className="text-xs">{memories.length}</Badge>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" className="gap-1">
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAdd ? "Cancel" : "New Memory"}
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
        {/* Add memory form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Card className="border-primary/20">
                <CardContent className="p-4 space-y-3">
                  <Textarea
                    placeholder="What do you want to remember?"
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    className="bg-secondary/50 border-border/30 resize-none"
                    rows={3}
                  />
                  {imagePreview && (
                    <div className="relative rounded-md overflow-hidden w-fit">
                      <img src={imagePreview} alt="Preview" className="h-32 object-cover rounded-md" />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                        onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <ImageIcon className="w-4 h-4 mr-1" /> Attach Image
                    </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={saving || (!newContent.trim() && !selectedImage)}
                      size="sm"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                      Save Memory
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search memories, keywords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-secondary/50 border-border/30"
            />
          </div>

          <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
            <SelectTrigger className="w-[160px] bg-secondary/50">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Date Created</SelectItem>
              <SelectItem value="updated_at">Last Updated</SelectItem>
              <SelectItem value="importance">Importance</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="icon"
            variant="outline"
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            className="h-9 w-9"
            title={sortDir === "desc" ? "Descending" : "Ascending"}
          >
            {sortDir === "desc" ? <SortDesc className="w-4 h-4" /> : <SortAsc className="w-4 h-4" />}
          </Button>

          <div className="flex border border-border rounded-md overflow-hidden">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-9 w-9 rounded-none"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant={tagFilter === null ? "default" : "secondary"}
              className="cursor-pointer text-xs"
              onClick={() => setTagFilter(null)}
            >
              All
            </Badge>
            {allTags.map((tag) => (
              <Badge
                key={tag}
                variant={tagFilter === tag ? "default" : "secondary"}
                className="cursor-pointer text-xs"
                onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Memory grid/list */}
        {fetching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No memories found</p>
            <p className="text-sm">
              {search || tagFilter ? "Try adjusting your filters" : "Create your first memory above"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {filtered.map((memory) => (
                <motion.div
                  key={memory.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <Card className="group hover:border-primary/30 transition-colors h-full">
                    <CardContent className="p-0">
                      {editingId === memory.id ? (
                        <div className="p-4">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="mb-2 bg-secondary/50 resize-none text-sm"
                            rows={4}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => handleEdit(memory.id)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {memory.image_url && signedUrls[memory.id] && (
                            <MemoryImageViewer
                              src={signedUrls[memory.id]}
                              thumbnailClassName="w-full h-40 object-cover rounded-t-lg"
                            />
                          )}
                          <div className="p-4 space-y-2">
                            <p className="text-sm text-foreground line-clamp-3">
                              {memory.summary || memory.content}
                            </p>

                            {memory.importance != null && (
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 text-primary" />
                                <span className="text-xs text-muted-foreground">{memory.importance}/10</span>
                              </div>
                            )}

                            {memory.tags && memory.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {memory.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                                ))}
                              </div>
                            )}

                            {memory.ai_insight && (
                              <p className="text-xs text-accent italic">💡 {memory.ai_insight}</p>
                            )}

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(memory.created_at).toLocaleDateString()}
                              </span>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6"
                                  onClick={() => { setEditingId(memory.id); setEditContent(memory.content); }}
                                >
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon" variant="ghost" className="h-6 w-6 hover:text-destructive"
                                  onClick={() => handleDelete(memory)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((memory) => (
                <motion.div
                  key={memory.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <Card className="group hover:border-primary/30 transition-colors">
                    <CardContent className="p-4 flex gap-4">
                      {memory.image_url && signedUrls[memory.id] && (
                        <MemoryImageViewer
                          src={signedUrls[memory.id]}
                          thumbnailClassName="w-24 h-24 object-cover rounded-md shrink-0"
                        />
                      )}
                      {editingId === memory.id ? (
                        <div className="flex-1">
                          <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="mb-2 bg-secondary/50 resize-none text-sm"
                            rows={3}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => handleEdit(memory.id)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 space-y-1.5">
                          <p className="text-sm text-foreground">{memory.summary || memory.content}</p>
                          <div className="flex items-center gap-3 flex-wrap">
                            {memory.importance != null && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Star className="w-3 h-3 text-primary" /> {memory.importance}/10
                              </span>
                            )}
                            {memory.tags?.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                            ))}
                            <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(memory.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {memory.ai_insight && (
                            <p className="text-xs text-accent italic">💡 {memory.ai_insight}</p>
                          )}
                        </div>
                      )}
                      {editingId !== memory.id && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 shrink-0">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditingId(memory.id); setEditContent(memory.content); }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                            onClick={() => handleDelete(memory)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
