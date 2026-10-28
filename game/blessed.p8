pico-8 cartridge // http://www.pico-8.com
version 41
__lua__
-- blessed! a priest survivors game
-- arrows walk. you bless anyone
-- near you on your own.
-- z (the o button): town map.
-- level up / gift box: arrows
-- choose, x or z take it.

-- sprite slots: game/sprites.json
-- says which drawing goes where.
-- a slot with no drawing yet shows
-- as a dot or a plain shape.
s_priest=0 s_priest_walk=6
s_priest_bless=8 -- 4 frames
s_bishop=2 s_bishop_walk=12
s_bishop_bless=56 -- 4 frames
s_deacon=4 s_deacon_walk=14
-- people walking; the same people
-- standing are 56 slots later
s_people={16,18,20,22,24,26}
stand=56
s_grace=32 s_chest=33
s_rosary=34 s_bucket=35
s_coffee=36 s_car=37
s_decor={40,41,42,43,44,45}
-- 16x16 buildings
s_house=48 s_church=50 s_hosp=52
s_chapel=54

world=512   -- town size in pixels
            -- (it wraps around)
day_len=300 -- seconds in a day
miss_cost=5 -- seconds lost for
            -- each person missed
church_x,church_y=248,232
hosp_x,hosp_y=380,120
chapel_x,chapel_y=356,120 -- beside the hospital

-- @parts (npm run pico8 writes this from game/sprites.json)
parts={
 people={[1]="clothes",[3]="clothes",[4]="skin",[5]="hair",[7]="clothes",[9]="clothes",[10]="clothes",[12]="clothes",[13]="clothes",[14]="clothes",[15]="eyes"},
 priest={[3]="eyes",[15]="skin"},
 deacon={[4]="eyes",[7]="vestment",[15]="skin"},
}
tops={[16]=12,[18]=14,[20]=10,[22]=14,[24]=12,[26]=9}
-- @end

-- random looks for the people:
-- each part's color is swapped
-- for one of these colors
looks={
 hair={1,2,4,5,6,7,9,10},
 shirt={1,2,3,8,9,11,12,13,14},
 pants={1,2,3,5,12,13},
 shoes={1,2,4,5},
 clothes={1,2,3,8,9,11,12,13,14},
}
skins={{4,15},{15,1},{9,1},{4,1}} -- skin, eyes

-- sounds (sfx editor): 0 bless,
-- 1 pick up, 2 level up, 3 gift
-- box, 4 missed, 5 big need.
-- music notes go in sfx 8 and up.

-- seasons: deacons' vestments
-- follow the church year
seasons={"spring","summer","fall","winter"}
vests={7,11,11,2} -- white, green, green, purple

cartdata("sdcason_blessed")

function _init()
 make_town()
 p={x=256,y=272,spd=1,r=14,cd=0,
  rate=45,fl=false,fast=0,mag=14}
 people={} fx={} drops={}
 helpers={} graces={} items={}
 deacons=0 church=0 dcd=0
 dlooks={} cdlooks={}
 chap=false bishop=false cath=false
 relics=false garden=0 pow=1
 -- combos start off each day
 van=false chapter=false rosary_group=false
 hosp_relic=false house_calls=false pilgrim=false
 procession=false rounds=false sick_calls=false
 drive_through=false had_coffee=false
 -- the hospital: a number of sick
 -- people that grows all day
 hosp_need=0 hosp_priests=0
 chapel=false chapel_relic=false
 chapel_deacons=0 ccd=0
 -- grace left at the church and
 -- hospital waits there for you
 church_pile=0 hosp_pile=0
 got={} -- combos taken this day
 lv={} -- level of each upgrade
 score=0 xp=0 need=3 lvl=1
 t=0 missed=0 msg="" msg_t=0
 state="play" page=1
 season=flr(rnd(4))+1
 say("a "..seasons[season].." day")
 found_start=dget(1)
 -- her song: music pattern 0 on,
 -- using channels 0-2 (mask 7) so
 -- channel 3 stays free for the
 -- sound effects. silent until
 -- she writes one.
 -- put her song back to its
 -- normal speed for a new day
 reload(0x3200,0x3200,0x1100)
 hurry=false
 music(0,0,7)
 for i=1,8 do drop_item(rnd(world),rnd(world)) end
end

-- upgrades: name, what it does,
-- most times you can take it,
-- and (ok) when it can show up
ups={
 {n="holy water",d="bless farther",max=5,
  f=function() p.r+=5 end},
 {n="quick hands",d="bless faster",max=5,
  f=function() p.rate=max(12,p.rate-7) end},
 {n="a car",d="drive faster",max=3,
  f=function() p.spd+=0.4 end},
 {n="guardian angel",d="grace flies to you",max=4,
  f=function() p.mag+=10 end},
 -- the church path (her order):
 -- fix it, marian garden, church
 -- deacon, church relics, then the
 -- cathedral, the bishop's church
 {n="fix the church",d="more come to mass",max=2,
  f=function() church+=1 end},
 {n="cathedral",d="a bishop's seat",max=1,
  ok=function() return church>=2 and relics end,
  f=function() church=3 cath=true end},
 {n="bishop",d="ordain a priest to help",max=5,
  ok=function() return cath end,
  f=function() bishop=true add_helper(false) end},
 {n="marian garden",d="more come to pray",max=3,
  ok=function() return church>0 end,
  f=function() garden+=1 end},
 {n="church deacon",d="blesses at the church",max=4,
  ok=function() return garden>0 end,
  f=function() deacons+=1 add(dlooks,new_look("deacon")) end},
 {n="church relics",d="the church heals too",max=1,
  ok=function() return deacons>0 end,
  f=function() relics=true end},
 -- the hospital path
 {n="chaplain",d="bless the sick there",max=1,
  f=function() chap=true end},
 {n="hospital priest",d="blesses the sick for you",max=3,
  ok=function() return chap end,
  f=function() hosp_priests+=1 add_helper(true) end},
 {n="hospital chapel",d="people come to pray",max=1,
  ok=function() return hosp_priests>0 end,
  f=function()
   chapel=true
   add(bldg,{x=chapel_x,y=chapel_y,s=s_chapel,k="chapel"})
  end},
 {n="chapel relic",d="draws more; heals",max=1,
  ok=function() return chapel end,
  f=function() chapel_relic=true end},
 {n="chapel deacon",d="blesses at the chapel",max=2,
  ok=function() return chapel end,
  f=function() chapel_deacons+=1 add(cdlooks,new_look("deacon")) end},
}

