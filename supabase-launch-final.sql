-- ================================================================
--  ██████╗██╗  ██╗██╗   ██╗██████╗  █████╗
-- ██╔════╝██║  ██║██║   ██║██╔══██╗██╔══██╗
-- ██║     ███████║██║   ██║██████╔╝███████║
-- ██║     ██╔══██║██║   ██║██╔═══╝ ██╔══██║
-- ╚██████╗██║  ██║╚██████╔╝██║     ██║  ██║
--  ╚═════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝  ╚═╝
--
--  FINAL LAUNCH SQL — Single-file, idempotent, safe to re-run.
--  Run in: Supabase Dashboard → SQL Editor → New Query → Run All
--
--  Covers: Tables · Indexes · RLS · Policies · Storage · RPCs
--          Realtime · Security Constraints · Schema Reload
-- ================================================================


-- ================================================================
-- SECTION 1 — CORE TABLES
-- ================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT        UNIQUE NOT NULL,
  name                 TEXT        NOT NULL,
  username             TEXT        UNIQUE NOT NULL,
  avatar_url           TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  name_changed_at      TIMESTAMPTZ,
  username_changed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);


-- ================================================================
-- SECTION 2 — DB-LEVEL SECURITY CONSTRAINTS
-- ================================================================

-- Messages: 1–2000 chars
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (char_length(content) BETWEEN 1 AND 2000);

-- Username: 3–20 alphanumeric+underscore only
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');

-- Display name: 2–50 chars
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_name_length;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_name_length
  CHECK (char_length(name) BETWEEN 2 AND 50);


-- ================================================================
-- SECTION 3 — PERFORMANCE INDEXES
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_username         ON public.profiles (username);
CREATE INDEX IF NOT EXISTS idx_profiles_email            ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower   ON public.profiles (lower(username));
CREATE INDEX IF NOT EXISTS idx_profiles_name_lower       ON public.profiles (lower(name));

CREATE INDEX IF NOT EXISTS idx_conversations_p1          ON public.conversations (participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_p2          ON public.conversations (participant_2);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id          ON public.messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at       ON public.messages (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created     ON public.messages (conversation_id, created_at DESC);


-- ================================================================
-- SECTION 4 — GRANT SCHEMA PERMISSIONS
-- ================================================================

GRANT USAGE  ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL    ON ALL ROUTINES  IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES   TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;


-- ================================================================
-- SECTION 5 — ROW LEVEL SECURITY (RLS)
-- ================================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;


-- ── Profiles ──────────────────────────────────────────────────
-- Any logged-in user can read any profile (needed for search + chat headers)
DROP POLICY IF EXISTS "Users can view own profile"              ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can only insert their own profile row
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile row
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ── Conversations ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);


-- ── Messages ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.messages;
CREATE POLICY "Users can send messages as themselves"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());


-- ================================================================
-- SECTION 6 — AVATAR STORAGE BUCKET
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Upload: users can only write inside their own UUID folder
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can upload own avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can upload own avatar"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Update: same folder restriction
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can update own avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can update own avatar"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Delete: same folder restriction
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete own avatar' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Users can delete own avatar"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'avatars'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- Public read: anyone can view avatars (public bucket)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public avatar read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public avatar read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'avatars');
  END IF;
END $$;


-- ================================================================
-- SECTION 7 — RPC FUNCTIONS
-- ================================================================

