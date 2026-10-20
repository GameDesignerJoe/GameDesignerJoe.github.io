import sys
from PIL import Image, ImageDraw
x0,y0,x1,y1,step,out=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]),int(sys.argv[5]),sys.argv[6]
sc=float(sys.argv[7]) if len(sys.argv)>7 else 1
im=Image.open('../ref/map.png').convert('RGB').crop((x0,y0,x1,y1))
im=im.resize((int((x1-x0)*sc),int((y1-y0)*sc)),Image.LANCZOS)
d=ImageDraw.Draw(im)
for x in range((x0//step+1)*step,x1,step):
    X=(x-x0)*sc; d.line([(X,0),(X,im.height)],fill=(255,0,0) if x%(step*2)==0 else (255,150,150)); d.text((X+2,2),str(x),fill=(200,0,0))
for y in range((y0//step+1)*step,y1,step):
    Y=(y-y0)*sc; d.line([(0,Y),(im.width,Y)],fill=(0,0,255) if y%(step*2)==0 else (150,150,255)); d.text((2,Y+2),str(y),fill=(0,0,200))
im.save(out)
