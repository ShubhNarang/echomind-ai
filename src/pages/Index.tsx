import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { MemorySidebar } from "@/components/MemorySidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, LogOut, Brain } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const Index = () => {
  const { user, loading, signOut } = useAuth();
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

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
      <header className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setLeftOpen(!leftOpen)} className="h-8 w-8">
            {leftOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm tracking-tight hidden sm:inline">RECALLION</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setRightOpen(!rightOpen)} className="h-8 w-8">
            {rightOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={signOut} className="h-8 w-8" title="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Three panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {leftOpen && (
          <aside className="w-72 shrink-0 overflow-hidden hidden md:block">
            <MemorySidebar />
          </aside>
        )}
        <main className="flex-1 overflow-hidden">
          <ChatPanel />
        </main>
        {rightOpen && (
          <aside className="w-72 shrink-0 overflow-hidden hidden lg:block">
            <InsightsPanel />
          </aside>
        )}
      </div>
    </div>
  );
};

export default Index;
