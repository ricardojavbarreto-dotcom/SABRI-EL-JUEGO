from PIL import Image, ImageDraw
from pathlib import Path
import random
root = Path(__file__).resolve().parent / "textures"
root.mkdir(exist_ok=True)
rng = random.Random(401)
fabric = Image.new("RGB", (96,96))
for y in range(96):
    for x in range(96):
        warp = ((x % 6) in (2,3)) ^ ((y // 4) % 2)
        v = 42 + 13 * warp + 8 * (y % 4 == 1) + rng.randrange(-5,6)
        fabric.putpixel((x,y),(v,v+3,v+4))
fabric.save(root / "weave.png")
im = Image.new("RGB",(768,432),(33,44,55))
d = ImageDraw.Draw(im)
d.rectangle((0,0,767,29),fill=(48,59,73))
d.text((17,9),"ARCHIVO    /    Documentos",fill=(197,208,216))
d.rectangle((0,30,137,405),fill=(41,51,61))
for i,s in enumerate(["Recientes","Proyectos","Planos","Informes","Carpetas"]):
    d.text((18,60+i*34),s,fill=(173,187,199))
for row in range(3):
    for col in range(5):
        x,y=160+col*116,54+row*108
        d.rounded_rectangle((x,y,x+94,y+66),4,fill=(51,64,74))
        d.rectangle((x+34,y+16,x+59,y+47),fill=rng.choice([(121,157,150),(201,180,141),(151,171,190)]))
        for k in range(3): d.line((x+38,y+24+k*6,x+55,y+24+k*6),fill=(83,102,110))
        d.text((x+7,y+72),f"Informe {1+col+5*row:02}",fill=(189,201,207))
d.rectangle((0,406,767,431),fill=(44,55,65))
im.save(root / "desktop.png")

import math
wood = Image.new("RGB",(256,256))
for y in range(256):
    for x in range(256):
        phase=x+1.6*math.sin(y*math.tau/256+x*0.07)+0.5*math.cos(y*math.tau/128)
        grain=4*math.sin(phase*math.tau/17)+3*math.sin(phase*math.tau/6)+rng.uniform(-1.5,1.5)
        wood.putpixel((x,y),tuple(round(c+grain) for c in (165,91,50)))
wood.save(root/"wood.png")
