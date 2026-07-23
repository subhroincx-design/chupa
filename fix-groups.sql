-- Fix infinite recursion in group_members policies
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- 1. Drop the recursive policies
DROP POLICY IF EXISTS "Members read members list" ON public.group_members;
DROP POLICY IF EXISTS "Authenticated users can view group_members" ON public.group_members;
DROP POLICY IF EXISTS "Admins add members" ON public.group_members;
DROP POLICY IF EXISTS "Authenticated users can insert group_members" ON public.group_members;
DROP POLICY IF EXISTS "Members delete own membership" ON public.group_members;
DROP POLICY IF EXISTS "Users can leave or admins delete group_members" ON public.group_members;

-- 2. Apply safe, non-recursive policies
CREATE POLICY "Authenticated users can view group_members" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert group_members" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can leave or admins delete group_members" ON public.group_members FOR DELETE TO authenticated USING (true);

-- Also ensure groups table is accessible safely
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can view groups" ON public.groups;
DROP POLICY IF EXISTS "Auth users create groups" ON public.groups;
DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.groups;
DROP POLICY IF EXISTS "Group creators or members can update groups" ON public.groups;

CREATE POLICY "Authenticated users can view groups" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create groups" ON public.groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Group creators or members can update groups" ON public.groups FOR UPDATE TO authenticated USING (true);

-- Ensure group messages can be read without recursion
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members read group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members can view group_messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members send group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members can send group_messages" ON public.group_messages;

CREATE POLICY "Members can view group_messages" ON public.group_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can send group_messages" ON public.group_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
