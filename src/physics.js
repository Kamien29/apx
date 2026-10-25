import {COMPOUNDS,clamp} from './data.js';
export const MASS=795;
const WHEELBASE=3.45,FRONT=1.65,REAR=WHEELBASE-FRONT,INERTIA=1650;
export function tireGrip(compound,wetness,wear){
  const tire=COMPOUNDS[compound]||COMPOUNDS.medium;
  let wetFactor;
  if(compound==='wet')wetFactor=.64+Math.min(1,wetness*1.6)*.53;
  else if(compound==='intermediate')wetFactor=.76+Math.min(1,wetness*1.8)*.35;
  else wetFactor=1-wetness*.65;
  return tire.grip*wetFactor*(1-.48*clamp(wear,0,1));
}
export function createDynamics(x,z,heading,compound='medium'){
  return {x,z,heading,vx:0,vy:0,yawRate:0,steering:0,gear:1,rpm:3100,compound,tireWear:0,fuel:100,ers:100,damage:0,drs:false,offroad:false,boost:false,brakeLight:0,tireTemp:86,brakeTemp:320};
}
export function stepDynamics(c,controls,environment,dt,upgrades={}){
  dt=clamp(dt,0,1/45);
  const engine=(upgrades.engine||0)*.052, aero=(upgrades.aero||0)*.065, handling=(upgrades.handling||0)*.058;
  const throttle=clamp(controls.throttle||0,0,1),brake=clamp(controls.brake||0,0,1),steer=clamp(controls.steer||0,-1,1);
  c.steering+=(steer-c.steering)*Math.min(1,dt*8);
  c.offroad=Math.abs(environment.offset||0)>environment.width*.5-.5;
  const wetness=environment.wetness||0;
  // Uproszczona dynamika termiczna: rozgrzewanie przy obciążeniu i chłodzenie pędem powietrza.
  c.tireTemp??=86;c.brakeTemp??=320;
  const targetT=['wet','intermediate'].includes(c.compound)?72:94;
  const thermalGrip=clamp(1-Math.abs(c.tireTemp-targetT)*.0027,.77,1);
  const brakeFade=c.brakeTemp>780?clamp(1-(c.brakeTemp-780)*.00072,.72,1):1;
  const grip=tireGrip(c.compound,wetness,c.tireWear)*thermalGrip;
  const surface=c.offroad?0.43:1;
  const mu=1.75*grip*surface*(1+handling)*(1-.42*c.damage);
  const downforce=c.vx*c.vx*(1.22+aero*.8)*(c.drs?.76:1);
  const normal=MASS*9.81+downforce;
  const frontLoad=normal*.49,rearLoad=normal*.51;
  const turn=c.steering*(.34/(1+c.vx*.048)+.03);
  const af=Math.atan2(c.vy+FRONT*c.yawRate,Math.max(6,c.vx))-turn;
  const ar=Math.atan2(c.vy-REAR*c.yawRate,Math.max(6,c.vx));
  const frontForce=clamp(-90000*(1+aero)*af,-mu*frontLoad,mu*frontLoad);
  const rearForce=clamp(-100000*(1+aero*.5)*ar,-mu*rearLoad,mu*rearLoad);
  const drag=(c.drs?.54:.83)*c.vx*c.vx*(1+aero*.12);
  const rolling=210+c.vx*3;
  const boost=controls.boost&&c.ers>1;
  c.boost=!!boost;
  let drive=throttle*11900*(1+engine)*Math.max(.04,1-Math.pow(Math.max(0,c.vx/106),1.8));
  if(boost){drive+=4200;c.ers=Math.max(0,c.ers-15*dt)}else c.ers=Math.min(100,c.ers+(brake?11:1.7)*dt);
  const braking=brake*20500*(1+.12*handling)*brakeFade;
  if(c.offroad)drive*=.62;
  const ax=(drive-braking-drag-rolling)/MASS + c.vy*c.yawRate;
  const ay=(frontForce+rearForce)/MASS - c.vx*c.yawRate;
  c.vx=clamp(c.vx+ax*dt,0,105);
  c.vy=clamp(c.vy+ay*dt,-Math.max(3,c.vx*.6),Math.max(3,c.vx*.6));
  if(controls.stability)c.vy*=Math.max(0,1-dt*1.35);
  c.yawRate=clamp(c.yawRate+(FRONT*frontForce-REAR*rearForce)/INERTIA*dt,-1.85,1.85);
  c.yawRate*=1-dt*.14;
  if(c.vx<2){c.vy*=1-dt*7;c.yawRate*=1-dt*6;}
  c.heading+=c.yawRate*dt;
  c.x+=(Math.sin(c.heading)*c.vx+Math.cos(c.heading)*c.vy)*dt;
  c.z+=(Math.cos(c.heading)*c.vx-Math.sin(c.heading)*c.vy)*dt;
  const wear=COMPOUNDS[c.compound]?.wear||1;
  const wetExtra=(environment.wetness||0)>.3&& !['wet','intermediate'].includes(c.compound)?1.15:1;
  c.tireWear=clamp(c.tireWear+dt*.00265*wear*wetExtra*(.5+c.vx/52+Math.abs(c.vy)/12),0,1);
  c.fuel=clamp(c.fuel-dt*(.028+throttle*.058),0,100);
  if(c.fuel<=.1)c.vx=Math.min(c.vx,15);
  c.gear=clamp(Math.floor(c.vx/10.8)+1,1,8);
  c.rpm=Math.floor(3600+((c.vx%10.8)/10.8)*7700);
  const coolingBase=wetness>.35?57:75;
  c.tireTemp=clamp(c.tireTemp+dt*(1.7*c.vx/45+Math.abs(c.vy)*.55+brake*.8-(c.tireTemp-coolingBase)*(.026+.00055*c.vx)),38,153);
  c.brakeTemp=clamp(c.brakeTemp+dt*(brake*(82+1.4*c.vx)-(c.brakeTemp-145)*(.035+c.vx*.0017)),85,1100);
  c.brakeLight=brake;
  return c;
}
