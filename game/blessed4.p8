pico-8 cartridge // http://www.pico-8.com
version 41
__lua__
-- blessed! a priest survivors game
-- version: 1.1
-- arrows walk. you bless anyone
-- near you on your own.
-- z (the o button): town map.
-- level up / gift box: arrows
-- choose, x or z take it.
-- the 4-player cart, made from
-- blessed.p8 (edit that one)

-- sprite slots: game/sprites.json
-- says which drawing goes where
-- ("_slots" lists them all). most
-- slot numbers are written right
-- where they're drawn: 0 priest,
-- 6 walking, 8 blessing (4 frames),
-- 2/12/56 the same for the bishop,
-- 4 deacon, 33 gift box, 34 rosary,
-- 35 bucket, 36 coffee, 84 angel,
-- 96 car, 104 van (16x16, 4 frames)
-- people walking (16-26); the same
-- people standing are 56 slots later.
-- 32 is grace (drawn as a yellow dot)

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
 people=split"clothes,,clothes,skin,hair,,clothes,,clothes,clothes,,clothes,clothes,clothes,eyes",
 priest=split",hair,eyes,,,,,,,,,,,,skin",
 deacon=split",hair,,eyes,,,vestment,,,,,,,,skin",
 child=split"eyes,,,,,,,,hair,,,,clothes,,skin",
}
plooks={"bbdefghijklmnop,bbmefghijklmnop,bbbefghijklmnop,bfdefghijklmnop,bfmefghijklmnop,bfbefghijklmnop,bedefghijklmnop,bemefghijklmnop,bebefghijklmnop,bgdefghijklmnop,bgmefghijklmnop,bgbefghijklmnop,bhdefghijklmnop,bhmefghijklmnop,bhbefghijklmnop,bkdefghijklmnop,bkmefghijklmnop,bkbefghijklmnop,bbbefghijklmnoj,bfbefghijklmnoj,bebefghijklmnoj,bgbefghijklmnoj,bhbefghijklmnoj,bbbefghijklmnoe,bfbefghijklmnoe,bgbefghijklmnoe,bhbefghijklmnoe","bcbefghijklmnop,bcdpfghijklmnop,bcmpfghijklmnop,bcbpfghijklmnop,bcbjfghijklmnop","bcdefghijklmnop,bcdefghijklmdop,bcdefghijklmmop,bcdefghijklmbop,bcdefghijklmboj,bcdefghijklmboe","bcdefghijklmnop,bcdefghijblmdop,bcdefghijblmmop,bcdefghijblmbop,bcdefghijflmdop,bcdefghijflmmop,bcdefghijflmbop,bcdefghijelmdop,bcdefghijelmmop,bcdefghijelmbop,bcdefghijglmdop,bcdefghijglmmop,bcdefghijglmbop,bcdefghijhlmdop,bcdefghijhlmmop,bcdefghijhlmbop,bcdefghijklmdop,bcdefghijklmmop,bcdefghijklmbop,bcdefghijblmboj,bcdefghijflmboj,bcdefghijelmboj,bcdefghijglmboj,bcdefghijhlmboj,bcdefghijblmboe,bcdefghijflmboe,bcdefghijglmboe,bcdefghijhlmboe","bcdefghijklmnop,bcdefgfijklmdop,bcdefgfijklmmop,bcdefgfijklmbop,bcdefghijklmdop,bcdefghijklmmop,bcdefghijklmbop,bcdefgfijklmboj,bcdefghijklmboj,bcdefgfijklmboe,bcdefghijklmboe","bcdefghijklmnop,bcdefghijkldnop,bcdefghijklbnop,bcdefghijklbnoj,bcdefghijklbnoe","bcdegghijklmnop,bcmegghijklmnop,bcbegghijklmnop,bcbegghijklmnoj,bcbegghijklmnoe","bcdefghijklmnop,bcdefghijbldnop,bcdefghijblmnop,bcdefghijblbnop,bcdefghijfldnop,bcdefghijflmnop,bcdefghijflbnop,bcdefghijeldnop,bcdefghijelmnop,bcdefghijelbnop,bcdefghijgldnop,bcdefghijglmnop,bcdefghijglbnop,bcdefghijhldnop,bcdefghijhlmnop,bcdefghijhlbnop,bcdefghijkldnop,bcdefghijklbnop,bcdefghijblbnoj,bcdefghijflbnoj,bcdefghijelbnoj,bcdefghijglbnoj,bcdefghijhlbnoj,bcdefghijblbnoe,bcdefghijflbnoe,bcdefghijglbnoe,bcdefghijhlbnoe","bcdefghijklmnop,bcdebghijkldnop,bcdebghijklmnop,bcdebghijklbnop,bcdefghijkldnop,bcdefghijklbnop,bcdeeghijkldnop,bcdeeghijklmnop,bcdeeghijklbnop,bcdegghijkldnop,bcdegghijklmnop,bcdegghijklbnop,bcdehghijkldnop,bcdehghijklmnop,bcdehghijklbnop,bcdekghijkldnop,bcdekghijklmnop,bcdekghijklbnop,bcdebghijklbnoj,bcdefghijklbnoj,bcdeeghijklbnoj,bcdegghijklbnoj,bcdehghijklbnoj,bcdebghijklbnoe,bcdefghijklbnoe,bcdegghijklbnoe,bcdehghijklbnoe"}
tops=split",,,,,,,,,,,,,,,12,,14,,10,,14,,12,,9"
-- @end

-- @big (npm run pico8 writes her 32x32 art here)
bigart="33333333333333333333333333333333333333333333333332777733335bbb533325bbb9433307bbb9433304bbbb8433304bbbb8433305bbba533307777633304=7@@=633314>5@@?433324>4@@@433324>4=k|@>k{433324>4=k|@>k{433324>4=k|@>k{433324>4=k|@>k{433324>4@@@433324>4@@@433324>4@kv?433324>4@kv?433324>4@kv?433324>4@kv?433324>4@kuk?433324>4@kv?433324>5?kv?433324=7>kv>53332777743323333333333333333333333333333333333333333333333333307777433326bbb533316bbb9431776bbb9774ba5bbb95a6bb84bbb94b85bb6bbb5b87777776b7@>7@@>776@@5@k{l{?5?604@@=4@nk?4@=504@@=4@k{l{?4@>404@@=4@=k@>4@>404@@=4@@@4@>404?k|?4k|@?k{4>k|=404?k|?4k|@?k{4>k|=404?k|?4k|@?k{4>k|=404?k|?4k|=ltk=k{4>k|=404@k@4=k>kv>k4?k>404@@=4@kv?4@>404@@=4@kv?4@>404@@=4@kuk?4@>404@@=4@kv?4@>404@@=4@kv?4@>405@?6?ltk>6@507777777603333333333333333333fe333333+ffd,33329fffd83332+8fd8ff3332ffffc3332e8ff8f3332fe+ff+3332fffd+c83332c8fffe3332f8fff3332fffe8+33330ff+f33332fffc33332fffc33332+8ffc9333330ffc333332+8fc8+333332,fc,33333309h833333328j3333332jg3333332jg3333332jg33333328j33333329h83333333i33333330i33333330i333333308h333333308h3332333333333333333333333333333333333333333333333333333333333333333333333333333333333ffffc3332f+ffc8fd332ffffd+d331ff8fc+fe331e+fd+fff330ffffff33fc0+8ffc9c2c33c2c1ffe0c2c33c2c1d8fc8d0c2c33c2c1ffe0c2c33c31c0cb8c32c33c31c18jd8f333f8d0jgci+d333ffjgchf333d+cicjgc0c2c333fcjj1c2c333c30c09h8182c333c30c1i32c33383081i33333330i333333308h333333308h33323333333333333333333333333333333333333333333333333333333333333333333333333333333330g33333333i33333333g33333330ji33jg333ji32g3333g1g1h31jg3330g30h2jg0g3331g30jjg2g3330g1jjg31g3333jjg31g3332h2b831g3332g38j333331g3jjg33331g3jjh33331i0jg3g33331jjg3g33331g29h83333333i33333330i33333330i333333308h333333308h3332333333333332,33333330f3333331fe+333333c+fc+333333ff3333338fc+c3333308fff+33331fd8fd+33331fffd33331fffd3332fd+fd8fc+333ffffe+333f8fffc8c3338fffc+fc332ffd+ffd+331fffffd331c8e+fffd+c331ff8fffc3308fffffd+33ffcb8fe8c+33e+fc8je+fd33ffcjgffd33c0d0d0fe0d0d0d338090908jg809090933338jg33333329h83333333i33333330i33333330i333333308h33333339h3332333333333333333333333333333333333333333333333333333333333333333333333333332g333333282g830h33333g1g2g0h3333308i28h3333330h3g333330jh3j3g3332j2j80i333308h2j1g33308h3i1i1h3333g2j0h1i33330g8g0jh0i833331jjj333330ji9g3333328jh3333331jh3333332jg33333318jg33333329h83333333i33333330i33333330i333333308h33333339h33323333333333333333333333333333333333333333333333333333333333333333333331d33333331cg0f30fd30fd2cg0f30fd30ffdg0chc30fd30ehdhcgegc30egd2gcgdhdhf0ge3c0gfchejhfcgd1c0d0gegchc1gdjgdid0gcjgcjgd2fe30c0gcgfcgdhd0fff1c1cgfjdgejgdjh2cgf0h0dgf0fcichc1cieh0fc0ehfdh3iehfdgehd0c1e2fjgfcicicgcjc1fdjcgeichdjhc1c0hfejhffegc1c2c30c8jg0c1c1c1e33319h83c32c3332i30c333332i33333330i333333308h33333339h3332333333333332&33333331(s3333333*s3333333)3333333&0c0&3333332+f3333331ff3333338fc+c3333308fe:e+33331d:d8c:e+33331d:ffd33331fffd3332fd+c:e8:e+333c:fc:f:e+333c:c8fdxfc8c3338fxfxc+cxd332fdxc(fdxd+331ffc(ffe331xd(ff(f+c331xd(d8fc(fd3308fffffd+33ffcb8fe8c+33d(fc8je+c(e33d(fcjgfc(e33c0d0d0fe0d0d0d338090908jg809090933331i33333330i33333330i333333308h33333339h333233333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333077776s63304ffffcscsc43304f8d+f8c+esd43304ffffdsd43304e+d&d8c+d&esd43304fffffc433077777633"
-- @end big

