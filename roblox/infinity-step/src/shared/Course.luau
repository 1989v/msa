-- Roblox-native interpretation. Original export remains optional design reference only.
local Generator,Jump
if script then
    Generator=require(script.Parent.Generator);Jump=require(script.Parent.Jump)
else
    Generator=require("./Generator");Jump=require("./Jump")
end
local Course=Generator.build(20261028,"Normal",Jump.solve)
Course.version=2;Course.scale=4
Course.palette={body=Generator.body,asphalt={.129,.137,.161}}
local byId={}
for _,p in Course.platforms do byId[p.id]=p end
local legacyNames={"Start","Crate","Awning","Exterior","Vent","Balcony","Roof","Tank","Finish"}
Course.legacy={}
for i,id in legacyNames do Course.legacy[id]={id=id,x=(i-1)*12,y=(i-1)*6,z=0,sx=12,sz=12,depth=4,region=math.min(3,math.floor((i-1)/3)+1)} end
function Course.platform(id) return byId[id] end
function Course.resolve(target)
    if target.courseVersion==Course.version then return byId[target.platformId] end
    if target.courseVersion==1 then return Course.legacy[target.platformId] end
    return nil
end
function Course.resume(alt)
    local found=byId.Start
    for _,id in Course.path do local p=byId[id];if p.y>alt then break end;found=p end
    return found
end
function Course.look(y)
    local keys=Course.environment
    local index=1
    for i=1,#keys do if y>=keys[i].y then index=i end end
    local a,b=keys[index],keys[math.min(index+1,#keys)]
    local t=b.y>a.y and math.clamp((y-a.y)/(b.y-a.y),0,1) or 0
    local function blend(x,z) return x+(z-x)*t end
    return {sky={blend(a.sky[1],b.sky[1]),blend(a.sky[2],b.sky[2]),blend(a.sky[3],b.sky[3])},
        fogStart=blend(a.fogStart,b.fogStart),fogEnd=blend(a.fogEnd,b.fogEnd),sunPower=blend(a.sunPower,b.sunPower),
        gravity=a.gravity,wind={0,0,0}}
end
return Course
