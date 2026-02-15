import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { Activity, Star, Clock, AlertTriangle, Lightbulb, RefreshCw, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Memory = Tables<"memories">;

export function InsightsPanel() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("memories")
      .select("*")
      .eq("user_id", user.id)
      .order("importance", { ascending: false })
      .then(({ data }) => setMemories(data || []));
  }, [user]);

  const avgImportance = memories.length
    ? (memories.reduce((s, m) => s + (m.importance || 5), 0) / memories.length).toFixed(1)
    : "0";

  const topMemories = memories.filter((m) => (m.importance || 0) >= 7).slice(0, 5);
  const recentMemories = [...memories]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5);

  const healthScore = Math.min(
    100,
    Math.round(
      (memories.length > 0 ? 20 : 0) +
        (memories.length > 5 ? 20 : memories.length * 4) +
        (Number(avgImportance) > 5 ? 30 : Number(avgImportance) * 6) +
        (memories.filter((m) => m.summary).length / Math.max(memories.length, 1)) * 30
    )
  );

  const handleReview = async () => {
    if (!user) return;
    setReviewing(true);
    try {
      await supabase.functions.invoke("review-memories");
      // Refresh memories after review
      const { data } = await supabase
        .from("memories")
        .select("*")
        .eq("user_id", user.id)
        .order("importance", { ascending: false });
      setMemories(data || []);
    } catch {}
    setReviewing(false);
  };

  return (
    <div className="h-full flex flex-col bg-sidebar border-l border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          <h2 className="font-semibold text-lg tracking-tight">Insights</h2>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Health Score */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-accent" /> Memory Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-primary">{healthScore}</div>
                  <div className="flex-1">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${healthScore}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {memories.length} memories · avg {avgImportance}/10
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Memories */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-primary" /> Top Memories
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topMemories.length === 0 && (
                  <p className="text-xs text-muted-foreground">No high-importance memories yet</p>
                )}
                {topMemories.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <Badge variant="secondary" className="text-[10px] px-1.5 shrink-0">
                      {m.importance}/10
                    </Badge>
                    <p className="text-xs text-foreground line-clamp-1">{m.summary || m.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="glass border-border/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Recent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentMemories.map((m) => (
                  <div key={m.id} className="flex items-start gap-2">
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(m.updated_at).toLocaleDateString()}
                    </span>
                    <p className="text-xs text-foreground line-clamp-1">{m.summary || m.content}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Review */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Button
              onClick={handleReview}
              disabled={reviewing || memories.length === 0}
              className="w-full glow-accent bg-accent hover:bg-accent/90"
            >
              {reviewing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Review Memories with AI
            </Button>
          </motion.div>
        </div>
      </ScrollArea>
    </div>
  );
}