-- her big art (32x32): pictures 0-7
-- are on the bottom half of the
-- sprite sheet; the rest are in
-- bigart, unpacked once into extra
-- sprite sheets in upper memory
-- (0x8000, then 0xa000), 16 each
alpha="0123456789abcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~"
function load_big()
 local lut,p={},0
 for i=1,#alpha do lut[sub(alpha,i,i)]=i-1 end
 for i=1,#bigart do
  local v=lut[sub(bigart,i,i)]
  local c=v\4
  for k=0,v%4 do
   if c>0 then
    local cell,q=p\1024,p%1024
    -- draw into that sheet
    poke(0x5f55,cell<16 and 0x80 or 0xa0)
    cell%=16
    pset(cell%4*32+q%32,cell\4*32+q\32,c)
   end
   p+=1
  end
 end
 poke(0x5f55,0x60) -- back to the screen
end
load_big()

-- draw big picture n
-- with its top left at x,y
function bigspr(n,x,y)
 local sx,sy=n%4*32,64+n\4*32
 if n>7 then
  n-=8
  poke(0x5f54,n<16 and 0x80 or 0xa0)
  sy=n%16\4*32
 end
 shade(sx,sy,32,x,y)
 sspr(sx,sy,32,32,x,y)
 poke(0x5f54,0)
end

-- a shadow on the ground, falling
-- left: the w x w picture at sx,sy
-- flattened, in dark blue (1),
-- drawn under it. the colors in use
-- are kept at 0x4300 meanwhile
function shade(sx,sy,w,x,y)
 local h=(w+40)\24 -- 3 rows tall; 2 for a bush
 memcpy(0x4300,0x5f00,16)
 for i=1,15 do pal(i,1) end
 sspr(sx,sy,w,w,x-w\4,y+w-h,w,h)
 memcpy(0x5f00,0x4300,16)
end

-- random looks for the people:
-- each part's color is swapped
-- for one of these colors
looks={
 hair=split"1,2,4,5,6,7,9,10",
 clothes=split"1,2,3,8,9,11,12,13,14",
}
skins={{15,12},{15,1},{9,1},{4,1},{15,3}} -- skin, eyes
-- (dark skin: dark blue eyes)

-- sounds (sfx editor): 0 bless,
-- 1 pick up, 2 level up, 3 gift
-- box, 4 missed, 5 big need.
-- music notes go in sfx 8 and up.

-- seasons: deacons' vestments
-- follow the church year
-- the ground each season, from
-- pico-8's hidden colors: lime,
-- green, tan, snowy grey (white
-- flakes fall on it). her leaves
-- are color 3, so not that
grounds=split"138,139,134,6"
-- building colors to pick from
-- (not 15 or 7: her windows and
-- doors use those)
walls=split"13,6,9,12,14,4"
roofs=split"2,8,4,5,12,3"
vests=split"7,11,11,2" -- white, green, green, purple

cartdata("sdcason_blessed")

function _init()
 -- the season comes first: it
 -- changes the trees and flowers
 season=flr(rnd(4))+1
 make_town()
 p={x=256,y=272,spd=1,r=14,cd=0,b=0,
  rate=45,fl=false,fast=0,mag=14}
 people={} fx={} drops={}
 helpers={} graces={} items={}
 deacons=0 church=0 dcd=0
 dlooks={} cdlooks={}
 chap=false bishop=false cath=false
 relics=false garden=0 pow=1
 -- combos start off each day (got,
 -- below: most are just got["name"])
 van=false had_coffee=false
 -- the hospital: a number of sick
 -- people that grows all day
 hosp_need=0 hosp_priests=0 sick_healed=0
 patience=1 popemode=false
 chapel=false chapel_relic=false
 chapel_deacons=0 ccd=0
 -- grace left at the church and
 -- hospital waits there for you
 church_pile=0 hosp_pile=0
 got={} -- combos taken this day
 lv={} -- level of each upgrade
 score=0 xp=0 need=3 lvl=1
 lost={0,0,0} lost_t=0 lost_c=0 -- time lost
 car_c,car_r=rnd(split"8,9,10,11,12,14,6,13"),rnd(roofs)
 t=0 missed=0 msg="" msg_t=0
 state="play" page=1
 -- some days are nights
 night=rnd(4)<1
 -- the start screen, when the
 -- game is first switched on
 if not booted then booted=true state="title" end
 angel_t=0
 -- her song: music pattern 0 on,
 -- using channels 0-2 (mask 7) so
 -- channel 3 stays free for the
 -- sound effects. a new day puts the
 -- song back to normal speed
 reload(0x3200,0x3200,0x1100) hurry=false
 music(0,0,7)
 for i=1,8 do drop_item(rnd(world),rnd(world)) end
end

-- upgrades: name, what it does,
-- most times you can take it
-- (when each can show up: ready(),
-- below the combos)
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
  f=function() church=3 cath=true end},
 {n="bishop",d="ordain a priest to help",max=5,
  f=function() bishop=true add_helper(false) end},
 {n="marian garden",d="more come to pray",max=3,
  f=function() garden+=1 end},
 {n="church deacon",d="blesses at the church",max=4,
  f=function() deacons+=1 add(dlooks,new_look"deacon") end},
 {n="church relics",d="the church heals too",max=1,
  f=function() relics=true end},
 -- the hospital path
 {n="chaplain",d="bless the sick there",max=1,
  f=function() chap=true end},
 {n="hospital priest",d="blesses the sick for you",max=3,
  f=function() hosp_priests+=1 add_helper(true) end},
 {n="hospital chapel",d="people come to pray",max=1,
  f=function()
   chapel=true
   add(bldg,{x=chapel_x,y=chapel_y,s=1,k="chapel",
    wc=hosp_wc,rc=hosp_rc}) -- matches the hospital
  end},
 {n="chapel relic",d="draws more; heals",max=1,
  f=function() chapel_relic=true end},
 {n="chapel deacon",d="blesses at the chapel",max=2,
  f=function() chapel_deacons+=1 add(cdlooks,new_look"deacon") end},
}

function l(n) return lv[n] or 0 end

-- characters: who you play. s,w:
-- standing and walking drawings.
-- u: how to unlock (saved for good)
chars={
 {n="priest",s=0,w=6,d="the parish priest"},
 {n="benedictine",s=28,w=30,d="people wait longer",
  u="30 or fewer missed in a day"},
 {n="dominican",s=60,w=62,d="garden; more rosaries",
  u="marian garden 3 times in a day"},
 {n="franciscan",s=64,w=66,d="starts as chaplain",
  u="bless 50 sick in a day"},
 {n="eastern monk",s=68,w=70,d="starts with an angel",
  u="find 3 combos"},
 {n="cardinal",s=88,w=90,d="starts with a cathedral",
  u="build the cathedral"},
 {n="pope",s=92,w=94,d="blesses all, each minute",
  u="bless 500 in a day"},
 {n="java priest",s=50,w=50,d="faster; coffee lasts longer",
  u="take drive-through"},
 {n="saintly priest",s=52,w=52,d="blesses farther and faster",
  u="find all 13 combos"},
}
-- who: the character you play
-- (the last one you played)
who=max(1,dget(3))
-- players 2-4 (by controller,
-- 1-3): joined on the start screen
xs={}
-- each player's color: green,
-- blue, pink, orange (circle,
-- number over the head)
pc=split"11,12,14,9"

function unlocked(i) return i==1 or dget(2)&(1<<i)>0 end

-- high scores: dget(10..14) the top 5
-- scores, dget(15..19) their
-- initials (3 letters in one number)
abc="abcdefghijklmnopqrstuvwxyz"
function initials(v)
 local s=""
 for k in all({v\1024,v\32%32,v%32}) do s..=sub(abc,k,k) end
 return s
end
function top5(x,y,c)
 for i=1,5 do
  if dget(9+i)>0 then
   local v=dget(9+i)
   local s=i.." "..initials(dget(14+i)).." "..v\1 .." "
   -- the characters played: p priest,
   -- b benedictine, d dominican,
   -- f franciscan, e eastern monk,
   -- c cardinal, + pope, j java,
   -- s saintly (one per player, 4
   -- at most)
   for i=1,4 do
    v*=16 s..=split" ,p,b,d,f,e,c,+,j,s"[v%16\1+1]
   end
   print(s,x,y+i*7,c)
  end
 end
end

-- how many combos you've ever found
function found()
 local f=0
 for i=1,#combos do if dget(1)&(1<<i)>0 then f+=1 end end
 return f
end

