-- ================================================================
-- CHUPA v2 — UPGRADE MIGRATION
-- Run this AFTER the original schema (supabase-schema.sql)
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE
-- ================================================================

-- ================================================================
-- 1. AVATAR STORAGE BUCKET
--    This creates a public bucket for user profile pictures.
--    Max 5MB, images only.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- 2. STORAGE RLS POLICIES
--    Users can only upload/update/delete in their own folder.
--    Anyone can view (public bucket).
-- ================================================================

-- Allow authenticated users to upload to their own folder
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can upload own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users can upload own avatar"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow authenticated users to update their own avatar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users can update own avatar"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow authenticated users to delete their own avatar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own avatar' AND tablename = 'objects') THEN
    CREATE POLICY "Users can delete own avatar"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars'
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END $$;

-- Allow anyone to view avatars (public bucket)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public avatar access' AND tablename = 'objects') THEN
    CREATE POLICY "Public avatar access"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
  END IF;
END $$;

-- ================================================================
-- 3. SEARCH USERS — improved to support partial matching
--    Now supports partial username match AND exact email match
-- ================================================================

CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT, p_current_user_id UUID)
RETURNS TABLE(id UUID, name TEXT, username TEXT, avatar_url TEXT, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.username, p.avatar_url, p.email
  FROM public.profiles p
  WHERE p.id != p_current_user_id
    AND (
      lower(p.username) LIKE '%' || lower(p_query) || '%'
      OR lower(p.email) = lower(p_query)
      OR lower(p.name) LIKE '%' || lower(p_query) || '%'
    )
  LIMIT 20;
END; $$;

-- ================================================================
-- 4. ADDITIONAL INDEXES for performance
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_name_lower ON public.profiles (lower(name));
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages (conversation_id, created_at DESC);

-- ================================================================
-- 5. SECURITY: Profiles read policy — allow searching other users
--    The original schema only lets users see their OWN profile.
--    We need them to see other profiles for search + chat headers.
-- ================================================================

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

-- ================================================================
-- 6. SECURITY: Content length constraint on messages
-- ================================================================

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages ADD CONSTRAINT messages_content_length CHECK (char_length(content) BETWEEN 1 AND 2000);

-- ================================================================
-- 7. SECURITY: Username constraints at DB level
-- ================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_name_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_name_length CHECK (char_length(name) BETWEEN 2 AND 50);

-- ================================================================
-- 8. UPDATE AVATAR — allow empty string to clear
-- ================================================================

CREATE OR REPLACE FUNCTION public.update_avatar(p_user_id UUID, p_new_url TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Allow empty/null to clear avatar, or valid http URL
  IF p_new_url IS NOT NULL AND p_new_url != '' AND left(p_new_url, 4) != 'http' THEN
    RETURN json_build_object('success', false, 'error', 'Avatar URL must start with http');
  END IF;
  UPDATE public.profiles SET avatar_url = NULLIF(p_new_url, '') WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;

-- ================================================================
-- 9. REALTIME — ensure messages table is published
-- ================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- ================================================================
-- 10. FORCE SCHEMA CACHE RELOAD
-- ================================================================

NOTIFY pgrst, 'reload schema';

-- ================================================================
-- DONE! After running this:
--
-- 1. Go to Supabase Dashboard > Authentication > URL Configuration
--    Set Site URL to: http://localhost:5173 (or your domain)
--    Add to Redirect URLs: http://localhost:5173/**
--
-- 2. To speed up magic link emails:
--    Go to Authentication > Email Templates > SMTP Settings
--    Set up a custom SMTP provider (Resend, SendGrid, etc.)
--    Free Supabase email is rate-limited and can be slow.
--
-- 3. Go to Supabase Dashboard > Storage
--    You should see the "avatars" bucket listed (created by this script).
--    If not, create it manually: Name="avatars", Public=true
--
-- ================================================================
