
-- Make memory-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'memory-images';

-- Drop overly permissive SELECT policy
DROP POLICY IF EXISTS "Users can view memory images" ON storage.objects;

-- Create owner-scoped SELECT policy
CREATE POLICY "Users can view own memory images"
ON storage.objects FOR SELECT
USING (bucket_id = 'memory-images' AND auth.uid()::text = (storage.foldername(name))[1]);