-- end of the day: anything new?
function check_unlocks()
 local f=found()
 local won={false,missed<=30 and score>=50,l"marian garden">=3,
  sick_healed>=50,f>=3,cath,score>=500,got["drive-through"],f>=#combos}
 newchar=nil
 for i=2,#chars do
  if won[i] and not unlocked(i) then
   dset(2,dget(2)|(1<<i)) newchar=chars[i].n
  end
 end
end

-- your character's head start
function start_skill()
 -- who: 2 benedictine, 3 dominican,
 -- 4 franciscan, 5 eastern monk,
 -- 6 cardinal, 7 pope, 8 java
 -- priest, 9 saintly priest
 patience=who==2 and 1.5 or 1
 if who==3 then garden=1 lv["marian garden"]=1 end
 if who==4 then chap=true lv["chaplain"]=1 end
 if who==5 then lv["guardian angel"]=1 p.mag+=10 end
 if who==6 then
  church=3 cath=true lv["fix the church"]=2 lv["cathedral"]=1
  bishop=true lv["bishop"]=1 add_helper(false)
 end
 popemode=who==7
 if who==8 then p.spd=1.25 end
 if who==9 then p.r=21 p.rate=33 end
end

-- combos: two upgrades that work
-- together. a combo shows up (gold)
-- once you have what it needs.
-- the ones you've ever found are
-- saved, so players can collect them.
combos={
 {n="aspergillum",r="holy water 3 + quick hands 3",h="holy water",d="each blessing counts 2",
  f=function() pow=2 end},
 {n="parish van",r="a car 2 + guardian angel 2",h="a car",d="priests ride, angel x2",
  f=function() van=true p.mag*=2 end},
 {n="cathedral chapter",r="cathedral + bishop",h="cathedral",d="church grace comes to you"},
 {n="rosary group",r="garden + 2 church deacons",h="marian garden",d="all grace comes, often"},
 {n="healing relics",r="church relics + chaplain",h="church relics",d="the hospital heals too"},
 {n="house calls",r="a car + quick hands 2",h="quick hands",d="house blessings take half"},
 {n="pilgrimage",r="marian garden + chapel",h="marian garden",d="church & chapel: grace x2"},
 {n="procession",r="church relics + chapel relic",h="chapel relic",d="each minute: bless walkers"},
 {n="deacons' rounds",r="church deacon + chapel deacon",h="chapel deacon",d="deacons bring piles to you"},
 {n="sick calls",r="a car + hospital priest",h="hospital priest",d="hospital priests go out"},
 {n="drive-through",r="coffee + a car",h="coffee",d="coffee lasts twice as long"},
 {n="anointing",r="chaplain + quick hands",h="chaplain",d="hospital blessings count 2"},
 {n="catholic hospital",r="bishop + hospital priest",h="bishop",d="bishop's priests heal too"},
}

-- which upgrades can show up, and
-- which combos are ready (in the
-- same order as ups and combos)
function ready()
 return {true,true,true,true,true,church>=2 and relics,cath,church>0,garden>0,deacons>0,true,chap,hosp_priests>0,chapel,chapel},{
  l"holy water">=3 and l"quick hands">=3,
  l"a car">=2 and l"guardian angel">=2,
  bishop,
  garden>0 and deacons>=2,
  relics and chap,
  l"a car">0 and l"quick hands">=2,
  garden>0 and chapel,
  relics and chapel_relic,
  deacons>0 and chapel_deacons>0,
  l"a car">0 and hosp_priests>0,
  l"a car">0 and had_coffee,
  chap and l"quick hands">0,
  bishop and hosp_priests>0}
end

-- big needs: they stay in one
-- place; find them (z: map) and
-- stay until the number is 0
events={
 {n="a grieving widow",at="house",need=12},
 {n="a new house to bless",at="house",need=8},
 {n="a wedding",at="church",need=10,s=24,m=74,g="people"},
 {n="a baptism",at="church",need=6,m=46,g="child"},
 {n="a sick child",at="hosp",need=8,s=-10,l="child"},
}

-- the bishop's priests: your priest
-- drawing, each with their own
-- skin and eyes
function add_helper(hosp)
 add(helpers,{x=p.x,y=p.y,cd=0,hosp=hosp,
  ox=rnd(24)-12,oy=rnd(16)-8,look=new_look"priest"})
end

-->8
-- the town

function make_town()
 bldg={}
 -- her buildings get random wall and
 -- roof colors (she designed them in
 -- lavender or grey walls, purple roofs)
 add(bldg,{x=church_x,y=church_y,s=1,k="church",
  wc=rnd(walls),rc=rnd(roofs)})
 hosp_wc,hosp_rc=rnd(walls),rnd(split"2,4,5,12,3") -- no red roof
 add(bldg,{x=hosp_x,y=hosp_y,s=1,k="hosp",wc=hosp_wc,rc=hosp_rc})
 -- keep these spots clear of houses:
 -- where you start, the marian
 -- garden, the hospital chapel
 add(bldg,{x=256,y=260})
 add(bldg,{x=church_x+30,y=church_y})
 add(bldg,{x=chapel_x,y=chapel_y})
 for i=1,40 do
  local x,y=16+rnd(world-48),16+rnd(world-48)
  if free(x,y) then
   -- one of 4 kinds of house, in
   -- its own wall and roof colors
   add(bldg,{x=x,y=y,s=1,k="house",
    v=flr(rnd(4))+1,wc=rnd(walls),rc=rnd(roofs)})
  end
 end
 -- bushes all year; lilies in
 -- spring, pumpkins in fall
 local small={41,42,43}
 if season==1 then add(small,44) add(small,44) end
 if season==3 then add(small,45) add(small,45) end
 decor={}
 for i=1,150 do
  add(decor,{x=rnd(world),y=rnd(world),s=rnd(small)})
 end
 -- big trees, as tall as a house.
 -- k: 1,2,6 leafy (bare in winter:
 -- 3 or 5), 4 a pine (some are
 -- christmas trees in winter)
 trees={{x=church_x-22,y=church_y+15,k=4,xmas=true}}
 for i=1,60 do
  local x,y=rnd(world),rnd(world)
  if free(x-8,y-16) then
   add(trees,{x=x,y=y,k=rnd(split"1,2,4,6"),
    bare=rnd({3,5}),xmas=rnd(1)<.3})
  end
 end
end

-- room for a building at x,y?
-- (buildings are 32x32: 4 people tall)
function free(x,y)
 for b in all(bldg) do
  if abs(b.x-x)<44 and abs(b.y-y)<44 then return false end
 end
 return true
end

-- buildings stop the priest
-- with sprite flag 0
function solid(x,y)
 for b in all(bldg) do
  if b.s and x>b.x-8 and x<b.x+24
   and y>b.y+2 and y<b.y+17 then
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
-- up/down (player pl) steps through
-- the looks character w can have
-- (plooks, worked out by npm run
-- pico8; the first is her drawing's
-- own): one letter per color 1-15,
-- the color it becomes (a = 0)
function pick_look(w,i,pl)
 local L,l=split(plooks[w]),{}
 i=cyc(i or 1,#L,pl,2)
 for c=1,15 do l[c]=ord(L[i],c)-97 end
 return i,l
end

function new_look(g)
 local sk,l,h=rnd(skins),{},rnd(looks.hair)
 -- hair never the skin's color;
 -- yellow hair only with peach skin
 if h==sk[1] or h==10 and sk[1]!=15 then h=1 end
 look_hair=h -- for the top of the head
 local v={skin=sk[1],eyes=sk[2],hair=h,vestment=vests[season]}
 for c,k in pairs(parts[g]) do
  l[c]=v[k] or looks[k] and rnd(looks[k])
 end
 return l
end

-- kinds: walk (comes to you),
-- home (waits at home), church
-- (walks to mass, waits there),
-- sick (at the hospital)
function person(x,y,k)
 local q={x=x,y=y,k=k,s=rnd(split"16,18,20,22,24,26"),
  look=new_look"people",need=1,hit=0,
  wait=(900+rnd(300))*patience,spd=.2+rnd(.2)}
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
 local b=rnd(bldg)
 if abs(wd(b.x,p.x))<100 and abs(wd(b.y,p.y))<100 then
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
 if got["house calls"] then q.need=ceil(q.need/2) end
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
 else
  local c=e.at=="church"
  x,y=(c and church_x or hosp_x)+2+rnd(12),(c and church_y or hosp_y)+30
 end
 local q=person(x,y,"event")
 q.need=e.need+lvl\2 q.wait=1800 q.ev=e.n
 -- a wedding's bride, a baptism's
 -- child: stands beside them (m)
 q.s=e.s or q.s -- -10: the child (46) standing
 if e.l then q.look=new_look(e.l) end
 if e.m then q.m,q.ml=e.m,new_look(e.g) end
 if b then q.b=b b.who=q end
 say(e.n.."! (z: map)")
 sfx(5)
end

function spawn_church()
 -- pilgrims go to the chapel too
 if got.pilgrimage and rnd(1)<.5 then spawn_chapel() end
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
 if got.anointing then n*=2 end
 n=min(n,hosp_need)
 if n<=0 then return end
 hosp_need-=n score+=n sick_healed+=n
 hosp_pile+=n
 splash(hosp_x+8,hosp_y+8,10)
 add(fx,{x=hosp_x+8,y=hosp_y-4,t=20,s="\143",c=10})
 sfx(0)
end

-- one blessing for one person
function hit(q)
 -- (the time between blessings comes
 -- back: their wait stops while
 -- you bless them)
 q.need-=pow q.hit=4 q.wait+=p.rate
 if q.need>0 then return end
 del(people,q) score+=1
if by then by.b+=1 end
 if q.b then q.b.who=nil end
 local v=1
 if q.ev then v=10 elseif q.k=="home" then v=3
 elseif got.pilgrimage and q.tx then v=2 end
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
-- waited too long. only needs on
-- the map cost time: a house
-- blessing, or a big need (3x).
-- walkers and churchgoers just go.
function miss(q)
 del(people,q) missed+=1
 if q.b then q.b.who=nil end
 if q.ev then lose(miss_cost*3,3,q.ev.." was missed")
 elseif q.k=="home" then lose(miss_cost,1,"a house blessing was missed") end
end

-- lose c seconds (kind k: 1 house,
-- 2 hospital, 3 big need); the clock
-- flashes and says why
function lose(c,k,why)
 t+=c*30 lost[k]+=c lost_t=60 lost_c=c
 say(why) sfx(4)
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

-- a blessing: water splashes out to
-- r, and everyone in reach (only
-- kind k, if given) is blessed
function sb(x,y,r,k)
 splash(x,y,r) bless(x,y,r,k)
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
  k=rnd({"rosary","bucket","coffee","coffee",
   who==3 and "rosary" or "coffee"})})
