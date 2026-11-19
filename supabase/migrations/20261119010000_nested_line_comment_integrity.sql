-- Keep line-comment discussions correctly anchored when replies nest
-- beneath other replies, including replies about a particular translation.
BEGIN;

ALTER TABLE public.line_comments
  DROP CONSTRAINT IF EXISTS line_comments_parent_id_fkey;

ALTER TABLE public.line_comments
  ADD CONSTRAINT line_comments_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.line_comments(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.guard_contribution_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  lyrics text;
  expected text;
  linked_song bigint;
  linked_index integer;
  linked_text text;
  linked_translation uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF pg_trigger_depth() > 1 AND current_setting('cnlyrics.reanchor', true) = 'on' THEN
      RETURN NEW;
    END IF;
    IF (NEW.song_id, NEW.line_index, NEW.original_line)
       IS DISTINCT FROM (OLD.song_id, OLD.line_index, OLD.original_line) THEN
      RAISE EXCEPTION 'A contribution cannot be moved to another lyric.' USING ERRCODE = '22023';
    END IF;
    IF TG_TABLE_NAME = 'line_comments' THEN
      -- Foreign key deletion is permitted to orphan a reply, not retarget it.
      IF (NEW.parent_id IS DISTINCT FROM OLD.parent_id
          AND (NEW.parent_id IS NOT NULL OR pg_trigger_depth() = 1))
          OR (NEW.translation_id IS DISTINCT FROM OLD.translation_id
          AND (NEW.translation_id IS NOT NULL OR pg_trigger_depth() = 1)) THEN
        RAISE EXCEPTION 'A reply cannot be moved to another thread.' USING ERRCODE = '22023';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  SELECT lyrics_chinese INTO lyrics FROM public.songs WHERE id = NEW.song_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Song not found.' USING ERRCODE = '22023';
  END IF;
  expected := (string_to_array(coalesce(lyrics, ''), E'\n'))[NEW.line_index + 1];
  IF NEW.line_index IS NULL OR NEW.line_index < 0 OR expected IS NULL
     OR NEW.original_line IS NULL OR NEW.original_line IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'Lyrics changed or this page is outdated. Refresh before contributing; keep your draft.'
      USING ERRCODE = '22023';
  END IF;

  IF TG_TABLE_NAME = 'line_comments' THEN
    IF NEW.parent_id IS NOT NULL THEN
      IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'A comment cannot reply to itself.' USING ERRCODE = '22023';
      END IF;
      SELECT song_id, line_index, original_line, translation_id
        INTO linked_song, linked_index, linked_text, linked_translation
        FROM public.line_comments WHERE id = NEW.parent_id;
      IF NOT FOUND OR (linked_song, linked_index, linked_text, linked_translation)
         IS DISTINCT FROM (NEW.song_id, NEW.line_index, NEW.original_line, NEW.translation_id) THEN
        RAISE EXCEPTION 'This reply belongs to another lyric or translation thread.' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF NEW.translation_id IS NOT NULL THEN
      SELECT song_id, line_index, original_line INTO linked_song, linked_index, linked_text
        FROM public.line_translations WHERE id = NEW.translation_id;
      IF NOT FOUND OR (linked_song, linked_index, linked_text)
         IS DISTINCT FROM (NEW.song_id, NEW.line_index, NEW.original_line) THEN
        RAISE EXCEPTION 'This translation belongs to an earlier or different lyric.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_contribution_anchor() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
