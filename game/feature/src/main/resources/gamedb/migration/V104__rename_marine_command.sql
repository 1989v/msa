-- Rename only the public display title; slug, status, content and saves remain unchanged.
UPDATE game
SET title = '궁수 키우기', title_en = '궁수 키우기'
WHERE slug = 'marine-command';
