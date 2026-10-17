-- 캔버스가 840×480 가로형인데 카탈로그는 PORTRAIT 였다. 데스크톱 무대가 세로 높이로 떴다가 가로 비율로 줄었다.
UPDATE game
SET orientation = 'LANDSCAPE'
WHERE slug = 'cliff-climber';