function l(n) return lv[n] or 0 end

-- combos: two upgrades that work
-- together. a combo shows up (gold)
-- once you have what it needs.
-- the ones you've ever found are
-- saved, so players can collect them.
combos={
 {n="aspergillum",r="holy water 3 + quick hands 3",h="holy water",d="each blessing counts 2",
  ok=function() return l("holy water")>=3 and l("quick hands")>=3 end,
  f=function() pow=2 end},
 {n="parish van",r="a car 2 + guardian angel 2",h="a car",d="priests ride, angel x2",
  ok=function() return l("a car")>=2 and l("guardian angel")>=2 end,
  f=function() van=true p.mag*=2 end},
 {n="cathedral chapter",r="cathedral + bishop",h="cathedral",d="church grace comes to you",
  ok=function() return bishop end,
  f=function() chapter=true end},
 {n="rosary group",r="garden + 2 church deacons",h="marian garden",d="all grace comes, often",
  ok=function() return garden>0 and deacons>=2 end,
  f=function() rosary_group=true end},
 {n="healing relics",r="church relics + chaplain",h="church relics",d="the hospital heals too",
  ok=function() return relics and chap end,
  f=function() hosp_relic=true end},
 {n="house calls",r="a car + quick hands 2",h="quick hands",d="house blessings take half",
  ok=function() return l("a car")>0 and l("quick hands")>=2 end,
  f=function() house_calls=true end},
 {n="pilgrimage",r="marian garden + chapel",h="marian garden",d="church & chapel: grace x2",
  ok=function() return garden>0 and chapel end,
  f=function() pilgrim=true end},
 {n="procession",r="church relics + chapel relic",h="chapel relic",d="each minute: bless walkers",
  ok=function() return relics and chapel_relic end,
  f=function() procession=true end},
 {n="deacons' rounds",r="church deacon + chapel deacon",h="chapel deacon",d="deacons bring piles to you",
  ok=function() return deacons>0 and chapel_deacons>0 end,
  f=function() rounds=true end},
 {n="sick calls",r="a car + hospital priest",h="hospital priest",d="hospital priests go out",
  ok=function() return l("a car")>0 and hosp_priests>0 end,
  f=function() sick_calls=true end},
 {n="drive-through",r="coffee + a car",h="coffee",d="coffee lasts twice as long",
  ok=function() return l("a car")>0 and had_coffee end,
  f=function() drive_through=true end},
}

-- big needs: they stay in one
-- place; find them (z: map) and
-- stay until the number is 0
events={
 {n="a grieving widow",at="house",need=12},
 {n="a new house to bless",at="house",need=8},
 {n="a wedding",at="church",need=10},
 {n="a baptism",at="church",need=6},
 {n="a sick child",at="hosp",need=8},
}

-- the bishop's priests: your priest
-- drawing, each with their own
-- skin and eyes
function add_helper(hosp)
 add(helpers,{x=p.x,y=p.y,cd=0,hosp=hosp,
  ox=rnd(24)-12,oy=rnd(16)-8,look=new_look("priest")})
end

-->8
-- the town

function make_town()
 bldg={}
 add(bldg,{x=church_x,y=church_y,s=s_church,k="church"})
 add(bldg,{x=hosp_x,y=hosp_y,s=s_hosp,k="hosp"})
 -- doors she paints in the map
 -- editor (sprite flag 1) send
 -- people out too
 for my=0,63 do for mx=0,63 do
  if fget(mget(mx,my),1) then
   add(bldg,{x=mx*8-4,y=my*8-10,k="door"})
  end
 end end
 for i=1,40 do
  local x,y=16+rnd(world-48),16+rnd(world-48)
  if free(x,y) then
   add(bldg,{x=x,y=y,s=s_house,k="house"})
  end
 end
 decor={}
 for i=1,150 do
  add(decor,{x=rnd(world),y=rnd(world),s=rnd(s_decor)})
 end
end

function free(x,y)
 if abs(x-256)<40 and abs(y-260)<40 then return false end
 if abs(x-chapel_x)<32 and abs(y-chapel_y)<32 then return false end
 for b in all(bldg) do
  if abs(b.x-x)<32 and abs(b.y-y)<32 then return false end
 end
 return true
end

-- walls stop the priest: buildings
-- and map tiles
-- with sprite flag 0
function solid(x,y)
 if fget(mget(x\8%64,y\8%64),0) then return true end
 for b in all(bldg) do
  if b.s and x>b.x and x<b.x+16
   and y>b.y+6 and y<b.y+17 then
   return true
  end
 end
 return false
end

-- the town wraps: walk off one
-- side, come in the other. wd is
-- the short way from b to a.
function wd(a,b)
 return (a-b+world/2)%world-world/2
end

