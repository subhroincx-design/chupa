-- ============================================
-- CHUPA - COMPLETE SUPABASE SETUP SCRIPT
-- Run this entire block in Supabase SQL Editor
-- ============================================

-- 1. DROP EXISTING TABLES IF RE-INITIALIZING (OPTIONAL SAFE CLEANUP)
-- DO NOT UNCOMMENT UNLESS RESETTING:
-- DROP TABLE IF EXISTS messages CASCADE;
-- DROP TABLE IF EXISTS conversations CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;

-- 2. CREATE TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  name_changed_at TIMESTAMPTZ,
  username_changed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON public.conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON public.conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. GRANT PERMISSIONS (Fixes PGRST205 & schema cache permissions)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 5. POLICIES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Users can view messages in own conversations" ON public.messages;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.participant_1 = auth.uid() OR conversations.participant_2 = auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can send messages as themselves" ON public.messages;
CREATE POLICY "Users can send messages as themselves" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());

-- 6. RPC FUNCTIONS
CREATE OR REPLACE FUNCTION public.update_name(p_user_id UUID, p_new_name TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_changed TIMESTAMPTZ;
BEGIN
  IF char_length(p_new_name) < 2 OR char_length(p_new_name) > 50 THEN
    RETURN json_build_object('success', false, 'error', 'Name must be 2-50 characters');
  END IF;
  SELECT name_changed_at INTO last_changed FROM public.profiles WHERE id = p_user_id;
  IF last_changed IS NOT NULL AND now() - last_changed < interval '12 hours' THEN
    RETURN json_build_object('success', false, 'error', 'You can only change your name once every 12 hours');
  END IF;
  UPDATE public.profiles SET name = p_new_name, name_changed_at = now() WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.update_username(p_user_id UUID, p_new_username TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE last_changed TIMESTAMPTZ; existing_id UUID;
BEGIN
  IF char_length(p_new_username) < 3 OR char_length(p_new_username) > 20 THEN
    RETURN json_build_object('success', false, 'error', 'Username must be 3-20 characters');
  END IF;
  IF p_new_username !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN json_build_object('success', false, 'error', 'Username can only contain letters, numbers, and underscores');
  END IF;
  SELECT id INTO existing_id FROM public.profiles WHERE lower(username) = lower(p_new_username) AND id != p_user_id;
  IF existing_id IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Username is already taken');
  END IF;
  SELECT username_changed_at INTO last_changed FROM public.profiles WHERE id = p_user_id;
  IF last_changed IS NOT NULL AND now() - last_changed < interval '7 days' THEN
    RETURN json_build_object('success', false, 'error', 'You can only change your username once every 7 days');
  END IF;
  UPDATE public.profiles SET username = p_new_username, username_changed_at = now() WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.update_avatar(p_user_id UUID, p_new_url TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_new_url IS NOT NULL AND p_new_url != '' AND left(p_new_url, 4) != 'http' THEN
    RETURN json_build_object('success', false, 'error', 'Avatar URL must start with http');
  END IF;
  UPDATE public.profiles SET avatar_url = NULLIF(p_new_url, '') WHERE id = p_user_id;
  RETURN json_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.search_users(p_query TEXT, p_current_user_id UUID)
RETURNS TABLE(id UUID, name TEXT, username TEXT, avatar_url TEXT, email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.username, p.avatar_url, p.email
  FROM public.profiles p
  WHERE p.id != p_current_user_id
    AND (lower(p.username) = lower(p_query) OR lower(p.email) = lower(p_query));
END; $$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(p_user_a UUID, p_user_b UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE conv_id UUID; p1 UUID; p2 UUID;
BEGIN
  IF p_user_a < p_user_b THEN p1 := p_user_a; p2 := p_user_b;
  ELSE p1 := p_user_b; p2 := p_user_a; END IF;
  SELECT c.id INTO conv_id FROM public.conversations c WHERE c.participant_1 = p1 AND c.participant_2 = p2;
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (participant_1, participant_2) VALUES (p1, p2) RETURNING conversations.id INTO conv_id;
  END IF;
  RETURN conv_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_conversations_for_user(p_uid UUID)
RETURNS TABLE(
  conversation_id UUID, other_user_id UUID, other_user_name TEXT,
  other_user_username TEXT, other_user_avatar TEXT, last_message TEXT,
  last_message_at TIMESTAMPTZ, conversation_created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS conversation_id,
    CASE WHEN c.participant_1 = p_uid THEN c.participant_2 ELSE c.participant_1 END AS other_user_id,
    p.name AS other_user_name, p.username AS other_user_username, p.avatar_url AS other_user_avatar,
    m.content AS last_message, m.created_at AS last_message_at, c.created_at AS conversation_created_at
  FROM public.conversations c
  INNER JOIN public.profiles p ON p.id = (CASE WHEN c.participant_1 = p_uid THEN c.participant_2 ELSE c.participant_1 END)
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.created_at FROM public.messages msg WHERE msg.conversation_id = c.id ORDER BY msg.created_at DESC LIMIT 1
  ) m ON true
  WHERE c.participant_1 = p_uid OR c.participant_2 = p_uid
  ORDER BY COALESCE(m.created_at, c.created_at) DESC;
END; $$;

-- 7. REALTIME PUBLICATION
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- 8. FORCE RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