-- ── update_name ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_name(p_user_id UUID, p_new_name TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_changed TIMESTAMPTZ;
BEGIN
  p_new_name := trim(p_new_name);
  IF char_length(p_new_name) < 2 OR char_length(p_new_name) > 50 THEN
    RETURN json_build_object('success', false, 'error', 'Name must be 2–50 characters');
  END IF;
  SELECT name_changed_at INTO last_changed FROM public.profiles WHERE id = p_user_id;
  IF last_changed IS NOT NULL AND now() - last_changed < interval '12 hours' THEN
    RETURN json_build_object('success', false, 'error', 'You can only change your name once every 12 hours');
  END IF;
  UPDATE public.profiles SET name = p_new_name, name_changed_at = now() WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;


-- ── update_username ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_username(p_user_id UUID, p_new_username TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_changed TIMESTAMPTZ; existing_id UUID;
BEGIN
  p_new_username := trim(p_new_username);
  IF char_length(p_new_username) < 3 OR char_length(p_new_username) > 20 THEN
    RETURN json_build_object('success', false, 'error', 'Username must be 3–20 characters');
  END IF;
  IF p_new_username !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Letters, numbers, and underscores only');
  END IF;
  SELECT id INTO existing_id
    FROM public.profiles
    WHERE lower(username) = lower(p_new_username) AND id != p_user_id;
  IF existing_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Username is already taken');
  END IF;
  SELECT username_changed_at INTO last_changed FROM public.profiles WHERE id = p_user_id;
  IF last_changed IS NOT NULL AND now() - last_changed < interval '7 days' THEN
    RETURN json_build_object('success', false, 'error', 'You can only change your username once every 7 days');
  END IF;
  UPDATE public.profiles
    SET username = p_new_username, username_changed_at = now()
    WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;


-- ── update_avatar ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_avatar(p_user_id UUID, p_new_url TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_new_url IS NOT NULL AND p_new_url != '' AND left(p_new_url, 4) != 'http' THEN
    RETURN json_build_object('success', false, 'error', 'Avatar URL must start with http');
  END IF;
  UPDATE public.profiles SET avatar_url = NULLIF(p_new_url, '') WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;


-- ── search_users ─────────────────────────────────────────────
-- Supports partial username, partial name, or exact email search
CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT, p_current_user_id UUID)
RETURNS TABLE(id UUID, name TEXT, username TEXT, avatar_url TEXT, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  p_query := lower(trim(p_query));
  RETURN QUERY
  SELECT p.id, p.name, p.username, p.avatar_url, p.email
  FROM public.profiles p
  WHERE p.id != p_current_user_id
    AND (
      lower(p.username) LIKE '%' || p_query || '%'
      OR lower(p.name)  LIKE '%' || p_query || '%'
      OR lower(p.email) = p_query
    )
  ORDER BY
    -- Exact username match first
    CASE WHEN lower(p.username) = p_query THEN 0 ELSE 1 END,
    p.username
  LIMIT 20;
END; $$;


-- ── get_or_create_conversation ────────────────────────────────
-- Always stores participant_1 < participant_2 (prevents duplicates)
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_a UUID, p_user_b UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id UUID; p1 UUID; p2 UUID;
BEGIN
  IF p_user_a < p_user_b THEN p1 := p_user_a; p2 := p_user_b;
  ELSE                        p1 := p_user_b; p2 := p_user_a;
  END IF;

  SELECT c.id INTO conv_id
    FROM public.conversations c
    WHERE c.participant_1 = p1 AND c.participant_2 = p2;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2)
    VALUES (p1, p2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END; $$;


-- ── get_conversations_for_user ────────────────────────────────
-- Returns all conversations for a user, sorted by most-recent message
CREATE OR REPLACE FUNCTION public.get_conversations_for_user(p_uid UUID)
RETURNS TABLE(
  conversation_id       UUID,
  other_user_id         UUID,
  other_user_name       TEXT,
  other_user_username   TEXT,
  other_user_avatar     TEXT,
  last_message          TEXT,
  last_message_at       TIMESTAMPTZ,
  conversation_created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id                      AS conversation_id,
    CASE WHEN c.participant_1 = p_uid THEN c.participant_2
         ELSE c.participant_1 END  AS other_user_id,
    p.name                    AS other_user_name,
    p.username                AS other_user_username,
    p.avatar_url              AS other_user_avatar,
    m.content                 AS last_message,
    m.created_at              AS last_message_at,
    c.created_at              AS conversation_created_at
  FROM public.conversations c
  INNER JOIN public.profiles p
    ON p.id = (
      CASE WHEN c.participant_1 = p_uid THEN c.participant_2
           ELSE c.participant_1 END
    )
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.created_at
    FROM   public.messages msg
    WHERE  msg.conversation_id = c.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.participant_1 = p_uid OR c.participant_2 = p_uid
  ORDER BY COALESCE(m.created_at, c.created_at) DESC;
END; $$;


-- ================================================================
-- SECTION 8 — REALTIME (live message delivery)
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
-- SECTION 9 — RELOAD POSTGREST SCHEMA CACHE
-- ================================================================

NOTIFY pgrst, 'reload schema';


-- ================================================================
-- ✅ ALL DONE — Chupa is ready for launch!
--
-- After running this SQL, verify in Supabase Dashboard:
--
--  Authentication → URL Configuration
--    Site URL:     http://localhost:5173
--    Redirect URL: http://localhost:5173/**
--
--  Authentication → Email Templates → Magic Link
--    Subject: Sign in to Chupa 💬
--    Body:    (paste the HTML from supabase-email-template.md)
--
--  Storage → Buckets
--    "avatars" bucket should appear as Public
--
-- ================================================================