function near(ax,ay,bx,by,r)
 local dx,dy=wd(ax,bx),wd(ay,by)
 return abs(dx)<r and abs(dy)<r
  and dx*dx+dy*dy<r*r
end

-->8
-- people

-- a random look for group g
-- (people, priest or deacon)
function new_look(g)
 local sk,l,hair=rnd(skins),{},rnd(looks.hair)
 look_hair=hair -- for the top of the head
 for c,k in pairs(parts[g] or {}) do
  if k=="skin" then l[c]=sk[1]
  elseif k=="eyes" then l[c]=sk[2]
  elseif k=="hair" then l[c]=hair
  elseif k=="vestment" then l[c]=vests[season]
  elseif looks[k] then l[c]=rnd(looks[k]) end
 end
 return l
end

-- kinds: walk (comes to you),
-- home (waits at home), church
-- (walks to mass, waits there),
-- sick (at the hospital)
function person(x,y,k)
 local q={x=x,y=y,k=k,s=rnd(s_people),
  look=new_look("people"),need=1,hit=0,
  wait=900+rnd(300),spd=.2+rnd(.2)}
 -- the top of the head: hair, or
 -- a hat (its own random color)
 local tc=tops[q.s]
 if tc and rnd(1)<.5 then q.look[tc]=look_hair end
 add(people,q)
 return q
end

function spawn_walker()
 -- out of a house near you,
 -- or from off the screen
 local x,y
 local close={}
 for b in all(bldg) do
  if abs(wd(b.x,p.x))<100 and abs(wd(b.y,p.y))<100 then
   add(close,b)
  end
 end
 if #close>0 and rnd(1)<0.7 then
  local b=rnd(close)
  x,y=b.x+8,b.y+18
 else
  local a=rnd(1)
  x,y=(p.x+cos(a)*90)%world,(p.y+sin(a)*90)%world
 end
 person(x,y,"walk")
end

-- a house blessing takes more:
-- stay near until the number is 0
function spawn_home()
 local b=rnd(bldg)
 if b.k!="house" or b.who then return end
 local q=person(b.x+8,b.y+18,"home")
 q.need=3+lvl\4 q.wait=1500+rnd(450)
 if house_calls then q.need=ceil(q.need/2) end
 q.b=b b.who=q
end

function spawn_event()
 local e=rnd(events)
 if e.at=="hosp" and not chap then e=events[1] end
 local x,y,b
 if e.at=="house" then
  for i=1,20 do
   b=rnd(bldg)
   if b.k=="house" and not b.who then break end
   b=nil
  end
  if not b then return end
  x,y=b.x+8,b.y+18
 elseif e.at=="church" then
  x,y=church_x+2+rnd(12),church_y+30
 else
  x,y=hosp_x+2+rnd(12),hosp_y+30
 end
 local q=person(x,y,"event")
 q.need=e.need+lvl\2 q.wait=1800 q.ev=e.n
 if b then q.b=b b.who=q end
 say(e.n.."! (z: map)")
 sfx(5)
end

function spawn_church()
 -- pilgrims go to the chapel too
 if pilgrim and rnd(1)<.5 then spawn_chapel() end
 local b=rnd(bldg)
 local q=person(b.x+8,b.y+18,"church")
 q.tx=church_x-8+rnd(32)
 q.ty=church_y+19+rnd(12)
end

-- with a chapel, people walk to the
-- hospital to pray and be blessed
function spawn_chapel()
 local b=rnd(bldg)
 local q=person(b.x+8,b.y+18,"chapel")
 q.tx=chapel_x-6+rnd(28)
 q.ty=chapel_y+19+rnd(10)
end

-- the sick in the hospital: one
-- blessing makes the number 1 less
function heal(n)
 n=min(n,hosp_need)
 if n<=0 then return end
 hosp_need-=n score+=n
 hosp_pile+=n
 splash(hosp_x+8,hosp_y+8,10)
 add(fx,{x=hosp_x+8,y=hosp_y-4,t=20,s="\143",c=10})
 sfx(0)
end

-- one blessing for one person
function hit(q)
 q.need-=pow q.hit=4
 if q.need>0 then return end
 del(people,q) score+=1
 if q.b then q.b.who=nil end
 local v=1
 if q.ev then v=10 elseif q.k=="home" then v=3
 elseif pilgrim and q.tx then v=2 end
 drop_grace(q.x,q.y-4,v)
 if q.ev then
  add(items,{x=q.x,y=q.y+4,k="chest"})
  say(q.ev.." blessed!")
 end
 add(fx,{x=q.x,y=q.y-12,t=20,s="\143",c=10})
 sfx(0)
end

-- everyone in reach (only kind k,
-- if given)
function bless(x,y,r,k)
 for q in all(people) do
  if (not k or q.k==k) and near(q.x,q.y-4,x,y,r) then
   hit(q)
  end
 end
end

-- waited too long: the day gets
-- shorter
function miss(q)
 del(people,q) missed+=1
 if q.b then q.b.who=nil end
 -- a big need missed costs 3x
 local c=miss_cost
 if q.ev then c*=3 end
 t+=c*30
 add(fx,{x=q.x,y=q.y-12,t=30,s="-"..c.."s",c=8})
 sfx(4)
end

-- grace near the church or the
-- hospital piles up there
function drop_grace(x,y,v)
 if near(x,y,church_x+8,church_y+24,40) then
  church_pile+=v
 elseif near(x,y,hosp_x+8,hosp_y+24,40) then
  hosp_pile+=v
 else
  add(graces,{x=x,y=y,v=v})
 end
end

function splash(x,y,r)
 for i=1,10 do
  local a=rnd(1)
  add(drops,{x=x,y=y,dx=cos(a)*r/8,dy=sin(a)*r/8,t=8})
 end
