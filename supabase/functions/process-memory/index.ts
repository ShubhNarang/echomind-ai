import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Verify the user
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { memoryId } = await req.json();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the memory and verify ownership
    const { data: memory, error: fetchError } = await supabase
      .from("memories")
      .select("*")
      .eq("id", memoryId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !memory) {
      return new Response(JSON.stringify({ error: "Memory not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call AI to process the memory
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `You are a memory processing AI. Analyze the given memory and return a JSON object with these fields:
- summary: A concise 1-2 sentence summary
- keywords: An array of 3-7 relevant keywords
- tags: An array of 2-5 category tags (e.g., "work", "personal", "idea", "learning", "goal")
- importance: A score from 1-10 (10 = critical life info, 1 = trivial)
- ai_insight: A brief insight or connection (1 sentence)

Return ONLY valid JSON, no markdown or explanation.`,
          },
          { role: "user", content: memory.content },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "process_memory",
              description: "Process and analyze a memory",
              parameters: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  keywords: { type: "array", items: { type: "string" } },
                  tags: { type: "array", items: { type: "string" } },
                  importance: { type: "integer", minimum: 1, maximum: 10 },
                  ai_insight: { type: "string" },
                },
                required: ["summary", "keywords", "tags", "importance", "ai_insight"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "process_memory" } },
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI processing failed with status:", aiResponse.status);
      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let processed;
    if (toolCall) {
      processed = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiData.choices?.[0]?.message?.content || "{}";
      processed = JSON.parse(content);
    }

    // Generate embedding
    const embeddingResponse = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-004",
        input: `${processed.summary || ""} ${memory.content}`,
      }),
    });

    let embedding = null;
    if (embeddingResponse.ok) {
      const embData = await embeddingResponse.json();
      embedding = embData.data?.[0]?.embedding || null;
    } else {
      console.error("Embedding generation failed");
    }

    // Update the memory
    const updateData: any = {
      summary: processed.summary,
      keywords: processed.keywords,
      tags: processed.tags,
      importance: Math.max(1, Math.min(10, processed.importance)),
      ai_insight: processed.ai_insight,
    };
    if (embedding) {
      updateData.embedding = JSON.stringify(embedding);
    }

    const { error: updateError } = await supabase
      .from("memories")
      .update(updateData)
      .eq("id", memoryId)
      .eq("user_id", userId);

    if (updateError) {
      console.error("Failed to update memory");
      return new Response(JSON.stringify({ error: "Failed to update memory" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-memory error occurred");
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
