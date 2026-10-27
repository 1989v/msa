-- 실행한 Grid.luau 가 보는 격자를 한 줄 한 셀로 찍는다: col row blocked elevation ramp
-- verify.py 가 이 출력을 rbxlx 파트와 대조한다 (RECTS 를 다시 파싱하지 않는다).
local Grid = require("../src/shared/Grid")
local t = Grid.create()
print(("GRID %d %d %d %d"):format(Grid.COLS, Grid.ROWS, Grid.CELL, Grid.ELEVATION_STUDS))
for row = 0, Grid.ROWS - 1 do
	for col = 0, Grid.COLS - 1 do
		local i = row * Grid.COLS + col + 1
		print(("%d %d %d %d %d"):format(col, row, t.blocked[i], t.elevation[i], t.ramps[i]))
	end
end
for id, p in Grid.SITES do print(("SITE %s %s %s"):format(id, tostring(p.x), tostring(p.z))) end