end

function use(k)
 sfx(1)
 if k=="chest" then
  sfx(3) offer"a gift box!"
 elseif k=="rosary" then
  for g in all(graces) do g.pull=true end
  say"rosary: all grace comes"
 elseif k=="bucket" then
  for q in all(people) do
   if not q.ev then q.need=1 end
  end
  sb(p.x,p.y,90)
  say"holy water for everyone!"
 elseif k=="coffee" then
  had_coffee=true
  p.fast=(got["drive-through"] and 600 or 300)*(who==8 and 1.5 or 1)
  say"coffee! go go go"
 end
end

function say(s) msg=s msg_t=90 end

function offer(title)
 local pool={}
 local can,k=ready()
 for i,u in pairs(ups) do
  if l(u.n)<u.max and can[i] then
   add(pool,u)
  end
 end
 choices={}
 -- a combo that's ready comes first
 for i,c in pairs(combos) do
  if not got[c.n] and k[i] and #choices==0 then
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

-- left/right (for player pl) steps
-- v round 1..n
function cyc(v,n,pl,a)
 -- left/right; a=2: up/down
 a=a or 0
 if btnp(a,pl) then v-=1 end
 if btnp(a+1,pl) then v+=1 end
 return (v-1)%n+1
end

function _update()
 if state=="title" then
  -- left/right: who you play
  who=cyc(who,#chars)
  -- up/down: your look
  li1,lk1=pick_look(who,li1)
 -- players 2-4: x on their own
 -- controls joins (or leaves),
 -- left/right picks from the
 -- unlocked characters
 for i=1,3 do
  if btnp(5,i) then xs[i]=not xs[i] and {w=1,n=i} or nil end
  local o=xs[i]
  if o then
   repeat o.w=cyc(o.w,#chars,i) until unlocked(o.w)
   o.li,o.lk=pick_look(o.w,o.li,i)
  end
 end
  if btnp(5) then
   if unlocked(who) then
    dset(3,who) _init() start_skill() state="play"
   for _,o in pairs(xs) do o.x,o.y,o.cd,o.b=p.x+9*o.n,p.y,0,0 end
   else sfx(4) end
  elseif btnp(4) then book_from="title" state="book" end
  return
 end
 -- initials: up/down change the
 -- letter, x takes it; after the
 -- third, the score is saved
 if state=="name" then
  if btnp(2) then nl[ni]=nl[ni]%26+1 end
  if btnp(3) then nl[ni]=(nl[ni]-2)%26+1 end
  if btnp(5) then ni+=1 end
  if ni>3 then
   -- slide the lower scores down
   local i=5
   while i>1 and score>dget(8+i) do
    dset(9+i,dget(8+i)) dset(14+i,dget(13+i)) i-=1
   end
   -- the characters are saved in the
   -- score's fraction: who/16, then
   -- players 2-4 /256, /4096, /65536
  local v=score+who/16 for _,o in pairs(xs) do v+=o.w>>4+4*o.n end
   dset(9+i,v) dset(14+i,nl[1]*1024+nl[2]*32+nl[3])
   state="over"
  end
  return
 end
 if state=="over" then
  if btnp(4) then book_from="over" state="book"
  elseif btnp(5) then _init() state="title" end
  return
 end
 if state=="map" then
  if btnp(4) then state="play"
  elseif btnp(5) then book_from="map" state="book" end
  return
 end
 if state=="book" then
  page=cyc(page,5) -- 2 pages of upgrades, 3 of combos
  if btnp(4) or btnp(5) then state=book_from end
  return
 end
 if state=="pick" then
  -- any arrow moves (and wraps around)
  pick=cyc(cyc(pick,#choices),#choices,nil,2)
  if btnp(4) or btnp(5) then
   local u=choices[pick]
   lv[u.n]=l(u.n)+1
   if u.combo then
    got[u.n]=true
    -- remember it for good
    for i=1,#combos do
     if combos[i]==u then dset(1,dget(1)|(1<<i)) end
    end
   end
   ;(u.f or l)() state="play" -- most combos have no f
  end
  return
 end
 if btnp(4) then state="map" return end

 t+=1
 -- last minute: the music hurries
 -- (her song's notes play faster)
 if not hurry and t>=(day_len-60)*30 then
  hurry=true say"one minute left!"
  for i=8,63 do
   local a=0x3200+i*68+65
   poke(a,max(1,peek(a)*3\4))
  end
 end
 if t>=day_len*30 then
  state="over" check_unlocks()
  -- in the top 5? enter initials
  if score>dget(14) then state="name" ni=1 nl={1,1,1} end
  return
 end

 -- walk (coffee doubles it)
 local dx,dy=dir(p)
 local sp=p.spd
 if p.fast>0 then sp*=2 p.fast-=1 end
 local nx,ny=(p.x+dx*sp)%world,(p.y+dy*sp)%world
 if not solid(nx,p.y) then p.x=nx end
 if not solid(p.x,ny) then p.y=ny end

-- players 2-4: walk on your
-- screen and bless as far as you
for _,o in pairs(xs) do
 local dx,dy=dir(o,o.n)
 o.x=(p.x+mid(-60,wd(o.x+dx*sp,p.x),60))%world
 o.y=(p.y+mid(-52,wd(o.y+dy*sp,p.y),60))%world
 o.cd-=1
 if o.cd<=0 then o.cd=p.rate by=o sb(o.x,o.y-4,p.r) by=nil end
end

 -- who asks, and how often
 -- (crowds come faster for the pope)
 if t%max(8,(40-t\900)*(popemode and .7 or 1)\1)==0 then spawn_walker() end
 -- the pope blesses everyone on
 -- screen, once a minute
 if popemode and t%1800==0 then
  sb(p.x,p.y,90) say"urbi et orbi!"
 end
 if t%240==0 then spawn_home() end
 if t%max(20,150-church*20-garden*20)==0 then spawn_church() end
 -- the sick: more as the day goes on.
 -- once you're chaplain, the ones
 -- (up to 9)
 if t%max(60,150-t\60)==0 then
  if hosp_need<9 then hosp_need+=1 end
 end
 -- a full hospital (once you're
 -- chaplain) costs 5 s every 10 s
 if chap and hosp_need>=9 and t%300==0 then
  missed+=1 lose(miss_cost,2,"the hospital is full!")
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
 -- walkers head for the nearer player
 local o=touch(q,60)
 if not o or near(q.x,q.y,p.x,p.y,40) then o=p end
  local tx,ty=o.x,o.y
  if q.tx then tx,ty=q.tx,q.ty end
  if q.k=="walk" or q.tx then
   if not near(q.x,q.y,tx,ty,6) then
    step(q,tx,ty,q.spd)
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
 by=p
  sb(p.x,p.y-4,p.r)
 by=nil
  -- at the hospital, as chaplain
  if chap and near(p.x,p.y,hosp_x+8,hosp_y+20,p.r+14) then
   heal(pow)
  end
 end

 -- deacons bless at the church and
 -- the chapel (more deacons: faster)
 dcd=deacon(deacons,dcd,church_x,church_y,"church")
 ccd=deacon(chapel_deacons,ccd,chapel_x,chapel_y,"chapel")

 -- relics: the church (and with
 -- the combo, the hospital) heals
 if t%120==0 then
  if relics then bless(church_x+8,church_y+22,24,"church") end
  if chapel_relic then bless(chapel_x+8,chapel_y+24,24,"chapel") end
  if got["healing relics"] then heal(1) end
 end
 if got["rosary group"] and t%900==0 then
  for g in all(graces) do g.pull=true end
  say"rosary group: grace comes"
 end

 -- piles: go there to collect them
 if got.procession and t%1800==0 then
  for q in all(people) do
   if q.tx and not q.there then q.need=1 hit(q) end
  end
  say"procession: walkers blessed"
 end
 if got["cathedral chapter"] or got["deacons' rounds"] or near(p.x,p.y,church_x+8,church_y+24,22) then
  if church_pile>0 then xp+=church_pile church_pile=0 sfx(1) end
 end
 if got["healing relics"] or got["deacons' rounds"] or near(p.x,p.y,hosp_x+8,hosp_y+24,22) then
  if hosp_pile>0 then xp+=hosp_pile hosp_pile=0 sfx(1) end
 end

 for h in all(helpers) do helper(h) end

 -- grace: walk near it to pick it up
 for g in all(graces) do
  if g.pull or near(g.x,g.y,p.x,p.y-4,p.mag) then
   step(g,p.x,p.y-4,3)
  end
  -- either player picks it up
 if near(g.x,g.y,p.x,p.y-4,5) or touch(g,6) then
   del(graces,g) xp+=g.v sfx(1)
   -- the angel brought it
   if g.pull or l"guardian angel">0 then angel_t=30 end
  end
 end

 for it in all(items) do
 if near(it.x,it.y,p.x,p.y-4,8) or touch(it,8) then
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

-- the arrows of controller n:
-- which way, and o faces that way
function dir(o,n)
 local dx,dy=tonum(btn(1,n))-tonum(btn(0,n)),tonum(btn(3,n))-tonum(btn(2,n))
 if dx!=0 then o.fl=dx<0 end
 o.mv=dx!=0 or dy!=0
 return dx,dy
end

function deacon(n,cd,x,y,k)
 if n>0 then
  cd-=1
  if cd<=0 then cd=max(15,70-n*15) sb(x+8,y+23,24,k) end
 end
 return cd
end

-- move o toward tx,ty (the short
-- way round the town)
function step(o,tx,ty,sp)
 local a=atan2(wd(tx,o.x),wd(ty,o.y))
 o.x=(o.x+cos(a)*sp)%world
 o.y=(o.y+sin(a)*sp)%world
 o.fl=cos(a)<0 o.mv=true
end

-- the nearest thing in list that ok() likes
function closest(list,o,ok)
 local tg,best
 for q in all(list) do
  local d=abs(wd(q.x,o.x))+abs(wd(q.y,o.y))
  if ok(q) and (not tg or d<best) then tg,best=q,d end
 end
 return tg
end

-- which of players 2-4 is
-- touching o?
function touch(o,r)
 for _,x in pairs(xs) do
  if near(o.x,o.y,x.x,x.y-4,r) then return x end
 end
end

function onscreen(q)
 return abs(wd(q.x,p.x))<60 and abs(wd(q.y,p.y))<60
end

-- the bishop's priests: one person
-- (or else one grace) at a time, on
-- your screen. hospital priests
-- stay there and bless the sick;
-- with sick calls they visit homes
-- when the hospital is quiet.
function helper(h)
 h.mv=false
 local tg,tx,ty,r,sp
 -- (catholic hospital: the bishop's
 -- priests go when it's busy)
 if h.hosp or got["catholic hospital"] and hosp_need>3 then
  tx,ty,r,sp=hosp_x+8+h.ox/2,hosp_y+22,3,1.5
  if got["sick calls"] and hosp_need==0 then
   tg=closest(people,h,function(q) return q.k=="home" end)
  end
 else
  tg=closest(people,h,onscreen) or closest(graces,h,onscreen)
  tx,ty,r,sp=p.x+h.ox,p.y+h.oy,4,van and 2 or 1
  -- left behind? hurry back
  if not near(h.x,h.y,p.x,p.y,64) then sp=3 end
 end
 if tg then tx,ty,r=tg.x,tg.y,7 end
 if not near(h.x,h.y,tx,ty,r) then
  step(h,tx,ty,sp)
 else
  h.cd-=1
  if h.cd<=0 then
   h.cd=30
   if tg and tg.v then del(graces,tg) xp+=tg.v sfx(1)
   elseif tg then splash(h.x,h.y-4,6) hit(tg)
   elseif h.hosp and hosp_need>0 then h.cd=60 heal(1) end
  end
 end
end

-->8
-- draw

-- draw what comes next on the
-- side of the wrap nearest you
function at(x,y)
 camera(p.x-64-(wd(x,p.x)+p.x-x),p.y-64-(wd(y,p.y)+p.y-y))
end

-- driving: her car (the parish van
-- with that combo) in today's paint
function drive(o)
 pal(13,popemode and 7 or car_c) pal(2,popemode and 6 or car_r)
 spr((van and 104 or 96)+flr(t/4)%4*2,o.x-8,o.y-14,2,2,o.fl)
 pal()
end

-- her drawing (2 frames), feet at x,y
function sprite(n,x,y,fl)
 spr(n+flr(t/15)%2,x-4,y-8,1,1,fl)
end

-- walking or standing, wearing look
-- (a color swap)
function figure(stand_n,walk_n,moving,x,y,fl,look)
 pal(look or {})
 sprite(moving and walk_n or stand_n,x,y,fl)
 pal()
end

-- a small thing; z=2 draws it
-- twice the size (the coffee mug).
-- grace (32) is her heart, 4 frames
-- from slot 37
function thing(n,x,y,z)
 z=z or 1
 if n==32 then n=37+t\6%4 end
 sspr(n%16*8,n\16*8,8,8,x-4*z,y-4*z,8*z,8*z)
end

-- her drawing for a building
-- (her big pictures by number, in
-- the order of "big" in sprites.json:
-- 0-2 church levels, 3 cathedral,
-- 4 hospital, 5 chapel, 6-9 houses,
-- 10-15 trees 1-6, 16 christmas
-- tree, 17 marian garden)
function art(b)
 if b.k=="church" then return cath and 3 or min(church,2) end
 if b.k=="house" then return 5+b.v end
 return b.k=="hosp" and 4 or 5
end

-- a big tree (4 people tall); in
-- winter leafy trees are bare and
-- some pines are christmas trees
function tree(tr)
 local n=9+tr.k
 if season==4 then
  if tr.k!=4 then n=9+tr.bare
  elseif tr.xmas then n=16 end
 end
 bigspr(n,tr.x-16,tr.y-32)
end

function draw_person(q)
 at(q.x,q.y)
 pal(q.look)
 -- a white flash when blessed
 if q.hit>0 then
  for i=1,15 do pal(i,7) end
  q.hit-=1
 end
 -- walking, or standing still
 local n=q.s
 if (q.there or not q.tx) and q.k!="walk" then
  n=q.s+56
 end
 sprite(n,q.x,q.y,q.fl)
 pal()
 if q.m then pal(q.ml) sprite(q.m,q.x+7,q.y,q.fl) pal() end
 -- a big need glows
 if q.ev and t%16<10 then circ(q.x+(q.m and 3 or 0),q.y-4,q.m and 10 or 7,9) end
 -- "+" asks for a blessing; a number
 -- is how many more it needs
 if q.wait>300 or t%8<4 then
  local y=q.y-15
  if q.ev then print(q.need,q.x-3,y-2,9)
  elseif q.need>1 then print(q.need,q.x-3,y,12)
  else print("+",q.x-1,y,7) end
 end
end

function draw_map()
 -- the whole town at 1/4 size
 cls(3)
 -- houses in their colors; a white
 -- cross for the church, a red one
 -- for the hospital
 for b in all(bldg) do
  local x,y=(b.x+8)\4,b.y\4
  if b.k=="church" then
   rectfill(x-1,y-5,x+1,y+5,7) rectfill(x-4,y-2,x+4,y,7)
  elseif b.k=="hosp" then
   rectfill(x-1,y-4,x+1,y+4,8) rectfill(x-4,y-1,x+4,y+1,8)
  elseif b.k=="house" then
   rectfill(x-3,y-3,x+3,y+2,b.wc)
  end
 end
 for q in all(people) do
  -- red in its last 5 seconds
  local c=q.wait<300 and 8 or 7
  if q.ev then print("\146",q.x/4-3,q.y/4-2,t%10<5 and 9 or c)
  elseif q.k=="home" then print("\138",q.x/4-3,q.y/4-2,t%10<5 and 10 or c) end
 end
 -- you: a blue dot that pulses (blue,
 -- like "you" under the map)
 circfill(p.x/4,p.y/4,t%20<10 and 2 or 3,12)
 -- the legend, then the buttons
 rectfill(0,112,127,127,1)
 print("\fcyou  \fa\138 house  \f9\146 need",2,114)
 print("\142 back   \151 book",2,121,6)
end

-- the book of blessings: every
-- upgrade, and the combos you've
-- found (the rest show a hint)

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
 print("\139\145 page "..page.."/5        \142 back",4,121,6)
end

-- the start screen
function draw_title()
 -- sky and a green hill to stand on
 cls(12)
 circfill(64,150,90,3)
 -- falling grace
 print("\^w\^tblessed!",33,21,1)
 print("\^w\^tblessed!",32,20,10)
 -- who you'll play, big (a dark
 -- shape until unlocked)
 local c,u=chars[who],unlocked(who)
 local n=c.s+flr(time()*2)%2
 pal(lk1)
 if not u then for i=1,15 do pal(i,1) end end
 sspr(n%16*8,n\16*8,8,8,48,38,32,32)
 pal()
 print("\139         \145",38,52,7)
 -- up/down: your look
 print("\148",60,33,6) print("\131",60,71,6)
 -- every few seconds: the top 5;
 -- otherwise the character's skill,
 -- or how to unlock them
 if time()\4%2==1 and dget(10)>0 then
  rectfill(30,73,97,111,1)
  top5(38,70,10)
 else
  print(c.n,64-#c.n*2,76,10)
  local d=u and c.d or c.u
  if not u then print("to unlock:",44,84,6) end
  print(d,64-#d*2,u and 84 or 90,7)
 end
 print("\151 start   \142 book",26,114,7)
-- players 2-4, small, at the
-- sides (x on their controls)
for i=1,3 do
 local x,y,o=i%2*84+10,i\3*24+40,xs[i]
 print("p"..i+1 ..(o and "" or ":\151"),x+2,y-7,o and pc[i+1] or 6)
 if o then
  local n=chars[o.w].s
  pal(o.lk) sspr(n%16*8,n\16*8,8,8,x,y,16,16) pal()
 end
end
end

function _draw()
 pal()
 if state=="title" then draw_title() return end
 if state=="map" then draw_map() return end
 if state=="book" then draw_book() return end
 -- the ground: color 0, shown as
 -- this season's ground color
 cls(0)
 camera(p.x-64,p.y-64)
 for d in all(decor) do
  at(d.x,d.y) shade(d.s%16*8,d.s\16*8,8,d.x,d.y) spr(d.s,d.x,d.y)
 end
 for b in all(bldg) do
  at(b.x,b.y)
  if b.s then
   -- drawn at twice the size, its
   -- door where the 16x16 one was
   -- her walls (13 houses, 6 church
   -- and hospital) and roof (2)
   pal(13,b.wc) pal(6,b.wc) pal(2,b.rc)
   bigspr(art(b),b.x-8,b.y-16)
   pal()
   if b.who and t%20<14 then print("\138",b.x+5,b.y-22,b.who.wait<300 and 8 or b.who.ev and 9 or 10) end
  end
 end
 for tr in all(trees) do at(tr.x,tr.y) tree(tr) end
 at(church_x,church_y)
 -- the marian garden, beside the church
 if garden>0 then
  bigspr(17,church_x+26,church_y-16)
 end
 -- grace piled up, waiting for you
 if church_pile>0 then
  thing(32,church_x+8,church_y+26)
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
  figure(4,0,false,chapel_x+i*6,chapel_y+24,false,cdlooks[i])
 end
 if hosp_pile>0 then
  thing(32,hosp_x+8,hosp_y+26)
  print(hosp_pile,hosp_x+12,hosp_y+24,10)
 end
 camera(p.x-64,p.y-64)
 circ(p.x,p.y-4,p.r,11)

 for it in all(items) do
  at(it.x,it.y)
  local s=({rosary=34,bucket=35,coffee=36})[it.k] or 33
  thing(s,it.x,it.y+sin(t/40),s==36 and 2)
 end
 for g in all(graces) do at(g.x,g.y) thing(32,g.x,g.y) end
 for q in all(people) do draw_person(q) end
 at(church_x,church_y)
 for i=1,deacons do
  figure(4,0,false,church_x-6+i*6,church_y+22,false,dlooks[i])
 end
 for h in all(helpers) do
  at(h.x,h.y)
  figure(0,6,h.mv,h.x,h.y,h.fl,h.look)
 end
-- players 2-4: their own blessing
-- circle, and the car too
for _,o in pairs(xs) do
 at(o.x,o.y)
 circ(o.x,o.y-4,p.r,pc[o.n+1])
 print(o.n+1,o.x-1,o.y-17,pc[o.n+1])
 if l"a car">0 and o.mv then drive(o)
 else figure(chars[o.w].s,chars[o.w].w,o.mv,o.x,o.y,o.fl,o.lk) end
end
 camera(p.x-64,p.y-64)
 ovalfill(p.x-3,p.y-1,p.x+3,p.y+1,1)
 -- driving: her car (the parish van
 -- with that combo), you inside
 if l"a car">0 and p.mv then
  drive(p)
 else
 -- you: blessing (4 frames, just
 -- after each blessing), walking,
 -- or standing. bishop once you are.
 local st,wk,bl=chars[who].s,chars[who].w,who==1 and 8
 -- the priest dresses as a bishop
 -- once the cathedral is built
 if who==1 and (bishop or cath) then
  st,wk,bl=2,12,56
 end
 local since=p.rate-p.cd
 pal(lk1)
 if bl and since<12 then
  spr(bl+since\3,p.x-4,p.y-8,1,1,p.fl)
 else
  figure(st,wk,p.mv,p.x,p.y,p.fl)
 end
 pal()
 end
-- your number over your head
print(1,p.x-1,p.y-17,11)
 -- your guardian angel, bringing grace
 if angel_t>0 then
  angel_t-=1
  spr(84+flr(t/4)%4,p.x+(p.fl and -12 or 4),p.y-16,1,1,p.fl)
 end
 for d in all(drops) do
  at(d.x,d.y) pset(d.x,d.y,d.t%2==0 and 12 or 7)
 end
 for f in all(fx) do
  at(f.x,f.y) print(f.s,f.x-#f.s*2,f.y-(30-f.t)/2,f.c)
 end
 camera()

 -- winter: snow falls (it drifts
 -- past as you walk)
 -- spring: showers come and go
 -- (about 40 s of rain, 40 s dry)

 -- off the screen: who's waiting
 -- at home or at the hospital
 -- (and the hospital, filling up)
 -- symbols at the edge: ⌂ a house
 -- blessing, ★ a big need
 local marks={}
 for q in all(people) do
  -- red in its last 5 seconds
  local c=q.wait<300 and 8
  if q.ev then add(marks,{q.x,q.y,c or 9,"\146"})
  elseif q.k=="home" then add(marks,{q.x,q.y,c or 10,"\138"}) end
 end
 -- always: the church (white +) and
 -- the hospital (red +, flashing
 -- while the sick need you)
 add(marks,{church_x+8,church_y+8,7,"+"})
 add(marks,{hosp_x+8,hosp_y+8,chap and hosp_need>0 and t%10<5 and 7 or 8,"+"})
 for m in all(marks) do
  local sx,sy=wd(m[1],p.x)+64,wd(m[2],p.y)+60
  if sx<0 or sx>127 or sy<10 or sy>127 then
   print(m[4],mid(1,sx,121),mid(12,sy,122),m[3])
  end
 end

 -- top bar
 rectfill(0,0,127,7,1)
 print("blessed "..score,2,1,7)
 local left=max(0,day_len-t\30)
 -- the clock flashes red when time is lost
 local lc=10
 if lost_t>0 then
  lost_t-=1 lc=t%8<4 and 8 or 10
  print("-"..lost_c.."s",90,1,8)
 end
 print(left\60 ..":"..sub("0"..left%60,-2),108,1,lc)
 rectfill(0,8,127,9,1)
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
 if state=="name" then
  rectfill(16,40,111,92,1) rect(16,40,111,92,10)
  print("a high score!",38,46,10)
  print(score,64-#tostr(score)*2,56,7)
  for i=1,3 do
   print(sub(abc,nl[i],nl[i]),52+i*6,68,i==ni and 10 or 7)
  end
  print("^",52+ni*6,74,10)
  print("\148\131 letter  \151 next",22,84,6)
 end
 if state=="over" then
  rectfill(12,30,115,104,1) rect(12,30,115,104,10)
  print("the day is done",34,36,10)
  print("blessed: "..score,34,46,7)
  print("missed: "..missed,34,53,6)
  print("best: "..dget(10)\1,34,60,9)
  -- where the time went
 -- each player's blessings
 -- (helpers count in the total only)
 local s="p1 "..p.b.." "
 for _,o in pairs(xs) do s..="p"..o.n+1 .." "..o.b.." " end
 print(s,16,72,12)
  print("combos found: "..found().."/"..#combos,26,83,10)
  if newchar then print("unlocked: "..newchar.."!",64-(#newchar+11)*2,22,10) end
  print("\142 book  \151 play again",18,98,6)
 end
 -- show color 0 as the ground
 -- (set last: pal() resets it).
 -- at night: everything darker but
 -- white, yellow and orange (lit
 -- windows, grace, the clock)
 if night then pal(split"1,130,131,132,133,13,7,136,9,10,139,140,141,141,143",1) end
 pal(0,night and 129 or grounds[season],1)
end
__gfx__
0002220000000000000ddd00000000000006660000000000000222000000000000022200000222000002220000022200000ddd00000000000006660000000000
002fff0000022200007fff00000ddd00006fff0000066600002fff0000022200002fff00002fff00002fff00002fff00007fff00000ddd00006fff0000066600
00f3f300002fff0000f3f300007fff0000f4f400006fff0000f3f300002fff0000f3f3f000f3f30000f3f30000f3f30000f3f300007fff0000f4f400006fff00
002fff0000f3f300007fff0000f3f300006fff0000f4f400002fff0000f3f300002fff10002fff00002fff00002fff00007fff0000f3f300006fff0000f4f400
00017000002fff0000117100007fff0000777900006fff0000017000002fff0000017000000171f000017000000171f000117100007fff0000777900006fff00
000110000001700000111100001171000077a70000777900000110000001700000011000000110000001f0000001100000111100001171000077a70000777900
000f1000000f100000fddd0000fddd0000f9770000f7a700000f10000001f000000f1000000f1000000f1000000f100000fddd0000ddfd0000f977000077f700
00011000000110000001100000011000000220000002200000011000001010000001100000011000000110000001100000011000001101000002200000220200
000ccc0000000000000eee0000000000000aaa0000000000000eee0000000000000ccc0000000000000999000000000000055500000000000005550000000000
00544400000ccc0000544400000eee0000544400000aaa0000544450000eee0000544400000ccc00005444000009990000544400000555000054440000055500
004f4f0000544400054f4f0000544400004f4f0000544400054f4f5000544450004f4f0000544400004f4f000054440000434300005444000043430000544400
0054a400004f4f0005544450054f4f0000549400004f4f0005544400054f4f5000545400004f4f0000545400004f4f0000544400004343000054440000434300
000d70000054a400000370000554445000d17100005494000053770005544400005555000054540000d555000054540000111100005444000011110000544400
000d1000000d7000000310000003700000d11100001d7100000c4c0000537700000a70000055550000d1a100001d550000111100001111000011110000111100
0004e000000e40000004c00000014000004eee0000ee4e00000111000004cc000004100000014000004eee0000ee4e0000455500004555000045550000545500
00033000003030000001100000101000000330000033030000110100000111000003300000303000000330000033030000111100001111000011110001101100
00000000000000000004444000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000000000000000000400004000000000000000000a0a000000000000000000000a0a00000000000000000000000000000000000000000000000000000000000
00000000000a8a000400040409acca000000000009aaaa0000a0a00000a0a00009aaaa0000000000000000000000000000000000000000000009990000000000
00000000001171000040404009aaaa0000044400009aa00009aaaa0009aaaa00009aa0000bbbbbbb03b003b0000000000000000000000000001fff0000099900
00000000001777000004000009aaaa000055550000090000009aa000009aa000000900000bbb3bbbb33b03330000000009000a000000000000f1f100001fff00
00000000001171000a004000009aa00000055500000000000009000000090000000000000bbb3bbb33343343000b30009090a0a000040000001fff0000f1f100
0000000000000000aaa4000000000000000000000000000000000000000000000000000033bb33bb343433430b3333000b000b000099900000ddd000001fff00
00000000000000000a0000000000000000000000000100000001000000010000000100000240024000400400033333300b000b000099900000fdd00000fdd000
0000000000000000000aaaa0000000000000000000aaa7000000000000000000000ddd00000ddd00000ddd00000ddd0000055500000000000005550000000000
000000000000000000afff00000aaaa0007aaa00000000000000000000000000007fff00007fff00007fff00007fff00005fff0000055500005fff0000055500
000999000000000000fcfc0000afff0000000000005fff00000000000000000000f3f3f000f3f30000f3f30000f3f30000fdfd00005fff0000fdfd00005fff00
001fff000009990000afff0000fcfc00005fff0000fcfc000000000000000000007fff10007fff00007fff00007fff00005f5f0000fdfd00005f5f0000fdfd00
00f1f100001fff000001704000afff0000fcfc00005fff0000000000000000000011710000117100001171000011710000755500005f5f0000755500005f5f00
001fff0000f1f10000011f5000017040005fff0000017000000000000000000000111100001111f00011f1000011111f00077000007555000007700000755500
00ddf000001fff00000f1000000f1f5000017000000f1000000000000000000000fddd0000fddd0000fddd0000fddd00000f7000000f7000000f70000007f000
0dd0d00000fdd0000001100000011000000f10000001100000000000000000000001100000011000000110000001100000077000000770000007700000707000
000aaa0000000000000aaa000000000000111100000000000011110000000000000ccc0000000000000eee0000000000000aaa0000000000000eee0000000000
00afff00000aaa0000afff00000aaa00001fff0000111100001fff000011110000544400000ccc0000544400000eee0000544400000aaa0000544450000eee00
00fdfd0000afff0000fdfd0000afff0000fdfd00001fff0000fdfd00001fff00004f4f0000544400054f4f0000544400004f4f0000544400054f4f5000544450
005fff0000fdfd00005fff0000fdfd00007f7f0000fdfd00007f7f0000fdfd000054a400004f4f0005544450054f4f0000549400004f4f0005544400054f4f50
00055000005fff0000055000005fff0000177700007f7f0000177700007f7f00000d70000054a400000370000554445000d17100005494000053770005544400
0005500000055000000550000005500000111100001777000011110000117700000d1000000d7000000310000003700000d1110000d171000003110000537700
000f4000000f4000000f40000004f00000f1110000f1110000f111000011f1000004e0000004e0000004c0000004c000004eee00004eee000004cc000004cc00
00055000000550000005500000505000001111000011110000011000001101000003300000033000000110000001100000033000000330000001110000011100
000ccc0000000000000999000000000000000000000000000000000000000000000eee0000000000000eee000000000000077700000000000007770000000000
00544400000ccc000054440000099900d009990dd009990d000000000d0000d0007fff00000eee00007fff00000eee00005fff0000077700005fff0000077700
004f4f0000544400004f4f00005444007d9fffd77d9fffd7dd0999ddd559995d00fcfc00007fff0000fcfc00007fff0000f3f300005fff0000f3f300005fff00
00545400004f4f0000545400004f4f0077fafa7777fafa77759fff57d79fff7d007fff0000fcfc00007fff0000fcfc00005fff0000f3f300005fff0000f3f300
005555000054540000d5550000545400779fff77779fff7777fafa7777fafa7700117100007fff0000117100007fff0000777700005fff0000777700005fff00
000a70000055550000d1a10000d555000770077007700770779fff77709fff070011110000117100001111000011710000777700007777000077770000777700
0004100000041000004eee00004eee000000000000000000000000007000000700feee0000feee0000feee0000eefe0000f7770000f7770000f777000077f700
000330000003300000033000000330000000000000000000000000000000000000011000000110000001100000110100000ee000000ee000000ee00000ee0e00
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00011111111100000000000000000000000111111111000000000000000000001111111111110000000000000000000011111111111100000000000000000000
0001d21f7771000000011111111100000001d2177ff100000001111111110000f777221f77710000111111111111000077ff22177ff100001111111111110000
0001d21f777111100001d21777f100000001d2177ff111100001d21ff7710000f777221f77711111777f221777f1000077ff22177ff11111ff77221ff7710000
0001d21f771222100001d21777f111100001d2177f1222100001d21ff7711110f777221f77122221777f221777f1111177ff22177f122221ff77221ff7711111
0001d21111dddd100001d217771222100001d21111dddd100001d21ff712221011222211111dddd1777f22177712222111222211111dddd1ff77221ff7122221
0011d2d2d2dddd100001d21111dddd100011d2d2d2dddd100001d21111dddd101dddd2d2dd2dddd111222211111dddd11dddd2d2dd2dddd111222211111dddd1
0011d112d2d11d100011d2d2d2dddd100011d112d2d11d100011d2d2d2dddd101dd112dddd2d11d11dddd2d2dd2dddd11dd112dddd2d11d11dddd2d2dd2dddd1
00011561111561100011d112d2d11d1000011651111651100011d112d2d11d1011156111111156111dd112dddd2d11d111165111111165111dd112dddd2d11d1
00001661001661000001165100165110000015510015510000011561001561100016610000016610001651000001651000155100000155100015610000015610
00001111001111000000111100111100000011110011110000001111001111000011110000011110001111000001111000111100000111100011110000011110
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001770000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000177777700000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000011770000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001771000000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000000011772100000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000001111110000000000000000000000000121772210000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000001221772221000000000000
00000000000000000000000000000000000000000000000000000000000000000000000000000011000000000000000000000000011111111111100000000000
00000000000000000000000000000000000000000000000000000000000000000011111111111111111111111111000000000000122222222222210000000000
00000000000000110000000000000000000000000000001100000000000000000011222222222222222222222211000000000001222222222222221000000000
00000000000011111100000000000000000000000000111111000000000000000012222222222222222222222221000000000012222222222222222100000000
00000000000000110000000000000000000000000000001100000000000000000012222222222222222222222221000000000122222222222222222210000000
00000000000000110000000000000000000000000000001100000000000000000012222222222222222222222221000000001222222222222222222221000000
00111111111111111111111111110000001111111111111111111111111100000012222222222222222222222221000000012222222222222222222222100000
00112222222222222222222222110000001122222222222222222222221100000012222222222222222222222221000000112222222222222222222222110000
00122222222222222222222222210000001222222222222222222222222100000011222222222222222222222211000000111111111111111111111111110000
00122222222222222222222222210000001222222222222222222222222100000011111111111111111111111111000011111116666666666666611111111111
00122222222222222222222222210000001222222222222222222222222100000000116666666666666666110000000011611166666666666666661116666611
0012222222222222222222222221000000122222222222222222222222210000000016166665666666666161000000001666161666656666666661615f665f61
001222222222222222222222222100000012222222222222222222222221000000001666665fff5fff6666610000000015f61666665fff5fff66666166666661
001122222222222222222222221100000011222222222222222222222211000000001666665ff555ff6666610000000016661666665ff555ff6666615f665f61
001111111111111111111111111100000011111111111111111111111111000000001666665fff5fff6666610000000011611666665fff5fff66666116666611
0000116666666666666666110000000011111166666666666666661111111111111116666655ff5fff66666111111111111116666655ff5fff66666111111111
00001666666666666666666100000000116116666666666666666661166666111161166666666666666666611666661111611666666666666666666116666611
000015f5f66177777765f5f10000000016f615f5f66177777765f5f1666f666116f615f5f66177777765f5f1666f666115f615f5f66177777765f5f1665f6661
000015f5f61777777765f5f10000000015f615f5f61777777765f5f1665f666115f615f5f61777777765f5f1665f6661160615f5f61777777765f5f166666661
000015f5f61777777765f5f10000000015f615f5f61777777765f5f1665f666115f615f5f61777777765f5f1665f666115f615f5f61777777765f5f1665f6661
00001666661777777766666100000000166616666617777777666661666666611666166666177777776666616666666116661666661777777766666166666661
00001666661771717766666100000000166616666617717177666661666666611666166666177171776666616666666116661666661771717766666166666661
00001666661777777766666100000000166616666617777777666661666666611666166666177777776666616666666116661666661777777766666166666661
00001166661777777756661100000000116111666617777777566611166666111161116666177777775666111666661111611166661777777756661116666611
00001111111111111111111100000000111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111
00111111111111111111111111000000000000000000000000000000000000000001111111111111111111111100000000000000000000000000000000000000
00111222222227772222222111000000000000000000000000000000000000000001222222222222222222221100000000000000000000000000000000000000
00112222222227772222222211000000000000000000000000000000000000000001221111111111111111111100000000000111111000000000000000000000
0012222222777777777222222100000000000000000000000000000000000000000121111d11dddddddddd111000000000000011110000000000000000000000
001212222277777777722221210000000000000000000000000000000000000000011111dd1dddddddddddd10000000000000012110000000000000000000000
001122222277777777722222110000000000000000000000000000000000000000000001dd1dddddddddddd10000000000111112210000000000000000000000
001122222222277722222222110000000000000000000000000000000000000000011111111d5ffdddd5ffd10000000000011112211111111111111111000000
001112222222277722222221110000000000000000000000000000000000000000012222211d5ffdddd5ffd10000000000012112211122222222222211000000
011111111111111111111111110000000000000000000000000000000000000000011222111d55fdddd55fd10000000000012112111222222222222221000000
0116666666666666666666110000000000000000000000000000000000000000000012221d1dddddddddddd10000000011111111111222222222222221000000
0166f666f666f666f666f6610000000000000000000000000000000000000000000012221d1dddddddddddd10000000011222222211222222222222221000000
0166f666f666f666f666f6610000000000000000000000000000000000000000000012221d1ddddddddddd110000000012222222221222222222222221000000
0166566656665666566656610000000000000000000000000000000000000000000011221d1dddddddddd1110000000012222222211122222222222211000000
0166666666666666666666610000000000000000000000001000000000000000000011121111dddddddd11000000000011111111111111111111111111000000
016666666666666666666661000000000000000000000001110000000000000000001d1111111111111111000000000011dddddd1111dddddddddd1110000000
016666666666666666666661000000000000000000000000100000000000000000001dd11dddddddddd11000000000001dddddddd11dddddddddddd100000000
0166f666f666f666f666f661000000000000000001111111111111110000000000001dd1dddd5ff5ffdd1000000000001ddddddddd1dddddddddddd100000000
0166f666f666f666f666f661000000000000000001122222222222110000000000001dd1dddd55f55fdd1000000000001ddddddddd1dddddddddddd100000000
011656665666566656665611000000000000000001222222222222210000000000001dd1dddd555555dd1000000000001ddddddddd1dddddddddddd100000000
011666666666666666666611000000000000000001222222222222210000000000001dd1dddd5ff5ffdd1000000000001ddddddddd1dddddddddddd100000000
011666666666666666666611000000000000000001222222222222210000000000001dd1dddd55f55fdd1000000000001ddddddddd1dddddddddddd100000000
011166666666666666666111000000000000000001122222222222110000000000001dd1dddddddddddd1000000000001ddddddddd1dddddddddddd100000000
011111111111111111111111000000000000000001111111111111110000000000001dd1dddddddddddd1000000000001dd5f5dddd15f5ddddddd5f100000000
011666666666666666666611000000000000000001166666666666110000000000001dd1dddd557775dd1000000000001dd5ffdddd15ffd55775d5f100000000
0166f666f666f6677766f661000000000000000001666667776666610000000000001dd1dddd577777dd1000000000001dd5ffdddd15ffd57777d5f100000000
0166f666f666f6677766f6610000000000000000015f5f677765f5f10000000000001dd1dddd577777dd1000000000001dd5ffdddd15ffd57777d5f100000000
0166566656665667776656610000000000000000015f5f677765f5f10000000000001dd1dddd577777dd1000000000001ddddddddd1dddd57777ddd100000000
016666666666666777666661000000000000000001666667776666610000000000001dd1dddd577757dd1000000000001ddddddddd1dddd57775ddd100000000
016666666666666177666661000000000000000001666661776666610000000000001dd1dddd577777dd1000000000001ddddddddd1dddd57777ddd100000000
016666666666666777666661000000000000000001666667776666610000000000001dd11ddd577777dd1000000000001ddddddddd1dddd57777ddd100000000
011666666666666777566611000000000000000001166667775666110000000000001d1111dd557775d110000000000011ddddddd111ddd55775dd1100000000
01111111111111111111111100000000000000000111111111111111000000000000111111111111111110000000000011111111111111111111111100000000
__label__
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc7ccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc7cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccc7ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccacccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccaccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc7cccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaaaaccaaccccccaaaaaaccaaaaaaccaaaaaaccaaaaaaccaaaaccccccaacccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaaaa1caa1cccccaaaaaa1caaaaaa1caaaaaa1caaaaaa1caaaa1cccccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaa11aa1caa1cccccaa11111caa11111caa11111caa11111caa11aaccccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaa1caa1caa1cccccaa1cccccaa1cccccaa1cccccaa1cccccaa1caa1cccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaac11caa1cccccaaaaccccaaaaaaccaaaaaaccaaaaccccaa1caa1cccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaa1cccaa1cccccaaaa1cccaaaaaa1caaaaaa1caaaa1cccaa1caa1cccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaa11aaccaa1cccccaa111cccc111aa1cc111aa1caa111cccaa1caa1cccc11ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaa1caa1caa1cccccaa1cccccccccaa17ccccaa1caa1cccccaa1caa1ccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaaaa1caaaaaaccaaaaaaccaaaaaa1caaaaaa1caaaaaaccaaaaaa1cccaacccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccaaaaaa1caaaaaa1caaaaaa1caaaaaa1caaaaaa1caaaaaa1caaaaaa1cccaa1ccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccc111111cc111111cc111111cc111111cc111111cc111111cc111111cccc11ccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccc7ccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccacccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccc7cccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111ccccccccccccccccccccccccccccccccccccccccaccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc111111111111111111111111cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccacccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccc7cccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccccccffffffff33333333ffffffff33333333cccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
ccccc7cccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffccccccccccccccccccccccccccccccccccccaccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccc11111111ffffffffffffffffffffffffcccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccc7ccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccacccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc11111111777777777ccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111177777777cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111111111111cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111111111111cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccccccc1111111111111111cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccccccccccccc7cccccccccc1111111111111111cccccccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccccccccccccc3333111111111111111133333ccccccccccccccccccccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccccccccccccccc333333333333331111111111111111333333333333333ccccccccccccccccccccccccccccccccccccccccc
ccccccccccccccccccccccccccccccccccc33333333333333333333311111111111111113333333333333333333333cccccccccccccccccccccccccccccccccc
cccccccccccccccccccccccccccccc333333333333333333333333331111111111111111333333333333333333333333333ccccccccccccccccccccccccccccc
cccccccccccccccccc7cccccc3333333333333333333333333333333ffffffff1111111133333333333333333333333333333333cccccccccccccccccccccccc
ccccccccccccccccccccc33333333333333333333333333333333333ffffffff11111111333333333333333333333333333333333333cccccccccccccccccccc
ccccccccccccccccc333333333333333333333333333333333333333ffffffff111111113333333333333333333333333333333333333333cccccccccccccccc
c7ccccccccccc3333333333333333333333333333333333333333333ffffffff1111111133333333333333333333333333333333333333333333cccccccccccc
cccccccccc3333333333333333333333333333333333333333333333ffffffff1111111133333333333333333333333333333333333333333333333ccccccccc
ccccccc3333333333333333333333333333333333333333333333333ffffffff1111111133333333333333333333333333333333333333333333333333cccccc
cccc3333333333333333333333333333333333333333333333333333ffffffff1111111133333333333333333333333333333333333333333333333333333ccc
c3333333333333333333333333333333333333333333333333333333ffffffff1111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333111111111111111133333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333337373777373733733777377733333777333337773777377737773777377733333333333333333333333333333333333
33333333333333333333333333333333337373737373733733737373333333737333337373737337337333733337333333333333333333333333333333333333
33333333333333333333333333333333337773737373733333773377333333777333337773773337337733777337333333333333333333333333333333333333
33333333333333333333333333333333333373737373733333737373333333737333337333737337337333337337333333333333333333333333333333333333
33333333333333333333333333333333337773777377733333737377733333737333337333737377737773777337333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333777373337773777377733333777373737773777373737773737377737733777333337773773333337773777377737373777333333333333333
33333333333333737373337333733373333333733373737333737373733733737337337373733333333733737333337333373373337373373333333333333333
33333333333333773373337733777377733333773373737733773377733733777337337373737333333733737333337773373373737773373333333333333333
33333333333333737373337333337333733333733377737333737333733733737337337373737333333733737333333373373373737373373333333333333333
33333333333333777377737773777377733333777337337773737377733733737377737373777333337773737333337773777377737373373333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333777377737773333377733333737377737773737333337773777377737773777333333333333333333333333333333333
33333333333333333333333333333333733373333733333373733333737337337333737333337333733373737373733333333333333333333333333333333333
33333333333333333333333333333333737377333733333377733333777337337373777333337773733373737733773333333333333333333333333333333333
33333333333333333333333333333333737373333733333373733333737337337373737333333373733373737373733333333333333333333333333333333333
33333333333333333333333333333333777377733733333373733333737377737773737333337773777377737373777333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
33333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333333
__sfx__
0004030024030280302b0250000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000302002b43030435000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00050900183401c3401f34024350283502b3503035230352303450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
00040900245502b550285502f5502b550325503055037552375450000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000804001f1401e1401d1301a13300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000606002b560005002b5600050030562305550000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
000f00002706000000000000000000000000002805000000000000000000000000002706028050280502805228052280522706027065000000000027060280602806228062280622806500000000000000000000
000f00002706028060280622806228062280652d0402d0402d0422d0422d045000002405024050240522405224052240551d0401f0301f0321f0321f0321f0321f0321f0321f0321f0321f0321f0350000000000
000f00002704028050280522805228052280552805000000000000000000000000002706028050280522805228052280552d0402d0402d0422d04528060280602806228062280622806228062280622806500000
000f00002706028060280622806228062280652d0402d0402d0422d0422d0422d0452406024060240622406224062240651f0401f0401f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f045
000f00002504026030260322603226032260322603226032260322603226032260322603226032260322603226032260322603226032260322603226032260352404024045260600000028040280452b0502b050
000f00002b0522b0522b0522b0522b0522b0522b0522b0522b0522b0522b0522b0551f0401f0401f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f0421f04500000
000f00002506026040260422604226042260422604226042260422604226042260422604226042260422604226042260422604226042260422604226045000002404024045260502605528040280452b0602b060
000f00002b0622b0622b0622b0622b0622b0622b0622b0622b0622b0622b0622b0651f0401f0401f0421f0421f0421f0421f0421f0421f0421f04518060180601806218062180621806218062180621806500000
000f00000507000000000000000000000000000000000000000000000005070000000000005070000000000005070050700000000000000000000000000000000000000000050700507000000050700507000000
000f0000000700007000000000000000000000000000000000000000000007000070000000007000070000000007000070000000000000000000000c0600c0600000000000000000000000070000700a07000000
000f00000507005070000000000000000000000000000000000000000005070050700000005070000000000005070050700000000000000000000000000000000000000000050700507000000050700507000000
000f000000070000700000000000000000000000000000000000000000000700007000000000700007000000000700007000000000000c0600c060000000000000000000000007000070000000c0700c07000000
000f00000a0700a070000000000000000000000a0700a070000000000000000000000a0700a07000000000000a0700a070000000000000000000000a0700a070000000000000000000000a0700a0700507000000
000f000000070000700000000000000000000000070000700000000000000000000000070000700000000000000000000000070000700000000000000000000000070000000c0600000000070000000c07000000
000f00000a07000000000000000000000000000a0700a070000000000000000000000a07000000000000000000000000000a07000000000000000000000000000a0700000000000000000a070000000507000000
000f00000007000070000000000000000000000007000000000000000000000000000007000000000000000000000000000007000070000000000000000000000c0700000000070000000c0700c0700007000000
000f0000000000000000000000000c073000000000000000000000000000000000000000000000000000000000000000000c07300000000000000000000000000c0730000000000000002c665000000000000000
000f0000000000000000000000000c073000000000000000000000000000000000000000000000000000000000000000000c07300000000000000000000000000c0730000000000000002c665000002c66500000
000f00002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000
000f0000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c665000000000000000000000000000000000002c665000002c665000002c665000000c07300000
000f00000c0730000000000000002c65500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c665000000000000000
000f0000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c66500000000000000000000000002c665000000c07300000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
__music__
01 08101840
00 09111940
00 0a121940
00 0b131940
00 0c141a40
00 0d151b40
00 0e161c40
02 0f171d40
