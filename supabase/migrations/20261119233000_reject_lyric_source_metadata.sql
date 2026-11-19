-- Fail closed on unmistakable scraped metadata when source lyrics are inserted or changed.
-- Existing rows and translation-only updates are not blocked or rewritten.
-- Less-certain title headers, names and poetic text remain an editorial review task.
BEGIN;

CREATE OR REPLACE FUNCTION public.reject_lyric_source_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  line_text text;
  clean text;
  idx int := 0;
  total int;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.lyrics_chinese IS NOT DISTINCT FROM OLD.lyrics_chinese THEN
    RETURN NEW;
  END IF;
  IF NEW.lyrics_chinese IS NULL OR btrim(NEW.lyrics_chinese) = '' THEN
    RETURN NEW;
  END IF;

  total := array_length(string_to_array(NEW.lyrics_chinese, E'\n'), 1);
  FOR line_text IN SELECT unnest(string_to_array(NEW.lyrics_chinese, E'\n')) LOOP
    idx := idx + 1;
    clean := btrim(line_text);
    IF clean = '' THEN CONTINUE; END IF;

    IF clean ~* '^[（(][[:space:]]*(music|instrumental|interlude|伴奏|间奏|間奏)[[:space:]]*[）)]$'
       OR clean ~ '^[\\]】}]+$'
       OR (idx >= total - 3 AND clean ~* '^[-[:space:]]*end[-[:space:]]*$')
       OR clean ~* '^KRC[[:space:]]*(制作|製作)'
       OR clean ~* '(https?://|www\\.|歌词来源|歌詞來源|歌词提供|歌詞提供)'
       OR (idx <= 12 AND clean ~ '(欢迎您|歡迎您)')
       OR (idx <= 18 AND clean ~* '^(作词|作詞|作曲|填词|填詞|编曲|編曲|录音师|錄音師|录音|錄音|混音|监制|監製|制作人|製作人|母带|母帶|歌词制作|歌詞製作|Lyrics by|Music by|Arranged by|Recorded by)[[:space:]:：∶/／-]+')
       OR (idx <= 16 AND length(clean) <= 48 AND clean ~* '^[^，。！？!?]{0,38}(录音工作室|錄音工作室|录音室|錄音室|recording studio)[^，。！？!?]{0,7}$')
    THEN
      RAISE EXCEPTION 'Rejected lyric-source metadata in song % on line %: %',
        COALESCE(NEW.id::text, 'new'), idx, left(clean, 90)
        USING ERRCODE='22023',
        HINT='Separate verified personnel/metadata into credits and retain only performed lyric lines.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS songs_metadata_guard ON public.songs;
CREATE TRIGGER songs_metadata_guard
BEFORE INSERT OR UPDATE OF lyrics_chinese ON public.songs
FOR EACH ROW EXECUTE FUNCTION public.reject_lyric_source_metadata();

REVOKE ALL ON FUNCTION public.reject_lyric_source_metadata() FROM PUBLIC, anon, authenticated;

COMMIT;
