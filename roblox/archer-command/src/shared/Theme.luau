--!strict
-- 화면·연출 색. 원작 marine-command/DESIGN.md 의 의미 토큰을 RGB 로 옮겼다. 월드 재질 색은 빌더(tools/build.py)가 따로 가진다.
local Theme = {
	surface0 = Color3.fromRGB(22, 27, 38),
	surface1 = Color3.fromRGB(34, 40, 54),
	surface2 = Color3.fromRGB(46, 53, 70),
	textPrimary = Color3.fromRGB(244, 245, 248),
	textSecondary = Color3.fromRGB(190, 196, 208),
	primary = Color3.fromRGB(82, 160, 232),
	warning = Color3.fromRGB(236, 180, 60),
	friendly = Color3.fromRGB(104, 178, 226),
	enemy = Color3.fromRGB(226, 96, 68),
	healing = Color3.fromRGB(112, 206, 160),
	torch = Color3.fromRGB(255, 179, 73),
	arrow = Color3.fromRGB(255, 226, 170),
	plague = Color3.fromRGB(150, 220, 80),
	font = Enum.Font.GothamBold,
	fontBody = Enum.Font.Gotham,
	fontTitle = Enum.Font.GrenzeGotisch,
}
return Theme
