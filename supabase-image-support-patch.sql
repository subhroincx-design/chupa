-- ================================================================
-- CHUPA — Image Support Patch
-- Run this in: Supabase Dashboard ? SQL Editor ? New Query ? Run All
--
-- Fixes:
--   1. Makes messages.content nullable (images don't need text)
--   2. Adds image_url column to messages table
--   3. Creates chat-media storage bucket with correct policies
--   4. Updates get_conversations_for_user RPC to show image previews
-- ================================================================


-- 1. Make content nullable and add image_url

ALTER TABLE public.messages
  ALTER COLUMN content DROP NOT NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_length;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_length
  CHECK (content IS NULL OR char_length(content) BETWEEN 1 AND 2000);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_content_or_image;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_content_or_image
  CHECK (content IS NOT NULL OR image_url IS NOT NULL);


-- 2. Create chat-media storage bucket

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;


-- 3. Storage policies for chat-media

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload chat media' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload chat media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'chat-media');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Public chat media read' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Public chat media read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'chat-media');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete chat media' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can delete chat media"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'chat-media');
  END IF;
END $$;


-- 4. Update get_conversations_for_user to include image_url

CREATE OR REPLACE FUNCTION public.get_conversations_for_user(p_uid UUID)
RETURNS TABLE(
  conversation_id         UUID,
  other_user_id           UUID,
  other_user_name         TEXT,
  other_user_username     TEXT,
  other_user_avatar       TEXT,
  last_message            TEXT,
  last_message_image      TEXT,
  last_message_at         TIMESTAMPTZ,
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
    m.image_url               AS last_message_image,
    m.created_at              AS last_message_at,
    c.created_at              AS conversation_created_at
  FROM public.conversations c
  INNER JOIN public.profiles p
    ON p.id = (
      CASE WHEN c.participant_1 = p_uid THEN c.participant_2
           ELSE c.participant_1 END
    )
  LEFT JOIN LATERAL (
    SELECT msg.content, msg.image_url, msg.created_at
    FROM   public.messages msg
    WHERE  msg.conversation_id = c.id
    ORDER BY msg.created_at DESC
    LIMIT 1
  ) m ON true
  WHERE c.participant_1 = p_uid OR c.participant_2 = p_uid
  ORDER BY COALESCE(m.created_at, c.created_at) DESC;
END; $$;


-- 5. Ensure realtime includes messages

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;


-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- DONE: Image support is now active in Chupa!