end

-->8
-- gifts and upgrades

function drop_item(x,y)
 add(items,{x=x%world,y=y%world,
  k=rnd({"rosary","bucket","coffee","coffee"})})
end

function use(k)
 sfx(1)
 if k=="chest" then
  sfx(3) offer("a gift box!")
 elseif k=="rosary" then
  for g in all(graces) do g.pull=true end
  say("rosary: all grace comes")
 elseif k=="bucket" then
  for q in all(people) do
   if not q.ev then q.need=1 end
  end
  splash(p.x,p.y-4,70)
  bless(p.x,p.y,90)
  say("holy water for everyone!")
 elseif k=="coffee" then
  had_coffee=true
  p.fast=drive_through and 600 or 300
  say("coffee! go go go")
 end
end

function say(s) msg=s msg_t=90 end

function offer(title)
 local pool={}
 for u in all(ups) do
  if (lv[u.n] or 0)<u.max
   and (not u.ok or u.ok()) then
   add(pool,u)
  end
 end
 choices={}
 -- a combo that's ready comes first
 for c in all(combos) do
  if not got[c.n] and c.ok() and #choices==0 then
   c.combo=true add(choices,c)
  end
 end
 while #choices<3 and #pool>0 do
  local u=rnd(pool) del(pool,u) add(choices,u)
 end
 if #choices>0 then
  pick=1 pick_title=title state="pick"
 end
end

function levelup()
 xp-=need lvl+=1
 need=flr(need*1.3)+1
 sfx(2)
 offer("level "..lvl.."! choose one")
end

-->8
-- update

