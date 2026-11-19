-- Song-wide comment threads. Existing rows remain roots (parent_id NULL).
-- Replies survive deletion of a parent by becoming root-level comments.
-- The row-level trigger prevents children being attached to a different song.
BEGIN;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS comments_song_parent_created_idx
  ON public.comments(song_id, parent_id, created_at, id);

CREATE OR REPLACE FUNCTION public.validate_song_comment_parent()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent_song bigint;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.song_id IS DISTINCT FROM OLD.song_id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A song comment cannot be moved to another song or author.' USING ERRCODE='22023';
    END IF;
    -- FK-triggered SET NULL on deletion is permitted, but retargeting isn't.
    IF NEW.parent_id IS DISTINCT FROM OLD.parent_id AND NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'A reply cannot be moved to another comment.' USING ERRCODE='22023';
    END IF;
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'A comment cannot reply to itself.' USING ERRCODE='22023';
    END IF;
    SELECT c.song_id INTO parent_song FROM public.comments c WHERE c.id=NEW.parent_id;
    IF NOT FOUND OR parent_song IS DISTINCT FROM NEW.song_id THEN
      RAISE EXCEPTION 'The parent comment belongs to another song or does not exist.' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS comments_parent_guard ON public.comments;
CREATE TRIGGER comments_parent_guard
  BEFORE INSERT OR UPDATE OF song_id, user_id, parent_id ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_song_comment_parent();

REVOKE ALL ON FUNCTION public.validate_song_comment_parent() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
