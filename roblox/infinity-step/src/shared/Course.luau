-- All coordinates are studs. Runtime and place builder read the same authored data.
local Course = { version=1 }
Course.regions = {
    { name = "01 / ALLEY", x = 0, y = 0, z = 0 },
    { name = "02 / EXTERIOR", x = 36, y = 18, z = 0 },
    { name = "03 / ROOF", x = 72, y = 36, z = 0 },
}
Course.platforms = {
    { id="Start", x=0, y=0, z=0, sx=18, sz=16, region=1 },
    { id="Crate", x=12, y=6, z=0, sx=12, sz=12, region=1 },
    { id="Awning", x=24, y=12, z=0, sx=12, sz=12, region=1 },
    { id="Exterior", x=36, y=18, z=0, sx=12, sz=14, region=2 },
    { id="Vent", x=48, y=24, z=0, sx=12, sz=12, region=2 },
    { id="Balcony", x=60, y=30, z=0, sx=12, sz=12, region=2 },
    { id="Roof", x=72, y=36, z=0, sx=12, sz=14, region=3 },
    { id="Tank", x=84, y=42, z=0, sx=12, sz=12, region=3 },
    { id="Finish", x=96, y=48, z=0, sx=12, sz=16, region=3 },
}
function Course.platform(id)
    for _, p in Course.platforms do if p.id == id then return p end end
    return nil
end
return Course
