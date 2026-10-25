import * as THREE from 'three';
import {Circuit} from './tracks.js';
const material=(color,roughness=.84,metalness=.03)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const roadMat=material(0x282e36),white=material(0xeceff4),curbRed=material(0xe24b53),grassMat=material(0x3d6147),gravelMat=material(0x8f8068),barrierMat=material(0x9aa3ae,.75,.14),rubber=material(0x0b1016),wingMat=material(0x111b27,.54),carbon=material(0x171d26,.52,.25),gold=material(0xffc66d,.42),helmet=material(0xf8faff,.23),lamp=material(0xff4e4e),stripe=material(0x80f9e3);
function box(parent,size,pos,mat,shadow=false){const o=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);o.position.set(...pos);o.castShadow=shadow;parent.add(o);return o}
function ribbon(parent,circuit,min,max,mat,y=.02){
  const vertices=[],uv=[],indices=[],N=580;
  for(let i=0;i<=N;i++){
    const f=circuit.frame(circuit.length*i/N);
    vertices.push(f.x+f.nx*min,y,f.z+f.nz*min,f.x+f.nx*max,y,f.z+f.nz*max);
    uv.push(0,i/8,1,i/8);
    if(i<N){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,mat);mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;parent.add(mesh);
}
function seeded(seed){let n=seed>>>0;return()=>((n=Math.imul(n,1664525)+1013904223|0)>>>0)/4294967296}
export class World{
  constructor(canvas){
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x90b7cf);this.scene.fog=new THREE.FogExp2(0x90b7cf,.00235);
    this.camera=new THREE.PerspectiveCamera(68,1,.2,980);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<850?1.25:1.6));
    this.renderer.shadowMap.enabled=innerWidth>650;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    this.scene.add(new THREE.HemisphereLight(0xdff6ff,0x455545,2.6));
    this.sun=new THREE.DirectionalLight(0xffffff,2.45);this.sun.position.set(-95,160,65);this.sun.castShadow=innerWidth>650;
    this.sun.shadow.mapSize.set(1536,1536);this.sun.shadow.camera.left=-340;this.sun.shadow.camera.right=340;this.sun.shadow.camera.top=340;this.sun.shadow.camera.bottom=-340;
    this.sun.shadow.normalBias=.012;this.scene.add(this.sun);
    this.trackGroup=new THREE.Group();this.scene.add(this.trackGroup);
    this.cars=[];
    const rainCount=innerWidth<740?130:240;this.rainCount=rainCount;this.rainPositions=new Float32Array(rainCount*6);this.rainVelocity=new Float32Array(rainCount);
    this.rainGeo=new THREE.BufferGeometry();this.rainGeo.setAttribute('position',new THREE.BufferAttribute(this.rainPositions,3));
    this.rain=new THREE.LineSegments(this.rainGeo,new THREE.LineBasicMaterial({color:0xb6d4ed,transparent:true,opacity:.36,depthWrite:false}));this.rain.visible=false;this.rain.frustumCulled=false;this.scene.add(this.rain);
    for(let i=0;i<rainCount;i++){const j=i*6;this.rainPositions[j]=(Math.random()-.5)*70;this.rainPositions[j+1]=Math.random()*30;this.rainPositions[j+2]=(Math.random()-.5)*70;this.rainVelocity[i]=14+Math.random()*20;}
    this.cars=[];this.cameraMode=0;this.camTarget=new THREE.Vector3();this.camera.position.set(0,24,-50);
    window.addEventListener('resize',()=>this.resize());this.resize();
  }
  resize(){const w=innerWidth,h=innerHeight;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
  clear(){
    this.trackGroup.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose()});this.scene.remove(this.trackGroup);this.trackGroup=new THREE.Group();this.scene.add(this.trackGroup);
    for(const c of this.cars){this.scene.remove(c.group);c.group.traverse(o=>{if(o.isMesh)o.geometry.dispose()})}this.cars=[];
  }
  build(round){
    this.clear();this.circuit=new Circuit(round);const parent=this.trackGroup,c=this.circuit;
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(1200,1200),grassMat);ground.rotation.x=-Math.PI/2;ground.position.y=-.16;ground.receiveShadow=true;parent.add(ground);
    ribbon(parent,c,-c.width*.5-8,c.width*.5+8,gravelMat,-.04);
    ribbon(parent,c,-c.width/2,c.width/2,roadMat,.035);
    ribbon(parent,c,-c.width/2,-c.width/2+.88,curbRed,.063);ribbon(parent,c,c.width/2-.88,c.width/2,curbRed,.063);
    ribbon(parent,c,-c.width/2+1.12,-c.width/2+1.23,white,.069);
    ribbon(parent,c,c.width/2-1.23,c.width/2-1.12,white,.069);
    for(let i=0;i<150;i++){
      const s=(i+.4)/150*c.length,p=c.position(s,0);
      const dashed=box(parent,[.16,.02,3.3],[p.x,.085,p.z],white);dashed.rotation.y=p.heading;
    }
    for(let i=0;i<25;i++){
      const f=c.position((i-12)*.55,0);let m=box(parent,[c.width,.022,.52],[f.x,.095,f.z],i%2?white:rubber);m.rotation.y=f.heading;
    }
    // Continuous catch fences with regularly spaced posts.
    for(let edge of [-1,1]){
      for(let i=0;i<165;i++){
        const p=c.position(c.length*i/165,edge*(c.width/2+5.3));
        const post=box(parent,[.22,1.65,.26],[p.x,.83,p.z],barrierMat);
        const next=c.position(c.length*(i+1)/165,edge*(c.width/2+5.3));
        const dx=next.x-p.x,dz=next.z-p.z,wall=box(parent,[.14,1.02,Math.hypot(dx,dz)+.25],[(p.x+next.x)/2,.6,(p.z+next.z)/2],barrierMat);
        wall.rotation.y=Math.atan2(dx,dz);
        if(i%3===0)box(parent,[.22,.27,.8],[p.x,1.1,p.z],i%2?curbRed:white);
      }
    }
    const rand=seeded(9001+round.name.length*41);
    const cone= new THREE.ConeGeometry(2.9,9,7),trunkGeo=new THREE.CylinderGeometry(.33,.48,2.5,6);
    const treeMat=material(0x1e5940),treeMat2=material(0x2c774f),trunkMat=material(0x544d3e);
    const trees=new THREE.InstancedMesh(cone,treeMat,105),trees2=new THREE.InstancedMesh(cone,treeMat2,105),trunks=new THREE.InstancedMesh(trunkGeo,trunkMat,210);
    let countA=0,countB=0;const object=new THREE.Object3D();
    for(let i=0;i<500&&countA+countB<210;i++){
      const x=(rand()-.5)*980,z=(rand()-.5)*950;
      if(c.project(x,z).distance<39)continue;
      const height=.7+rand()*.85;
      object.position.set(x,4.1*height,z);object.scale.setScalar(height);object.updateMatrix();
      if(countA<105&&rand()<.5)trees.setMatrixAt(countA++,object.matrix);
      else if(countB<105)trees2.setMatrixAt(countB++,object.matrix);
      object.position.y=1.0*height;object.updateMatrix();trunks.setMatrixAt(countA+countB-1,object.matrix);
    }
    trees.count=countA;trees2.count=countB;trunks.count=countA+countB;
    parent.add(trees,trees2,trunks);
    const start=c.position(13,-c.width/2-20);
    const pit=box(parent,[31,7.2,20],[start.x,3.6,start.z],carbon,true);pit.rotation.y=start.heading;
    const signage=box(parent,[31,1.4,.6],[start.x,7.4,start.z],stripe);signage.rotation.y=start.heading;
    for(let i=0;i<7;i++){
      const p=c.position(22+i*14,c.width/2+24),stand=box(parent,[18,5,12],[p.x,2.5,p.z],carbon);stand.rotation.y=p.heading;
      const roof=box(parent,[20,.5,14],[p.x,5.2,p.z],wingMat);roof.rotation.y=p.heading;
    }
    for(let i=0;i<30;i++){
      const s=c.length*i/30,p=c.position(s,c.width/2+9);
      const flag=box(parent,[2.8,.85,.12],[p.x,6,p.z],i%2?stripe:curbRed);flag.rotation.y=p.heading;
      box(parent,[.15,5,.15],[p.x,3.3,p.z],white);
    }
    this.updateWeather(0);
    return c;
  }
  createCar(color,isPlayer=false){
    const group=new THREE.Group();const paint=material(color,.35,.5);
    const upper=box(group,[1.13,.58,4.3],[0,.62,.1],paint,true);
    upper.scale.set(1,1,.9);
    box(group,[.47,.38,2.6],[0,.72,2.4],paint,true);
    box(group,[1.55,.3,1.2],[0,.68,-1.5],paint,true);
    box(group,[1.04,.55,.95],[0,1.04,-.48],wingMat,true);
    const helmetMesh=new THREE.Mesh(new THREE.SphereGeometry(.42,12,9),helmet);helmetMesh.position.set(0,1.34,-.33);helmetMesh.castShadow=true;group.add(helmetMesh);
    const visor=box(group,[.7,.15,.27],[0,1.37,-.01],rubber);
    box(group,[.08,.14,1.38],[0,1.63,-.33],carbon);
    box(group,[1.95,.25,.8],[0,.28,2.75],wingMat,true);
    box(group,[2.15,.2,.66],[0,1.08,-2.3],wingMat,true);
    box(group,[.12,.77,.1],[-.93,.71,-2.32],carbon);box(group,[.12,.77,.1],[.93,.71,-2.32],carbon);
    box(group,[.65,.08,.08],[-.85,.62,2.72],gold);box(group,[.65,.08,.08],[.85,.62,2.72],gold);
    box(group,[.3,.13,.2],[-.44,.66,-2.45],lamp);box(group,[.3,.13,.2],[.44,.66,-2.45],lamp);
    const wheels=[];
    for(const x of [-1.05,1.05])for(const z of [-1.56,1.63]){
      const pivot=new THREE.Group();pivot.position.set(x,.43,z);
      const tire=new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.4,16),rubber);tire.rotation.z=Math.PI/2;tire.castShadow=isPlayer; pivot.add(tire);
      const hub=new THREE.Mesh(new THREE.CylinderGeometry(.27,.27,.41,12),carbon);hub.rotation.z=Math.PI/2;pivot.add(hub);
      group.add(pivot);wheels.push(pivot);
    }
    group.scale.setScalar(.98);this.scene.add(group);
    const item={group,wheels};this.cars.push(item);return item;
  }
  placeCar(car,x,z,heading,speed=0,steer=0){
    car.group.position.set(x,.1,z);car.group.rotation.set(0,heading,Math.max(-.075,Math.min(.075,-steer*.045)));
    for(const w of car.wheels)w.rotation.x+=speed*.013;
  }
  updateWeather(wet){
    this.scene.background.setHex(wet>.3?0x657887:0x90b7cf);
    this.scene.fog.color.copy(this.scene.background);
    this.sun.intensity=wet>.3?1.15:2.45;
    this.renderer.toneMappingExposure=wet>.3?1.15:1.35;
    roadMat.color.setHex(wet>.3?0x212b34:0x282e36);
    roadMat.roughness=wet>.3?.45:.9;
  }
  updateRain(car,wet,dt){
    this.rain.visible=!!car&&wet>.27;if(!this.rain.visible)return;
    for(let i=0;i<this.rainCount;i++){const j=i*6;let x=this.rainPositions[j],y=this.rainPositions[j+1],z=this.rainPositions[j+2];y-=this.rainVelocity[i]*dt;x-=dt*9;
      if(y<0){y=20+Math.random()*15;x=(Math.random()-.5)*75;z=(Math.random()-.5)*75;}
      if(x<-38)x=38;this.rainPositions[j]=x;this.rainPositions[j+1]=y;this.rainPositions[j+2]=z;
      this.rainPositions[j+3]=x-1.0;this.rainPositions[j+4]=y-1.75;this.rainPositions[j+5]=z;}
    this.rain.position.set(car.x,0,car.z);this.rainGeo.attributes.position.needsUpdate=true;
  }
  cameraFollow(target,dt){
    if(!target)return;
    const p=target.group.position,theta=target.group.rotation.y,forward=new THREE.Vector3(Math.sin(theta),0,Math.cos(theta));
    let wanted,look;
    if(this.cameraMode===1){wanted=p.clone().addScaledVector(forward,.7).add(new THREE.Vector3(0,1.8,0));look=p.clone().addScaledVector(forward,65).add(new THREE.Vector3(0,1.4,0));}
    else if(this.cameraMode===2){wanted=p.clone().add(new THREE.Vector3(0,65,0));look=p.clone()}
    else{wanted=p.clone().addScaledVector(forward,-12.5).add(new THREE.Vector3(0,5.15,0));look=p.clone().addScaledVector(forward,18).add(new THREE.Vector3(0,1.8,0));}
    this.camera.position.lerp(wanted,Math.min(1,dt*(this.cameraMode===1?12:4.5)));
    this.camTarget.lerp(look,Math.min(1,dt*7));this.camera.lookAt(this.camTarget);
    this.camera.fov=68+Math.min(10,(target.speed||0)*.1);this.camera.updateProjectionMatrix();
  }
  render(){this.renderer.render(this.scene,this.camera)}
}
