import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X, Brain, Trash2, Edit2, Loader2, Star, Image as ImageIcon } from "lucide-react";

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

export function MemorySidebar() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMemories = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load memories");
    } else {
      setMemories((data as Memory[]) || []);
    }
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
    const { data: urlData } = supabase.storage
      .from("memory-images")
      .getPublicUrl(path);
    return urlData.publicUrl;
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
      } catch {
        // AI processing is async
      }
    }
    setSaving(false);
  };

  const handleDelete = async (memory: Memory) => {
    // Delete image from storage if exists
    if (memory.image_url) {
      const path = memory.image_url.split("/memory-images/")[1];
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

  const allTags = Array.from(new Set(memories.flatMap((m) => m.tags || [])));

  const filtered = memories.filter((m) => {
    const matchesSearch =
      !search ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.summary?.toLowerCase().includes(search.toLowerCase());
    const matchesTag = !tagFilter || (m.tags || []).includes(tagFilter);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg tracking-tight">Memories</h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowAdd(!showAdd)}
            className="hover:bg-primary/10 hover:text-primary"
          >
            {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {/* Add Memory */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Textarea
                placeholder="What do you want to remember?"
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="mb-2 bg-secondary/50 border-border/30 resize-none"
                rows={3}
              />
              
              {/* Image preview */}
              {imagePreview && (
                <div className="relative mb-2 rounded-md overflow-hidden">
                  <img src={imagePreview} alt="Preview" className="w-full h-24 object-cover rounded-md" />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-1 right-1 h-6 w-6 bg-background/80"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              <div className="flex gap-1 mb-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs"
                >
                  <ImageIcon className="w-3 h-3 mr-1" />
                  Add Image
                </Button>
              </div>

              <Button
                onClick={handleAdd}
                disabled={saving || (!newContent.trim() && !selectedImage)}
                className="w-full glow-primary"
                size="sm"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                Save Memory
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search memories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-secondary/50 border-border/30"
          />
        </div>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {allTags.slice(0, 8).map((tag) => (
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
      </div>

      {/* Memory List */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          <AnimatePresence>
            {filtered.map((memory) => (
              <motion.div
                key={memory.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass rounded-lg p-3 group hover:border-primary/30 transition-colors"
              >
                {editingId === memory.id ? (
                  <div>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="mb-2 bg-secondary/50 border-border/30 resize-none text-sm"
                      rows={3}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEdit(memory.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Memory image */}
                    {memory.image_url && (
                      <img
                        src={memory.image_url}
                        alt="Memory"
                        className="w-full h-20 object-cover rounded-md mb-2"
                        loading="lazy"
                      />
                    )}

                    <p className="text-sm text-foreground line-clamp-2">
                      {memory.summary || memory.content}
                    </p>

                    {memory.importance && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Star className="w-3 h-3 text-primary" />
                        <span className="text-xs text-muted-foreground">{memory.importance}/10</span>
                      </div>
                    )}

                    {memory.tags && memory.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {memory.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {memory.ai_insight && (
                      <p className="text-xs text-accent mt-1.5 italic">💡 {memory.ai_insight}</p>
                    )}

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(memory.created_at).toLocaleDateString()}
                      </span>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingId(memory.id);
                            setEditContent(memory.content);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 hover:text-destructive"
                          onClick={() => handleDelete(memory)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No memories yet</p>
              <p className="text-xs">Add your first memory above</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
