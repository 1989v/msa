-- Use the existing portal Play gesture/fullscreen policy; preserve BOTH orientation.
UPDATE game SET start_fullscreen = 1, updated_at = NOW(6) WHERE slug = 'zone-war';
