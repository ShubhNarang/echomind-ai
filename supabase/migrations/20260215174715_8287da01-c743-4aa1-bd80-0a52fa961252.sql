
-- Add image_url column to memories
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for memory images
INSERT INTO storage.buckets (id, name, public) VALUES ('memory-images', 'memory-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for memory images
CREATE POLICY "Users can upload memory images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'memory-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view memory images"
ON storage.objects FOR SELECT
USING (bucket_id = 'memory-images');

CREATE POLICY "Users can delete own memory images"
ON storage.objects FOR DELETE
USING (bucket_id = 'memory-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add missing UPDATE and DELETE policies for chat_messages
CREATE POLICY "Users can update own messages"
ON public.chat_messages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
ON public.chat_messages FOR DELETE
USING (auth.uid() = user_id);

-- Fix match_memories function: use SECURITY INVOKER and auth.uid()
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(768),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  summary TEXT,
  keywords TEXT[],
  tags TEXT[],
  importance INT,
  ai_insight TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.content,
    m.summary,
    m.keywords,
    m.tags,
    m.importance,
    m.ai_insight,
    (1 - (m.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.memories m
  WHERE m.user_id = COALESCE(p_user_id, auth.uid())
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
