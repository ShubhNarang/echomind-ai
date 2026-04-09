import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MemorySidebar } from "@/components/MemorySidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  LogOut, Brain, MessageSquare, Activity, BookOpen
} from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<string>("chat");

  if (loading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-10 h-10 text-primary animate-pulse" />
          <Skeleton className="w-48 h-4" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="dark h-screen flex flex-col bg-background overflow-hidden">
      {/* Top bar */}
      <header className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => setLeftOpen(!leftOpen)} className="h-8 w-8 hidden md:flex">
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <motion.div
            className="flex items-center gap-2.5 cursor-pointer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
              <Brain className="w-4.5 h-4.5 text-primary" />
            </div>
            <span className="font-bold text-base tracking-tight hidden sm:inline" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              RECALLION
            </span>
          </motion.div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/memories")}
            className="gap-1.5 text-xs h-8 hidden sm:flex"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Memory Manager
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setRightOpen(!rightOpen)} className="h-8 w-8 hidden lg:flex">
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
          <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block" />
          <Button size="icon" variant="ghost" onClick={signOut} className="h-8 w-8" title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Desktop: Three panel layout */}
      <div className="flex-1 overflow-hidden hidden md:flex">
        {leftOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden border-r border-border/30"
          >
            <MemorySidebar />
          </motion.aside>
        )}
        <main className="flex-1 overflow-hidden relative">
          <ChatPanel />
        </main>
        {rightOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 288, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 overflow-hidden border-l border-border/30"
          >
            <InsightsPanel />
          </motion.aside>
        )}
      </div>

      {/* Mobile: Tabbed layout */}
      <div className="flex-1 overflow-hidden md:hidden">
        <Tabs value={mobileTab} onValueChange={setMobileTab} className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2 mb-0 grid grid-cols-3 bg-secondary/50">
            <TabsTrigger value="memories" className="gap-1 text-xs">
              <Brain className="w-3.5 h-3.5" />
              Memories
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 text-xs">
              <MessageSquare className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-1 text-xs">
              <Activity className="w-3.5 h-3.5" />
              Insights
            </TabsTrigger>
          </TabsList>
          <TabsContent value="memories" className="flex-1 overflow-hidden m-0">
            <MemorySidebar />
          </TabsContent>
          <TabsContent value="chat" className="flex-1 overflow-hidden m-0">
            <ChatPanel />
          </TabsContent>
          <TabsContent value="insights" className="flex-1 overflow-hidden m-0">
            <InsightsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
