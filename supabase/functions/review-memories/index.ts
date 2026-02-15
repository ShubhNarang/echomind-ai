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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all user memories
    const { data: memories, error } = await supabase
      .from("memories")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !memories || memories.length === 0) {
      return new Response(JSON.stringify({ message: "No memories to review" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memorySummaries = memories.slice(0, 20).map((m: any, i: number) =>
      `[${i + 1}] ID: ${m.id} | Content: ${m.content.slice(0, 200)} | Importance: ${m.importance}/10 | Created: ${m.created_at}`
    ).join("\n");

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
            content: `You are a memory review AI. Analyze the user's memories and for each one, provide an updated importance score and a brief review insight. Focus on detecting outdated content, suggesting improvements, and identifying connections between memories. Return a JSON array of objects with fields: id (string), new_importance (integer 1-10), review_insight (string, 1 sentence).`,
          },
          { role: "user", content: `Review these memories:\n${memorySummaries}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "review_memories",
              description: "Review and score memories",
              parameters: {
                type: "object",
                properties: {
                  reviews: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        new_importance: { type: "integer", minimum: 1, maximum: 10 },
                        review_insight: { type: "string" },
                      },
                      required: ["id", "new_importance", "review_insight"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["reviews"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "review_memories" } },
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI review failed with status:", aiResponse.status);
      return new Response(JSON.stringify({ error: "AI review failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let reviews: any[] = [];
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      reviews = parsed.reviews || [];
    }

    // Update memories with review results
    for (const review of reviews) {
      await supabase
        .from("memories")
        .update({
          importance: Math.max(1, Math.min(10, review.new_importance)),
          ai_insight: review.review_insight,
        })
        .eq("id", review.id)
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ success: true, reviewed: reviews.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Review memories error occurred");
    return new Response(JSON.stringify({ error: "An error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
