import * as THREE from 'three';
const SHAPES={
  coast:[[0,0],[45,-95],[165,-115],[255,-58],[265,48],[181,105],[105,97],[57,171],[-58,170],[-129,102],[-183,4],[-122,-76]],
  alpine:[[0,0],[90,-75],[212,-70],[273,3],[207,52],[184,134],[109,152],[42,94],[-43,142],[-159,115],[-211,25],[-139,-64],[-45,-89]],
  metro:[[0,0],[79,-4],[161,-57],[242,-22],[230,86],[148,88],[154,170],[54,180],[-29,132],[-98,185],[-179,98],[-176,-3],[-100,-72]],
  storm:[[0,0],[86,-94],[174,-67],[203,40],[268,103],[216,188],[107,175],[23,133],[-68,175],[-166,106],[-198,2],[-137,-100]],
  desert:[[0,0],[83,-77],[153,-48],[260,-87],[303,4],[253,90],[191,69],[134,150],[32,165],[-59,127],[-161,166],[-219,59],[-173,-51],[-74,-78]],
  grand:[[0,0],[91,-15],[170,-107],[267,-74],[301,7],[246,69],[209,136],[127,177],[38,127],[-53,164],[-147,104],[-205,11],[-159,-92],[-67,-93]]
};
const N=1400;
export class Circuit{
  constructor(round){
    this.round=round;this.width=15.4;
    this.curve=new THREE.CatmullRomCurve3(SHAPES[round.shape].map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal',.42);
    this.curve.arcLengthDivisions=2400;
    this.length=this.curve.getLength();
    this.frames=Array.from({length:N},(_,i)=>{
      const u=i/N,p=this.curve.getPointAt(u),t=this.curve.getTangentAt(u).normalize();
      return {x:p.x,z:p.z,tx:t.x,tz:t.z,nx:t.z,nz:-t.x,u,s:u*this.length};
    });
    this.curvature=Array.from({length:N},(_,i)=>{
      const a=this.frames[(i+N-4)%N],b=this.frames[(i+4)%N],angle=Math.atan2(a.tx*b.tz-a.tz*b.tx,a.tx*b.tx+a.tz*b.tz);
      return Math.abs(angle)/(8*this.length/N);
    });
  }
  frame(s){
    const i=((Math.floor(s/this.length*N)%N)+N)%N,j=(i+1)%N;
    const f=this.frames[i],g=this.frames[j];
    const frac=((s/this.length*N%1)+1)%1;
    let tx=f.tx+(g.tx-f.tx)*frac,tz=f.tz+(g.tz-f.tz)*frac;
    const len=Math.hypot(tx,tz)||1;tx/=len;tz/=len;
    return {x:f.x+(g.x-f.x)*frac,z:f.z+(g.z-f.z)*frac,tx,tz,nx:tz,nz:-tx,curvature:this.curvature[i],s};
  }
  position(s,offset=0){const f=this.frame(s);return {x:f.x+f.nx*offset,z:f.z+f.nz*offset,heading:Math.atan2(f.tx,f.tz)}}
  project(x,z,lastIndex=null){
    let closest=-1,d2=Infinity;
    const scan=(i)=>{const f=this.frames[i];const dx=x-f.x,dz=z-f.z,r=dx*dx+dz*dz;if(r<d2){closest=i;d2=r}};
    if(lastIndex===null){for(let i=0;i<N;i+=2)scan(i);for(let j=-4;j<=4;j++)scan((closest+j+N)%N)}
    else for(let j=-24;j<=24;j++)scan((lastIndex+j+N)%N);
    const f=this.frames[closest];return {s:f.s,offset:(x-f.x)*f.nx+(z-f.z)*f.nz,index:closest,distance:Math.sqrt(d2)};
  }
  curvatureAt(s){let i=((Math.round(s/this.length*N)%N)+N)%N;return this.curvature[i]}
}
