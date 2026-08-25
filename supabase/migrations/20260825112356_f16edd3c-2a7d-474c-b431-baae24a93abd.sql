CREATE OR REPLACE FUNCTION public._repair_candidate_name_from_text(_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH lines AS (
    SELECT trim(regexp_replace(line, '\s+', ' ', 'g')) AS line, ord
    FROM regexp_split_to_table(coalesce(_text, ''), E'\n') WITH ORDINALITY AS t(line, ord)
    WHERE ord <= 30
  ), candidates AS (
    SELECT line, ord
    FROM lines
    WHERE length(line) BETWEEN 5 AND 50
      AND line !~* '(resume|curriculum|vitae|profile|confidential|contact|address|objective|summary|email|mail id|mobile|phone|dob|gender|religion|marital|languages|skills|experience|education|declaration)'
      AND line !~* '@|www\.|linkedin|\d{5,}'
      AND array_length(regexp_split_to_array(line, '\s+'), 1) BETWEEN 2 AND 4
      AND line ~ '^[A-Za-z][A-Za-z.''’\- ]+[A-Za-z]$'
  )
  SELECT initcap(line)
  FROM candidates
  ORDER BY ord
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public._repair_candidate_name_from_file(_file text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH tokens AS (
    SELECT lower(token) AS token, ord
    FROM regexp_split_to_table(
      regexp_replace(regexp_replace(coalesce(_file, ''), '\.[^.]+$', ''), '([a-z])([A-Z])', '\1 \2', 'g'),
      '[^A-Za-z]+'
    ) WITH ORDINALITY AS t(token, ord)
    WHERE length(token) BETWEEN 2 AND 20
      AND token !~* '^(resume|resum|cv|curriculum|vitae|profile|candidate|final|updated|latest|copy|new|naukri|linkedin|biodata|bio|data|retail|lretail|doc|docx|pdf|fashion|apparel|garment|garments|clothing|womenswear|menswear|designer|design|stylist|merchandiser|manager|developer|engineer|analyst|consultant|executive|associate|artist|makeup|sales|marketing|sourcing|category|planner|head)$'
  ), picked AS (
    SELECT token, ord
    FROM tokens
    ORDER BY ord
    LIMIT 4
  )
  SELECT CASE WHEN count(*) >= 2 THEN initcap(string_agg(token, ' ' ORDER BY ord)) ELSE NULL END
  FROM picked
$$;

WITH latest_message AS (
  SELECT DISTINCT ON (email_candidate_id)
    email_candidate_id,
    from_name,
    from_email
  FROM public.email_messages
  ORDER BY email_candidate_id, sent_at DESC NULLS LAST, created_at DESC
), latest_resume AS (
  SELECT DISTINCT ON (email_candidate_id)
    email_candidate_id,
    file_name,
    extracted_text
  FROM public.email_resume_versions
  ORDER BY email_candidate_id, received_at DESC NULLS LAST, created_at DESC
), repaired AS (
  SELECT
    c.id,
    coalesce(
      public._repair_candidate_name_from_text(r.extracted_text),
      public._repair_candidate_name_from_file(r.file_name),
      'Name not found'
    ) AS repaired_name
  FROM public.email_candidates c
  JOIN latest_message m ON m.email_candidate_id = c.id
  LEFT JOIN latest_resume r ON r.email_candidate_id = c.id
  WHERE lower(coalesce(c.name, '')) = lower(coalesce(m.from_name, ''))
    AND coalesce(lower(c.email), '') <> coalesce(lower(m.from_email), '')
)
UPDATE public.email_candidates c
SET
  name = repaired.repaired_name,
  search_blob = trim(regexp_replace(c.search_blob, '^\s*' || regexp_replace(c.name, '([\W])', '\\\1', 'g') || '\s*', '', 'i')),
  updated_at = now()
FROM repaired
WHERE c.id = repaired.id;

WITH latest_message AS (
  SELECT DISTINCT ON (email_candidate_id)
    email_candidate_id,
    from_name,
    from_email
  FROM public.email_messages
  ORDER BY email_candidate_id, sent_at DESC NULLS LAST, created_at DESC
), latest_resume AS (
  SELECT DISTINCT ON (email_candidate_id)
    email_candidate_id,
    file_name,
    extracted_text
  FROM public.email_resume_versions
  ORDER BY email_candidate_id, received_at DESC NULLS LAST, created_at DESC
), repaired AS (
  SELECT
    c.promoted_candidate_id AS candidate_id,
    coalesce(
      public._repair_candidate_name_from_text(r.extracted_text),
      public._repair_candidate_name_from_file(r.file_name),
      'Name not found'
    ) AS repaired_name
  FROM public.email_candidates c
  JOIN latest_message m ON m.email_candidate_id = c.id
  LEFT JOIN latest_resume r ON r.email_candidate_id = c.id
  WHERE c.promoted_candidate_id IS NOT NULL
    AND lower(coalesce(c.name, '')) = lower(coalesce(m.from_name, ''))
    AND coalesce(lower(c.email), '') <> coalesce(lower(m.from_email), '')
)
UPDATE public.candidates c
SET name = repaired.repaired_name,
    updated_at = now()
FROM repaired
WHERE c.id = repaired.candidate_id
  AND lower(coalesce(c.name, '')) <> lower(repaired.repaired_name);

DROP FUNCTION public._repair_candidate_name_from_text(text);
DROP FUNCTION public._repair_candidate_name_from_file(text);