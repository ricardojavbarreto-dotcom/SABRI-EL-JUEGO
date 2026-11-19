"""Build a tileable plank atlas and a self-contained glTF 2.0 floor. Requires NumPy and Pillow."""
from pathlib import Path
import hashlib, io, json, struct
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[2]
rng=np.random.default_rng(701)
size=1024
v,u=np.mgrid[:size,:size]/size
row=np.floor(v*8).astype(int)
cross=v*8-row
offsets=np.array([0,.53,.16,.79,.32,.91,.44,.23])
along=u*2+offsets[row]
board=(np.floor(along).astype(int)%2)+row*2
t=along%1
phase=rng.uniform(-np.pi,np.pi,16)[board]
tone=rng.normal(0,2.9,16)[board]
curve=(cross+0.055*np.sin(6*t+phase)+.024*np.sin(14*t+phase))
# Sweeping growth rings and finer longitudinal fibers vary from plank to plank.
rad=np.sqrt(((t-.48)*1.35)**2+((curve-.28-.23*np.sin(phase))*.70)**2+.002)
rings=(.5+.5*np.cos(rad*119+1.2*np.sin(13*curve+phase)))**7
grain=3.5*np.sin(curve*198+phase)+2.2*np.sin(curve*343+np.sin(t*12))+2.4*rng.normal(size=u.shape)
edge=np.minimum(np.minimum(cross,1-cross)*.18,np.minimum(t,1-t)*1.2)
shade=tone+grain-12*rings-14*np.exp(-edge/.0011)+2*np.sin(rad*55)
pixels=np.clip(np.array([157,145,128])+shade[:,:,None],0,255).astype(np.uint8)
texture=io.BytesIO()
Image.fromarray(pixels).save(texture,'JPEG',quality=91)
tex=texture.getvalue()
# 8 x 6 m, horizontal +Y face. UV period is 2.40 x 1.44 metres.
pos=[-4,0,-3,-4,0,3,4,0,3,4,0,-3]
uv=[(value+shift)/period for i in range(4) for value,shift,period in [(pos[i*3],4,2.4),(pos[i*3+2],3,1.44)]]
parts=[struct.pack('<12f',*pos),struct.pack('<12f',*([0,1,0]*4)),struct.pack('<8f',*uv),struct.pack('<6H',0,1,2,0,2,3),tex]
views=[]
binary=bytearray()
for i,b in enumerate(parts):
    view=dict(buffer=0,byteOffset=len(binary),byteLength=len(b))
    if i<4: view['target']=34963 if i==3 else 34962
    views.append(view)
    binary.extend(b+b'\0'*(-len(b)%4))
mat='MAT_FLOOR_GREIGE_PLANK'
doc=dict(asset=dict(version='2.0'),scene=0,scenes=[dict(nodes=[0])],
    nodes=[dict(name='ROOT',children=[1]),dict(name='FLOOR_SURFACE',mesh=0)],
    meshes=[dict(primitives=[dict(attributes=dict(POSITION=0,NORMAL=1,TEXCOORD_0=2),indices=3,material=0)])],
    materials=[dict(name=mat,pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=.59))],
    images=[dict(bufferView=4,mimeType='image/jpeg',name='greige_planks')],textures=[dict(source=0,sampler=0)],
    samplers=[dict(wrapS=10497,wrapT=10497)],bufferViews=views,buffers=[dict(byteLength=len(binary))],
    accessors=[dict(bufferView=i,componentType=5123 if i==3 else 5126,type=typ,count=6 if i==3 else 4)
               for i,typ in enumerate(['VEC3','VEC3','VEC2','SCALAR'])])
doc['accessors'][0].update(min=[-4,0,-3],max=[4,0,3])
j=json.dumps(doc,separators=(',',':')).encode()
j+=b' '*(-len(j)%4)
glb=struct.pack('<4sIIII',b'glTF',2,28+len(j)+len(binary),len(j),0x4e4f534a)+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary
file='assets/environment/floor_001.glb'
(root/'public'/file).parent.mkdir(parents=True,exist_ok=True)
(root/'public'/file).write_bytes(glb)
asset=dict(id='env.floor.001',file=file,type='env',version='0.1.0',root='ROOT',dimensions_m=[8,0,6],triangles=2,
  materials=[mat],textures=['greige_planks (JPEG embebido)'],animations=[],anchors=[],hierarchy=['ROOT/FLOOR_SURFACE'],
  scale=[1,1,1],pivot_m=[0,0,0],status='ready_for_review',measurement_status='provisional',
  sha256=hashlib.sha256(glb).hexdigest(),file_size_bytes=len(glb))
(root/'data/assets.json').write_text(json.dumps(dict(package_id='A-003',package_version='0.1.0',delivery_mode='delta',contract_version='1.0',assets=[asset]),indent=2),encoding='utf8')
