-- Roblox adaptation: deterministic native urban route, not a coordinate copy of Unity.
-- Pure Luau; no Roblox APIs, Unity, SDK, or external assets required.
local Generator={}
Generator.names={"뒷골목","외벽","옥상","마천루","공사장","성층권","블랙홀"}
Generator.body={{.239,.235,.259},{.404,.310,.286},{.549,.553,.545},{.353,.451,.510},{.686,.529,.239},{.353,.384,.447},{.427,.451,.510}}
Generator.sky={{.055,.063,.106},{.180,.196,.310},{.451,.541,.694},{.565,.702,.878},{.612,.741,.918},{.176,.263,.427},{.016,.020,.043}}
local function chord(p,x,z)
    return math.min(math.abs(x)>0.0001 and p.sx/2/math.abs(x) or math.huge,math.abs(z)>0.0001 and p.sz/2/math.abs(z) or math.huge)
end
function Generator.build(seed,hardness,solve)
    local random=seed%2147483647
    local function rng() random=random*48271%2147483647;return random/2147483647 end
    local result={seed=seed,hardness=hardness,platforms={},path={},links={},regions={},environment={},decor={}}
    local platforms=result.platforms
    platforms[1]={id="Start",x=0,y=0,z=-8,sx=1040,sz=1040,depth=4,region=1,kind="Solid",mover=0,grade=0,shape="Part",label="지면"}
    result.movers={}
    local heading=0
    local labels={{"컨테이너","실외기","차양","창틀"},{"배수관","비상계단","외벽 난간"},{"환기구","물탱크 받침","옥상 테라스"},{"유리 보행대","곤돌라","정비 발판"},{"철골 빔","비계","크레인 받침"},{"통신 잔해","안테나 받침","위성 판"},{"우주 잔해","관측판","블랙홀 접근대"}}
    for region=1,7 do
        local floor=platforms[#platforms].y
        result.regions[region]={name=Generator.names[region],y=floor}
        result.environment[region]={y=floor,sky=Generator.sky[region],fogStart=region==1 and 56 or 200,fogEnd=300+region*100,sunPower=region==1 and .32 or 1,gravity=region>=7 and .8 or region>=6 and .9 or 1,wind={0,0,0}}
        for step=1,28 do
            local previous=platforms[#platforms]
            local size=16+rng()*6
            local p={id=string.format("R%d_%02d",region,step),region=region,kind="Solid",shape="Part",sx=size,sz=16+rng()*6,depth=3+rng()*5,mover=0,grade=0,onPath=true,label=labels[region][(step-1)%#labels[region]+1]}
            if region==3 and step%9==5 then p.kind="Crumble";p.label="낡은 팔레트" end
            if (region==4 or region==7) and step%9==6 then p.kind="Mover";p.label=region==4 and "곤돌라" or "떠도는 잔해" end
            if region==5 and step%6==4 then p.kind="Ice";p.label="젖은 철골" end
            if region==6 and step%5==3 then p.kind="Ice";p.label="성에 낀 통신판" end
            if (region==2 or region==3 or region==5) and step%14==7 then p.kind="Wall";p.label="배수관 등반벽";p.depth=36 end
            if step%11==3 then p.sx=30;p.sz=12;p.label="긴 빔" end
            if step%13==2 then p.sx=26;p.sz=26;p.label="휴식 테라스" end
            local rise=8+rng()*4
            if previous.kind=="Crumble" then rise=5;end
            if p.kind=="Wall" then rise=24 end
            if #platforms==1 then rise=10.4;heading=0 end
            local dx,dz=math.sin(heading),math.cos(heading)
            local ac,bc=chord(previous,dx,dz),chord(p,dx,dz)
            local gap=hardness=="Hard" and 9 or 6
            if previous.kind=="Crumble" then gap=3 end
            local gs=result.environment[region].gravity
            local level,back,air=nil,nil,nil
            if p.kind=="Wall" then
                level=3;back=0;air=.35
            else
                for attempt=1,12 do
                    for l=1,previous.kind=="Crumble" and 3 or 5 do
                        local b,t=solve(l,rise,gap,bc*2,ac*2-2.4,gs,0)
                        local safe=b~=nil
                        for _,offset in {previous.kind=="Mover" and 1 or 0,p.kind=="Mover" and -1 or 0} do
                            if not solve(l,rise+offset,gap,bc*2,ac*2-2.4,gs,0) then safe=false end
                        end
                        if safe then level=l;back=b;air=t;break end
                    end
                    if level then break end
                    gap=math.max(1,gap*.8);rise=math.max(4,rise-.5)
                end
                assert(level,"native route link cannot be solved")
            end
            local distance=ac+gap+bc
            if #platforms==1 then p.x=0;p.z=13.6 else p.x=previous.x+dx*distance;p.z=previous.z+dz*distance end
            p.y=previous.y+rise
            if #platforms<=4 then p.depth=p.y end
            if p.kind=="Mover" then
                -- Vertical motion only: horizontal route remains legible. Test the highest endpoint.
                result.movers[#result.movers+1]={a={p.x,p.y-1,p.z},b={p.x,p.y,p.z},period=5+2*rng(),phase=rng()}
                p.mover=#result.movers
            end
            platforms[#platforms+1]=p;result.path[#result.path+1]=p.id
            if previous.id~="Start" then result.links[#result.links+1]={source=previous.id,target=p.id,level=level,back=back,air=air,gravityScale=gs,dir={dx,0,dz},gap=gap} end
            heading+=.105+rng()*.05
        end
    end
    result.summit=platforms[#platforms].y
    local function decor(x,y,z,sx,sy,sz,color,shape)
        table.insert(result.decor,{x=x,y=y,z=z,sx=sx,sy=sy,sz=sz,color=color,shape=shape or "Part"})
    end
    -- A real street entrance and grounded building masses frame the first decisions.
    for _,side in {-1,1} do
        decor(side*38,28,20,18,56,46,Generator.body[1])
        for row=1,4 do decor(side*28.8,row*10,12,0.4,4,5,{.95,.76,.29}) end
        decor(side*27,18,5,1,36,1,{.514,.318,.208},"TrussPart")
    end
    for i,p in platforms do
        if p.id=="Start" then continue end
        -- Device silhouettes stay outside the landing footprint and never mask collision.
        if p.kind=="Wall" then
            decor(p.x,p.y-p.depth/2,p.z-p.sz/2-.5,1.5,p.depth,1,{.62,.66,.72},"TrussPart")
        elseif p.kind=="Mover" then
            decor(p.x+p.sx/2+1,p.y+12,p.z,0.5,24,0.5,{.62,.66,.72})
        elseif p.kind=="Crumble" then
            for r=1,3 do decor(p.x+(r-2)*4,p.y-.2,p.z,0.25,.3,p.sz,{.851,.443,.192}) end
        elseif p.kind=="Ice" then
            decor(p.x,p.y+.02,p.z,p.sx*.7,.04,p.sz*.7,{1,1,1})
        elseif p.region==1 then
            for rib=1,3 do decor(p.x+(rib-2)*4,p.y-p.depth/2,p.z-p.sz/2-.1,.3,p.depth,.25,{.427,.416,.447}) end
        elseif p.region==2 then
            decor(p.x,p.y-1,p.z+p.sz/2+1,p.sx,2,2,{.514,.318,.208})
        elseif p.region==3 and i%3==0 then
            decor(p.x+p.sx/2+3,p.y+3,p.z,5,6,5,{.62,.66,.72})
        elseif p.region==4 and i%4==0 then
            decor(p.x+p.sx/2+18,p.y-20,p.z,12,70,26,{.396,.549,.639})
        elseif p.region==5 then
            decor(p.x,p.y-10,p.z,2,20,2,{.686,.529,.239},"TrussPart")
        elseif p.region==6 and i%3==0 then
            decor(p.x+p.sx/2+2,p.y+8,p.z,.5,16,.5,{.62,.66,.72})
        end
    end
    local last=platforms[#platforms]
    -- The black-hole goal is above the summit; collision remains on the actual landing platform.
    decor(last.x,last.y+65,last.z+45,70,70,70,{.008,.008,.016},"Ball")
    for i=1,20 do
        local angle=i*math.pi/10
        decor(last.x+math.cos(angle)*47,last.y+65+math.sin(angle)*47,last.z+45,9,9,2,{1,.667,.298})
    end
    return result
end
return Generator
