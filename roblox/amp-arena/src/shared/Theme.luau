--!strict
-- 화면·연출 색. 레포 DESIGN.md 의 의미 토큰 계열(어두운 표면 + 앰프 노랑 강조). 월드 재질 색은 빌더(tools/build.py)가 따로 가진다.
local Theme = {
	surface0 = Color3.fromRGB(22, 27, 38),
	surface1 = Color3.fromRGB(34, 40, 54),
	surface2 = Color3.fromRGB(46, 53, 70),
	textPrimary = Color3.fromRGB(244, 245, 248),
	textSecondary = Color3.fromRGB(190, 196, 208),
	primary = Color3.fromRGB(82, 160, 232),
	accent = Color3.fromRGB(255, 214, 64),
	warning = Color3.fromRGB(236, 180, 60),
	danger = Color3.fromRGB(226, 86, 70),
	healing = Color3.fromRGB(112, 206, 160),
	guard = Color3.fromRGB(120, 200, 255),
	hit = Color3.fromRGB(255, 240, 200),
	launch = Color3.fromRGB(255, 150, 80),
	red = Color3.fromRGB(226, 86, 70),
	blue = Color3.fromRGB(82, 150, 232),
	font = Enum.Font.GothamBold,
	fontBody = Enum.Font.Gotham,
	fontTitle = Enum.Font.Bangers,
}
return Theme
