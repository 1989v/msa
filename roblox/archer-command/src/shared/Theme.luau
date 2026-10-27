-- marine-command/DESIGN.md 의 토큰을 RGB 로 옮겼다. 빌더(build_place.py)가 정규식으로 읽으므로 한 줄 한 토큰, 숫자 리터럴만.
-- UI: surface_0 oklch(0.17 .025 252) · surface_1 · surface_2 · text_primary · text_secondary · primary · warning
-- 지형: dust hsl(38 14% 23%) · stone hsl(32 11% 29%) · infestation hsl(14 22% 18%) · friendly hsl(203 67% 65%) · enemy hsl(12 68% 59%) · healing hsl(162 45% 62%)
return {
	surface0={12,20,36}, surface1={26,34,56}, surface2={34,43,68},
	textPrimary={242,243,247}, textSecondary={189,193,201}, primary={14,165,233}, warning={233,170,70},
	dust={67,61,50}, stone={82,74,66}, infestation={56,41,36}, friendly={106,180,226}, enemy={222,108,79}, healing={115,202,175},
	grass={46,58,34}, cliff={74,70,66}, wood={110,78,46}, torch={255,170,70}, moon={120,140,190},
	textSize=16, hudSize=14, titleSize=24, touch=48, gap=8, radius=6,
}
