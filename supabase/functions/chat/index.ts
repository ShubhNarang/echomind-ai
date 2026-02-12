import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the latest user message for semantic search
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";

    // Try to get embedding for semantic search
    let relevantMemories: any[] = [];
    try {
      const embResp = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-004",
          input: lastUserMessage,
        }),
      });

      if (embResp.ok) {
        const embData = await embResp.json();
        const queryEmbedding = embData.data?.[0]?.embedding;
        if (queryEmbedding) {
          const { data: matches } = await supabase.rpc("match_memories", {
            query_embedding: JSON.stringify(queryEmbedding),
            match_threshold: 0.3,
            match_count: 5,
            p_user_id: userId,
          });
          relevantMemories = matches || [];
        }
      }
    } catch (e) {
      console.error("Semantic search error:", e);
    }

    // If no semantic results, fall back to keyword search
    if (relevantMemories.length === 0) {
      const { data: keywordResults } = await supabase
        .from("memories")
        .select("id, content, summary, keywords, tags, importance, ai_insight")
        .eq("user_id", userId)
        .order("importance", { ascending: false })
        .limit(5);
      relevantMemories = keywordResults || [];
    }

    // Build context from memories
    const memoryContext = relevantMemories.length > 0
      ? `\n\nRelevant memories from the user's knowledge base:\n${relevantMemories
          .map((m: any, i: number) => `[Memory ${i + 1}] ${m.summary || m.content} (importance: ${m.importance}/10)`)
          .join("\n")}`
      : "\n\nThe user has no stored memories yet.";

    const systemPrompt = `You are RECALLION, an AI Memory Brain assistant. You help users by answering questions based on their stored memories and knowledge.

You have access to the user's memory base and should:
1. Ground your answers in the user's stored memories when relevant
2. Clearly indicate which memories you're referencing
3. Be honest when you don't have relevant memories to draw from
4. Provide thoughtful, insightful answers that connect different memories
5. Keep responses concise but comprehensive

${memoryContext}

When referencing memories, mention them naturally in your response. Be conversational and helpful.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
