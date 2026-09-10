// Original painted material atlas. UV V=0 is image top (texture.flipY=false).
export const TILES = Object.freeze({cloth:0,cape:1,skin:2,hair:3,wrap:4,leather:5,brass:6,sole:7,eye:8,iris:9,lip:10,seam:11,map:12,capeTrim:13,clothTrim:14,dark:15});
// Game material color ledger, separate from interface colors.
export const MATERIAL_PALETTE = Object.freeze({
  cloth: '#303e50', cape: '#ad6030', skin: '#cda080', hair: '#282421',
  wrap: '#dad0ae', leather: '#634a35', brass: '#b79859', sole: '#302e2a',
  eye: '#e5dcc7', iris: '#3a3330', lip: '#986856', seam: '#817459',
  map: '#dfd4ad', capeTrim: '#cf9654', clothTrim: '#516173', dark: '#242726',
});
const colors = Object.keys(TILES).map(name => MATERIAL_PALETTE[name]);
export function createAtlas() {
  const canvas = document.createElement('canvas');
   canvas.width=canvas.height=1024;
  const c=canvas.getContext('2d');
   let seed=793;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;
  return seed/4294967296;
  };
  for(let tile=0;tile<16;tile++){
    const x=(tile%4)*256,y=Math.floor(tile/4)*256;
    c.save();
  c.beginPath();
  c.rect(x,y,256,256);
  c.clip();
  c.fillStyle=colors[tile];
  c.fillRect(x,y,256,256);
    const shade=c.createLinearGradient(x,y,x+256,y+256);
  shade.addColorStop(0,'rgba(255,232,180,.10)');
  shade.addColorStop(.5,'rgba(0,0,0,0)');
  shade.addColorStop(1,'rgba(15,13,12,.16)');
  c.fillStyle=shade;
  c.fillRect(x,y,256,256);
    for(let i=0;i<1800;i++){c.fillStyle=rand()>.5?'rgba(255,236,204,.045)':'rgba(0,0,0,.05)';
  c.fillRect(x+rand()*256,y+rand()*256,1+rand()*2,1+rand()*3);
  }
    if([0,1,4,13,14].includes(tile)){
      c.lineWidth=.6;
  c.strokeStyle='rgba(240,220,181,.075)';
      for(let j=4;j<256;j+=4){c.beginPath();
  c.moveTo(x+j,y);
  c.lineTo(x+j,y+256);
  c.stroke();
  c.beginPath();
  c.moveTo(x,y+j);
  c.lineTo(x+256,y+j);
  c.stroke();
  }
    }
    if(tile===4){c.strokeStyle='rgba(104,91,65,.4)';
  c.lineWidth=2;
  for(let j=-256;j<512;j+=40){c.beginPath();
  c.moveTo(x,y+j);
  c.lineTo(x+256,y+j+140);
  c.stroke();
  }}
    if(tile===5){c.strokeStyle='rgba(230,195,133,.48)';
  c.lineWidth=2;
  c.setLineDash([3,6]);
  c.strokeRect(x+13,y+13,230,230);
  c.setLineDash([]);
  }
    if(tile===12){c.strokeStyle='rgba(96,105,85,.4)';
  c.lineWidth=2;
  for(let j=0;j<7;j++){c.beginPath();
  for(let k=0;k<20;k++){const px=x+20+k*12,py=y+25+j*33+Math.sin(k*.7+j)*12;
  k?c.lineTo(px,py):c.moveTo(px,py);
  }c.stroke();
  }}
    if(tile===13){c.strokeStyle='rgba(246,222,165,.75)';
  c.lineWidth=7;
  c.beginPath();
  for(let j=0;j<120;j++){let a=j*.095,r=4+j*.55;
  let px=x+128+Math.cos(a)*r,py=y+128+Math.sin(a)*r;
  j?c.lineTo(px,py):c.moveTo(px,py);
  }c.stroke();
  }
    c.restore();
  }
  return canvas;
}
