-- a town to walk around in
-- the town itself (map, pictures,
-- people, words) comes from the
-- lesson studio's town tab: the
-- part between the two "town:"
-- lines below, and the sprite
-- sheet and map, are replaced
-- every time she makes the game.
-- everything else here is kept.

--town:begin
--town:end

alpha="0123456789abcdefghijklmnopqrstuvwxyz!#$%&()*+,-./:;<=>?@[]^_{|}~"

-- pictures that don't fit on the
-- sprite sheet are kept as text
-- and drawn once into two extra
-- sheets (0x8000 and 0xa000)
function load_big()
 local lut,q={},1
 for i=1,#alpha do lut[sub(alpha,i,i)]=i-1 end
 for i=1,#bigrects,5 do
  local pg,sx,sy,w,h=unpack(bigrects,i,i+4)
  poke(0x5f55,pg==1 and 0x80 or 0xa0)
  local p=0
  while p<w*h do
   local v=lut[sub(bigart,q,q)]
   q+=1
   for k=0,v%4 do
    if (v\4>0) pset(sx+p%w,sy+p\w,v\4)
    p+=1
   end
  end
 end
 poke(0x5f55,0x60)
end

function _init()
 load_big()
 fr=0
 objs={}
 for s in all(things) do
  local a=split(s,"|",false)
  local n=split(a[1])
  add(objs,{pg=n[1],sx=n[2],sy=n[3],w=n[4],h=n[5],
   x=n[6],y=n[7],dx=n[8],dy=n[9],name=a[2],
   b=n[7]+n[5],draw=draw_obj})
 end
 ppl={}
 for s in all(people) do
  local a=split(s,"|",false)
  local n=split(a[1])
  add(ppl,{sx=n[1],sy=n[2],w=n[3],h=n[4],n=n[5],
   x=n[6],y=n[7],name=a[2],job=a[3],says=a[4],
   b=n[7]+n[4],draw=draw_person})
 end
 pl={x=start[1]*8,y=start[2]*8+8-pd[2],w=pd[1],h=pd[2],
  flip=false,walk=0,draw=draw_player}
 pl.b=pl.y+pl.h
 dlg=nil
end

-- can't walk on cell cx,cy?
function wall(cx,cy)
 if (cx<0 or cy<0 or cx>=tw or cy>=th) return true
 local n=cy*tw+cx
 return (tonum("0x"..sub(solid,n\4+1,n\4+1))&(8>>(n%4)))>0
end

-- is there room for the player's
-- feet with the sprite at x,y?
function free(x,y)
 local l,r=(x+1)\8,(x+pl.w-2)\8
 local t,b=(y+pl.h-3)\8,(y+pl.h-1)\8
 return not (wall(l,t) or wall(r,t) or wall(l,b) or wall(r,b))
end

function wrap(s,w)
 local out,line={},""
 for word in all(split(s," ",false)) do
  if #line>0 and #line+#word+1>w then
   add(out,line) line=word
  elseif #line>0 then line..=" "..word
  else line=word end
 end
 if (#line>0) add(out,line)
 return out
end

-- the person close enough to talk to
function near()
 for p in all(ppl) do
  if abs(p.x+p.w/2-pl.x-pl.w/2)<12
   and abs(p.b-pl.b)<12 then return p end
 end
end

function _update()
 fr+=1
 -- water and other moving tiles
 if fr%15==0 then
  for i=1,#anim,3 do
   local d,s=anim[i],anim[i+1]+fr\15%anim[i+2]
   for r=0,7 do
    memcpy(d\16*512+d%16*4+r*64,s\16*512+s%16*4+r*64,4)
   end
  end
 end
 if dlg then
  if btnp(4) or btnp(5) then
   dlg.i+=3
   if (dlg.i>#dlg.lines) dlg=nil
  end
  return
 end
 local dx,dy=0,0
 if (btn(0)) dx=-1
 if (btn(1)) dx=1
 if (btn(2)) dy=-1
 if (btn(3)) dy=1
 if (dx~=0 and free(pl.x+dx,pl.y)) pl.x+=dx
 if (dy~=0 and free(pl.x,pl.y+dy)) pl.y+=dy
 -- her characters are drawn facing left
 if (dx~=0) pl.flip=dx>0
 pl.walk=(dx~=0 or dy~=0) and pl.walk+1 or 0
 pl.b=pl.y+pl.h
 local p=near()
 if p and (btnp(4) or btnp(5)) then
  dlg={who=p,i=1,lines=wrap(p.says,30)}
 end
end

function draw_obj(o)
 if (o.pg>0) poke(0x5f54,o.pg==1 and 0x80 or 0xa0)
 sspr(o.sx,o.sy,o.w,o.h,o.x,o.y)
 poke(0x5f54,0)
end

function draw_person(p)
 sspr(p.sx+fr\15%p.n*p.w,p.sy,p.w,p.h,p.x,p.y)
end

function draw_player(p)
 -- pd: w,h, idle sx,sy,frames,
 -- walk sx,sy,frames
 local k=p.walk>0 and 6 or 3
 local f=p.walk>0 and p.walk\5 or fr\15
 sspr(pd[k]+f%pd[k+2]*p.w,pd[k+1],p.w,p.h,p.x,p.y,p.w,p.h,p.flip)
end

function _draw()
 cls(ground)
 local cx=mid(0,pl.x+pl.w/2-64,tw*8-128)
 local cy=mid(0,pl.y+pl.h/2-64,th*8-128)
 camera(cx,cy)
 -- the map is kept as two halves
 -- side by side
 map(0,0,0,0,tw,min(th,32))
 if (th>32) map(64,0,0,256,tw,th-32)
 -- everything standing up, the
 -- ones further back first
 local l={pl}
 for o in all(objs) do
  if (o.x<cx+128 and o.x+o.w>cx and o.y<cy+128 and o.b>cy) add(l,o)
 end
 for p in all(ppl) do add(l,p) end
 for i=2,#l do
  local o,j=l[i],i-1
  while j>0 and l[j].b>o.b do l[j+1]=l[j] j-=1 end
  l[j+1]=o
 end
 for o in all(l) do o:draw() end
 local p=not dlg and near()
 if (p) print("❎",p.x+p.w/2-3,p.y-7+fr\15%2,7)
 camera()
 -- the name of a place, at its door
 local fx,fy=(pl.x+pl.w/2)\8,(pl.b-1)\8
 for o in all(objs) do
  if o.dx==fx and o.dy==fy and o.name~="" and not dlg then
   local w=#o.name*4+6
   rectfill(64-w/2,2,63+w/2,12,1)
   print(o.name,67-w/2,5,7)
  end
 end
 if dlg then
  local p=dlg.who
  rectfill(0,88,127,127,1)
  rect(0,88,127,127,7)
  print(p.name,4,91,10)
  if (p.job~="") print(p.job,124-#p.job*4,91,6)
  for i=0,2 do
   local s=dlg.lines[dlg.i+i]
   if (s) print(s,4,100+i*7,7)
  end
  if (fr\15%2==0) print(dlg.i+3>#dlg.lines and "❎" or "…",118,120,7)
 end
end