function _update()
 if state=="over" then
  if btnp(4) then book_from="over" state="book"
  elseif btnp(5) then _init() end
  return
 end
 if state=="map" then
  if btnp(4) then state="play"
  elseif btnp(5) then book_from="map" state="book" end
  return
 end
 if state=="book" then
  local n=pages()
  if btnp(0) then page=(page-2)%n+1 end
  if btnp(1) then page=page%n+1 end
  if btnp(4) or btnp(5) then state=book_from end
  return
 end
 if state=="pick" then
  if btnp(0) or btnp(2) then pick=max(1,pick-1) end
  if btnp(1) or btnp(3) then pick=min(#choices,pick+1) end
  if btnp(4) or btnp(5) then
   local u=choices[pick]
   lv[u.n]=l(u.n)+1
   if u.combo then
    got[u.n]=true
    -- remember it for good
    for i=1,#combos do
     if combos[i]==u then dset(1,dget(1)|(1<<i)) end
    end
    say("combo: "..u.n.."!")
   end
   u.f() state="play"
  end
  return
 end
 if btnp(4) then state="map" return end

 t+=1
 -- last minute: the music hurries
 -- (her song's notes play faster)
 if not hurry and t>=(day_len-60)*30 then
  hurry=true say("one minute left!")
  for i=8,63 do
   local a=0x3200+i*68+65
   poke(a,max(1,peek(a)*3\4))
  end
 end
 if t>=day_len*30 then
  state="over"
  best=dget(0)
  if score>best then dset(0,score) end
  return
 end

 -- walk (coffee doubles it)
 local dx,dy=0,0
 if btn(0) then dx-=1 p.fl=true end
 if btn(1) then dx+=1 p.fl=false end
 if btn(2) then dy-=1 end
 if btn(3) then dy+=1 end
 local sp=p.spd
 if p.fast>0 then sp*=2 p.fast-=1 end
 p.mv=dx!=0 or dy!=0
 local nx,ny=(p.x+dx*sp)%world,(p.y+dy*sp)%world
 if not solid(nx,p.y) then p.x=nx end
 if not solid(p.x,ny) then p.y=ny end

 -- who asks, and how often
 if t%max(10,40-t\900)==0 then spawn_walker() end
 if t%240==0 then spawn_home() end
 if t%max(20,150-church*20-garden*20)==0 then spawn_church() end
 -- the sick: more as the day goes on.
 -- once you're chaplain, the ones
 -- past 9 count as missed
 if t%max(60,150-t\60)==0 then
  if hosp_need<9 then hosp_need+=1
  elseif chap then
   missed+=1 t+=miss_cost*30 sfx(4)
   add(fx,{x=hosp_x+8,y=hosp_y-4,t=30,s="-"..miss_cost.."s",c=8})
  end
 end
 if chapel and t%(chapel_relic and 70 or 140)==0 then spawn_chapel() end
 -- a big need about every 45 s
 if t%1350==600 then spawn_event() end
 if t%450==0 then
  drop_item(p.x+rnd(160)-80,p.y+rnd(160)-80)
 end

 -- walkers come to you, churchgoers
 -- go to mass; the rest stay put
 for q in all(people) do
  local tx,ty=p.x,p.y
  if q.tx then tx,ty=q.tx,q.ty end
  if q.k=="walk" or q.tx then
   if not near(q.x,q.y,tx,ty,6) then
    local a=atan2(wd(tx,q.x),wd(ty,q.y))
    q.x=(q.x+cos(a)*q.spd)%world
    q.y=(q.y+sin(a)*q.spd)%world
    q.fl=cos(a)<0
   elseif q.tx then
    q.there=true
   end
  end
  -- churchgoers start waiting
  -- once they're there
  if not q.tx or q.there then q.wait-=1 end
  if q.wait<=0 then miss(q) end
 end

 -- you bless on your own
 p.cd-=1
 if p.cd<=0 then
  p.cd=p.rate
  splash(p.x,p.y-4,p.r)
  bless(p.x,p.y-4,p.r)
  -- at the hospital, as chaplain
  if chap and near(p.x,p.y,hosp_x+8,hosp_y+20,p.r+14) then
   heal(pow)
  end
 end

 -- chapel deacons
 if chapel_deacons>0 then
  ccd-=1
  if ccd<=0 then
   ccd=max(20,70-chapel_deacons*20)
   splash(chapel_x+8,chapel_y+24,22)
   bless(chapel_x+8,chapel_y+24,24,"chapel")
  end
 end

 -- deacons bless at the church
 -- (more deacons: faster)
 if deacons>0 then
  dcd-=1
  if dcd<=0 then
   dcd=max(15,70-deacons*14)
   splash(church_x+8,church_y+22,22)
   bless(church_x+8,church_y+22,24,"church")
  end
 end

 -- relics: the church (and with
 -- the combo, the hospital) heals
 if t%120==0 then
  if relics then bless(church_x+8,church_y+22,24,"church") end
  if chapel_relic then bless(chapel_x+8,chapel_y+24,24,"chapel") end
  if hosp_relic then heal(1) end
 end
 if rosary_group and t%900==0 then
  for g in all(graces) do g.pull=true end
  say("rosary group: grace comes")
 end

 -- piles: go there to collect them
 if procession and t%1800==0 then
  for q in all(people) do
   if q.tx and not q.there then q.need=1 hit(q) end
  end
  say("procession: walkers blessed")
 end
 if chapter or rounds or near(p.x,p.y,church_x+8,church_y+24,22) then
  if church_pile>0 then xp+=church_pile church_pile=0 sfx(1) end
 end
 if hosp_relic or rounds or near(p.x,p.y,hosp_x+8,hosp_y+24,22) then
  if hosp_pile>0 then xp+=hosp_pile hosp_pile=0 sfx(1) end
 end

 for h in all(helpers) do helper(h) end

 -- grace: walk near it to pick it up
 for g in all(graces) do
  if g.pull or near(g.x,g.y,p.x,p.y-4,p.mag) then
   local a=atan2(wd(p.x,g.x),wd(p.y-4,g.y))
   g.x=(g.x+cos(a)*3)%world g.y=(g.y+sin(a)*3)%world
  end
  if near(g.x,g.y,p.x,p.y-4,5) then
   del(graces,g) xp+=g.v sfx(1)
  end
 end

 for it in all(items) do
  if near(it.x,it.y,p.x,p.y-4,8) then
   del(items,it) use(it.k)
   if state=="pick" then break end
  end
 end

 for f in all(fx) do
  f.t-=1 if f.t<=0 then del(fx,f) end
 end
 for d in all(drops) do
  d.x+=d.dx d.y+=d.dy d.t-=1
  if d.t<=0 then del(drops,d) end
 end
 msg_t=max(0,msg_t-1)
 if xp>=need and state=="play" then levelup() end
end

-- the bishop's priests: one person
-- or one grace at a time, and they
-- stay on your screen. hospital
-- priests stay there and bless
-- the sick.
function helper(h)
 h.mv=false
 if h.hosp then
  local tx,ty=hosp_x+8+h.ox/2,hosp_y+22
  -- sick calls: when the hospital
  -- is quiet, visit someone at home
  local tg
  if sick_calls and hosp_need==0 then
   local best=999
   for q in all(people) do
    if q.k=="home" then
     local d=abs(wd(q.x,h.x))+abs(wd(q.y,h.y))
     if d<best then tg,best=q,d end
    end
   end
   if tg then tx,ty=tg.x,tg.y end
  end
  if not near(h.x,h.y,tx,ty,tg and 7 or 3) then
   local a=atan2(wd(tx,h.x),wd(ty,h.y))
   h.x=(h.x+cos(a)*1.5)%world h.y=(h.y+sin(a)*1.5)%world
   h.fl=cos(a)<0 h.mv=true
  else
   h.cd-=1
   if h.cd<=0 then
    if tg then h.cd=30 splash(h.x,h.y-4,6) hit(tg)
    elseif hosp_need>0 then h.cd=60 heal(1) end
   end
  end
  return
 end
 local cx,cy,range=p.x,p.y,60
 if h.hosp then cx,cy,range=hosp_x+8,hosp_y+22,30 end
 local tg,best=nil,999
 for q in all(people) do
  if abs(wd(q.x,cx))<range and abs(wd(q.y,cy))<range then
   local d=abs(wd(q.x,h.x))+abs(wd(q.y,h.y))
   if d<best then tg,best=q,d end
  end
 end
 if not h.hosp then
  for g in all(graces) do
   local d=abs(wd(g.x,h.x))+abs(wd(g.y,h.y))
   if abs(wd(g.x,p.x))<60 and abs(wd(g.y,p.y))<60 and d<best then
    tg,best=g,d
   end
  end
 end
 local tx,ty=cx+h.ox,cy+h.oy
 if tg then tx,ty=tg.x,tg.y end
 if not near(h.x,h.y,tx,ty,4) then
  -- left behind? hurry back
  local sp=1
  if van then sp=2 end
  if not h.hosp and not near(h.x,h.y,p.x,p.y,64) then sp=3 end
  local a=atan2(wd(tx,h.x),wd(ty,h.y))
  h.x=(h.x+cos(a)*sp)%world h.y=(h.y+sin(a)*sp)%world
  h.fl=cos(a)<0 h.mv=true
 end
 h.cd-=1
 if tg and h.cd<=0 and near(h.x,h.y,tg.x,tg.y,7) then
  h.cd=30
  if tg.v then
   del(graces,tg) xp+=tg.v sfx(1)
  else
   splash(h.x,h.y-4,6) hit(tg)
  end
 end
end

-->8
-- draw

dc={}
function drawn(n)
 if dc[n]==nil then
  dc[n]=false
  for y=0,7 do for x=0,7 do
   if sget(n%16*8+x,n\16*8+y)!=0 then dc[n]=true end
  end end
 end
 return dc[n]
end

-- draw what comes next on the
-- side of the wrap nearest you
function at(x,y)
 camera(p.x-64-(wd(x,p.x)+p.x-x),p.y-64-(wd(y,p.y)+p.y-y))
end

function sprite(n,x,y,fl,c)
 -- her drawing (2 frames), or a dot
 if drawn(n) then
  spr(n+flr(t/15)%2,x-4,y-8,1,1,fl)
 else
  circfill(x,y-4,3,c)
 end
end

-- walking or standing, wearing look
-- (a color swap); walk falls back
-- to stand if it isn't drawn yet
function figure(stand_n,walk_n,moving,x,y,fl,look,c)
 for a,b in pairs(look or {}) do pal(a,b) end
 local n=stand_n
 if moving and drawn(walk_n) then n=walk_n end
 sprite(n,x,y,fl,c)
 pal()
end

function thing(n,x,y,c)
 if drawn(n) then spr(n,x-4,y-4) else circfill(x,y,2,c) end
end

function shape(b)
 local x,y=b.x,b.y
 if b.k=="chapel" then
  rectfill(x+3,y+8,x+12,y+15,7)
  rectfill(x+7,y+2,x+8,y+8,7)
  line(x+5,y+4,x+10,y+4,7)
 elseif b.k=="church" then
  rectfill(x,y+4,x+15,y+15,7)
  rectfill(x+7,y-5,x+8,y+4,7)
  line(x+5,y-3,x+10,y-3,7)
  rectfill(x+6,y+10,x+9,y+15,4)
 elseif b.k=="hosp" then
  rectfill(x,y+2,x+15,y+15,7)
  rectfill(x+7,y+4,x+8,y+11,8)
  rectfill(x+4,y+7,x+11,y+8,8)
 else
  rectfill(x+1,y+7,x+14,y+15,15)
  for i=0,7 do line(x+7-i,y+i,x+8+i,y+i,8) end
  rectfill(x+6,y+11,x+9,y+15,4)
 end
end

function draw_person(q)
 at(q.x,q.y)
 for c,n in pairs(q.look) do pal(c,n) end
 if q.hit>0 then
  for i=1,15 do pal(i,7) end
  q.hit-=1
 end
 -- walking, or standing still
 local n=q.s
 if (q.there or not q.tx) and q.k!="walk" and drawn(q.s+stand) then
  n=q.s+stand
 end
 sprite(n,q.x,q.y,q.fl,12)
 pal()
 -- a big need glows
 if q.ev and t%16<10 then circ(q.x,q.y-4,7,9) end
 -- "+" asks for a blessing; a number
 -- is how many more it needs
 if q.wait>150 or t%8<4 then
  local y=q.y-15
  if q.ev then print(q.need,q.x-3,y-2,9)
  elseif q.need>1 then print(q.need,q.x-3,y,12)
  else print("+",q.x-1,y,7) end
 end
end

function draw_map()
 -- the whole town at 1/4 size
 cls(3)
 for b in all(bldg) do
  if b.s then
   local c=15
   if b.k=="church" then c=7
   elseif b.k=="hosp" or b.k=="chapel" then c=8 end
   rectfill(b.x/4,b.y/4,b.x/4+3,b.y/4+3,c)
  end
 end
 for it in all(items) do pset(it.x/4,it.y/4,9) end
 for q in all(people) do
  if q.ev then
   circfill(q.x/4,q.y/4,1,t%10<5 and 9 or 7)
  elseif q.k!="walk" then
   pset(q.x/4,q.y/4,t%10<5 and 10 or 7)
  end
 end
 print("church",church_x/4-10,church_y/4-7,7)
 print("hospital",hosp_x/4-14,hosp_y/4-7,8)
 -- grace waiting at each
 if church_pile>0 then print(church_pile,church_x/4+5,church_y/4,10) end
 if hosp_pile>0 then print(hosp_pile,hosp_x/4+5,hosp_y/4,10) end
 if hosp_need>0 then print("+"..hosp_need,hosp_x/4-2,hosp_y/4+6,chap and 8 or 5) end
 circfill(p.x/4,p.y/4,2,t%10<5 and 12 or 7)
 rectfill(0,120,127,127,1)
 print("you",2,122,12)
 print("asking",18,122,10)
 print("big need",44,122,9)
 print("\142map \151book",76,122,6)
end

-- the book of blessings: every
-- upgrade, and the combos you've
-- found (the rest show a hint)
function pages() return 2+ceil(#combos/6) end

function draw_book()
 cls(1)
 rect(0,0,127,127,10)
 if page<3 then
  print("book of blessings: upgrades",4,3,10)
  for i=page*11-10,min(#ups,page*11) do
   local u=ups[i]
   local y=4+(i-page*11+11)*9
   print(u.n,4,y,7)
   print(l(u.n).."/"..u.max,108,y,9)
   print(u.d,8,y+4,13)
  end
 else
  local f=dget(1)
  print("book of blessings: combos",4,3,10)
  local first=(page-3)*6+1
  for i=first,min(#combos,first+5) do
   local c=combos[i]
   local y=-4+(i-first+1)*19
   if f&(1<<i)>0 or got[c.n] then
    print("\146 "..c.n,4,y,10)
    print(c.r,8,y+6,7)
    print(c.d,8,y+12,13)
   else
    print("\146 ???",4,y,5)
    print("needs "..c.h.." + ?",8,y+6,6)
   end
  end
 end
 print("\139\145 page "..page.."/"..pages(),4,121,6)
 print("\142 back",96,121,6)
end

function _draw()
 if state=="map" then draw_map() return end
 if state=="book" then draw_book() return end
 cls(3)
 camera(p.x-64,p.y-64)
 -- map tiles she painted, wrapped
 local tx,ty=(p.x-64)\8,(p.y-64)\8
 for j=ty,ty+17 do for i=tx,tx+17 do
  local m=mget(i%64,j%64)
  if m>0 then spr(m,i*8,j*8) end
 end end
 for d in all(decor) do at(d.x,d.y) spr(d.s,d.x,d.y) end
 for b in all(bldg) do
  at(b.x,b.y)
  if b.s then
   if drawn(b.s) then spr(b.s,b.x,b.y,2,2)
   else shape(b) end
  end
 end
 at(church_x,church_y)
 -- the marian garden grows
 for i=1,garden*6 do
  local fx_,fy=church_x+20+i%6*3,church_y+8+i\6*4
  pset(fx_,fy,({14,7,12})[i%3+1])
 end
 if garden>0 then rect(church_x+18,church_y+6,church_x+37,church_y+8+garden*4,15) end
 -- grace piled up, waiting for you
 if church_pile>0 then
  thing(s_grace,church_x+8,church_y+26,10)
  print(church_pile,church_x+12,church_y+24,10)
 end
 at(hosp_x,hosp_y)
 -- how many sick need a blessing
 -- (grey until you're chaplain)
 if hosp_need>0 then
  local c=5
  if chap then c=8 if hosp_need>=7 and t%10<5 then c=7 end end
  print("+"..hosp_need,hosp_x+3,hosp_y-12,c)
 end
 for i=1,chapel_deacons do
  figure(s_deacon,s_deacon_walk,false,chapel_x+i*6,chapel_y+24,false,cdlooks[i],9)
 end
 if hosp_pile>0 then
  thing(s_grace,hosp_x+8,hosp_y+26,10)
  print(hosp_pile,hosp_x+12,hosp_y+24,10)
 end
 camera(p.x-64,p.y-64)
 circ(p.x,p.y-4,p.r,11)

 for it in all(items) do
  at(it.x,it.y)
  local s,c=s_chest,9
  if it.k=="rosary" then s,c=s_rosary,13
  elseif it.k=="bucket" then s,c=s_bucket,12
  elseif it.k=="coffee" then s,c=s_coffee,4 end
  thing(s,it.x,it.y+sin(t/40),c)
 end
 for g in all(graces) do at(g.x,g.y) thing(s_grace,g.x,g.y,10) end
 for q in all(people) do draw_person(q) end
 at(church_x,church_y)
 for i=1,deacons do
  figure(s_deacon,s_deacon_walk,false,church_x-6+i*6,church_y+22,false,dlooks[i],9)
 end
 for h in all(helpers) do
  at(h.x,h.y)
  figure(s_priest,s_priest_walk,h.mv,h.x,h.y,h.fl,h.look,13)
 end
 camera(p.x-64,p.y-64)
 ovalfill(p.x-3,p.y-1,p.x+3,p.y+1,1)
 if (lv["a car"] or 0)>0 and drawn(s_car) then
  spr(s_car,p.x-4,p.y-6,1,1,p.fl)
 end
 -- you: blessing (4 frames, just
 -- after each blessing), walking,
 -- or standing. bishop once you are.
 local st,wk,bl=s_priest,s_priest_walk,s_priest_bless
 if bishop and drawn(s_bishop) then
  st,wk,bl=s_bishop,s_bishop_walk,s_bishop_bless
 end
 local since=p.rate-p.cd
 if since<12 and drawn(bl) then
  spr(bl+since\3,p.x-4,p.y-8,1,1,p.fl)
 else
  figure(st,wk,p.mv,p.x,p.y,p.fl,nil,0)
 end
 for d in all(drops) do
  at(d.x,d.y) pset(d.x,d.y,d.t%2==0 and 12 or 7)
 end
 for f in all(fx) do
  at(f.x,f.y) print(f.s,f.x-#f.s*2,f.y-(30-f.t)/2,f.c)
 end
 camera()

 -- off the screen: who's waiting
 -- at home or at the hospital
 for q in all(people) do
  if q.k=="home" or q.ev then
   local sx,sy=wd(q.x,p.x)+64,wd(q.y,p.y)+60
   if sx<0 or sx>127 or sy<10 or sy>127 then
    local c=10
    if q.ev then c=9 end
    circfill(mid(2,sx,125),mid(13,sy,125),1,c)
   end
  end
 end
 -- the hospital, when it's filling up
 if chap and hosp_need>=5 then
  local sx,sy=wd(hosp_x+8,p.x)+64,wd(hosp_y+8,p.y)+60
  if sx<0 or sx>127 or sy<10 or sy>127 then
   circfill(mid(2,sx,125),mid(13,sy,125),1,8)
  end
 end

 -- top bar
 rectfill(0,0,127,7,1)
 print("blessed "..score,2,1,7)
 print("lv "..lvl,64,1,6)
 local left=max(0,day_len-t\30)
 print(left\60 ..":"..sub("0"..left%60,-2),108,1,10)
 rectfill(0,8,127,9,0)
 rectfill(0,8,127*min(1,xp/need),9,10)
 if msg_t>0 then
  print(msg,64-#msg*2,14,7)
 end

 if state=="pick" then
  rectfill(8,28,119,100,1) rect(8,28,119,100,10)
  print(pick_title,64-#pick_title*2,32,10)
  for i=1,#choices do
   local u=choices[i]
   local y=42+(i-1)*17
   if i==pick then rectfill(12,y-2,115,y+12,13) end
   if u.combo then
    print("\146 "..u.n,16,y,10)
   else
    print(u.n,16,y,7)
    print("lv "..(l(u.n)+1),96,y,9)
   end
   print(u.d,16,y+6,6)
  end
  print("\148\131 choose  \142 take",28,93,6)
 end
 if state=="over" then
  rectfill(12,30,115,104,1) rect(12,30,115,104,10)
  print("the day is done",34,36,10)
  print("blessed: "..score,34,48,7)
  print("missed: "..missed,34,56,6)
  print("best: "..max(best,score),34,64,9)
  local f=0
  for i=1,#combos do
   if dget(1)&(1<<i)>0 then f+=1 end
  end
  print("combos found: "..f.."/"..#combos,26,78,10)
  -- the reveal: combos new today
  local y=86
  for i=1,#combos do
   if got[combos[i].n] and found_start&(1<<i)==0 then
    print("new! "..combos[i].n,26,y,9) y+=6
    if y>92 then break end
   end
  end
  print("\142 book  \151 play again",18,98,6)
 end
end
__gfx__
0001110000000000000ddd00000000000006660000000000000111000000000000011100000111000001110000011100000ddd00000000000006660000000000
001fff0000011100007fff00000ddd00006fff0000066600001fff0000011100001fff00001fff00001fff00001fff00007fff00000ddd00006fff0000066600
00f3f300001fff0000f3f300007fff0000f4f400006fff0000f3f300001fff0000f3f3f000f3f30000f3f30000f3f30000f3f300007fff0000f4f400006fff00
001fff0000f3f300007fff0000f3f300006fff0000f4f400001fff0000f3f300001fff10001fff00001fff00001fff00007fff0000f3f300006fff0000f4f400
00017000001fff0000117100007fff0000777900006fff0000017000001fff0000017000000171f000017000000171f000117100007fff0000777900006fff00
000110000001700000111100001171000077a70000777900000110000001700000011000000110000001f0000001100000111100001171000077a70000777900
000f1000000f100000fddd0000fddd0000f9770000f7a700000f10000001f000000f1000000f1000000f1000000f100000fddd0000ddfd0000f977000077f700
00011000000110000001100000011000000110000001100000011000001010000001100000011000000110000001100000011000001101000001100000110100
000ccc0000000000000eee0000000000000aaa0000000000000eee0000000000000ccc0000000000000999000000000000000000000000000000000000000000
00544400000ccc0000544400000eee0000544400000aaa0000544450000eee0000544400000ccc00005444000009990000000000000000000000000000000000
004f4f0000544400054f4f0000544400004f4f0000544400054f4f5000544450004f4f0000544400004f4f000054440000000000000000000000000000000000
0054a400004f4f0005544450054f4f0000549400004f4f0005544400054f4f5000545400004f4f0000545400004f4f0000000000000000000000000000000000
000d70000054a400000370000554445000d17100005494000053770005544400005555000054540000d555000054540000000000000000000000000000000000
000d1000000d7000000310000003700000d11100001d7100000c4c0000537700000a70000055550000d1a100001d550000000000000000000000000000000000
0004e000000e40000004c00000014000004eee0000ee4e00000111000004cc000004100000014000004eee0000ee4e0000000000000000000000000000000000
00033000003030000001100000101000000330000033030000110100000111000003300000303000000330000033030000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000000ddd00000ddd00000ddd00000ddd0000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000000007fff00007fff00007fff00007fff0000000000000000000000000000000000
000000000000000000000000000000000000000000000000000000000000000000f3f3f000f3f30000f3f30000f3f30000000000000000000000000000000000
0000011111000000000000000000000000000000000000000000000000000000007fff10007fff00007fff00007fff0000000000000000000000000000000000
000011dddd1000000000000000000000000000000000000000000000000000000011710000117100001171000011710000000000000000000000000000000000
0001111dddd1000000000000000000000000000000000000000000000000000000111100001111f00011f1000011111f00000000000000000000000000000000
0011a111dddd100000000000000000000000000000000000000000000000000000fddd0000fddd0000fddd0000fddd0000000000000000000000000000000000
011111111dddd1000000000000000000000000000000000000000000000000000001100000011000000110000001100000000000000000000000000000000000
0111111111111110000000000000000000000000000000000000000000000000000ccc0000000000000eee0000000000000aaa0000000000000eee0000000000
1eeeeeeeee19991000000000000000000000000000000000000000000000000000544400000ccc0000544400000eee0000544400000aaa0000544450000eee00
1eeeeeeeee19a910000000000000000000000000000000000000000000000000004f4f0000544400054f4f0000544400004f4f0000544400054f4f5000544450
1eaeeeeaee1999100000000000000000000000000000000000000000000000000054a400004f4f0005544450054f4f0000549400004f4f0005544400054f4f50
1eeeeeeeee199100000000000000000000000000000000000000000000000000000d70000054a400000370000554445000d17100005494000053770005544400
1eee77eeee191000000000000000000000000000000000000000000000000000000d1000000d7000000310000003700000d1110000d171000003110000537700
1eee77eeee1100000000000000000000000000000000000000000000000000000004e0000004e0000004c0000004c000004eee00004eee000004cc000004cc00
01111111110000000000000000000000000000000000000000000000000000000003300000033000000110000001100000033000000330000001110000011100
000ccc00000000000009990000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00544400000ccc000054440000099900000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
004f4f0000544400004f4f0000544400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00545400004f4f0000545400004f4f00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
005555000054540000d5550000545400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000a70000055550000d1a10000d55500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
0004100000041000004eee00004eee00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00033000000330000003300000033000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
