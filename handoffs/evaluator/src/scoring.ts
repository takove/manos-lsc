import {dtw} from './dtw';
import type {Frame,Point} from './types';

/** ok means a comparison was possible, never that an LSC sign was correct. */
export type Evaluation = {ok:boolean;score?:number;metrics?:{shape:number;location:number;movement:number};feedback:string[];path?:[number,number][];coverage:number};
type Side = 'l'|'r';
type IndexedFrame = {frame:Frame;index:number};
const sides:Side[]=['l','r'];
const finitePoint=(p:Point|undefined):p is Point=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&
 (p.visibility===undefined||Number.isFinite(p.visibility));

function body(f:Frame){
 const a=f.p[11],b=f.p[12];
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,s:Math.hypot((a.x-b.x)*f.aspect,a.y-b.y)};
}
export function validPose(f:Frame){
 if(!f||!Number.isFinite(f.aspect)||f.aspect<=0||!Number.isFinite(f.t)||f.t<0||!Array.isArray(f.p)||f.p.length<25)return false;
 // Only these anchors are required; lower-body visibility is irrelevant to this comparison.
 if(![0,11,12,13,14].every(i=>finitePoint(f.p[i])&&(f.p[i].visibility??1)>.4))return false;
 const b=body(f);
 return Number.isFinite(b.x)&&Number.isFinite(b.y)&&Number.isFinite(b.s)&&Math.abs(f.p[11].x-f.p[12].x)*f.aspect>.08;
}
/** Body-relative 2D wrist position. Invalid input yields an explicitly invalid vector. */
export function position(f:Frame,h:Point[]){
 if(!validPose(f)||!Array.isArray(h)||!finitePoint(h[0]))return [NaN,NaN];
 const b=body(f);
 return [(h[0].x-b.x)*f.aspect/b.s,(h[0].y-b.y)/b.s];
}
function palmSize(h:Point[],aspect:number){return Math.hypot((h[9].x-h[0].x)*aspect,h[9].y-h[0].y);}
function present(h:Point[],aspect:number){
 // MediaPipe HandLandmarker emits visibility:0 when the protobuf has no visibility.
 // It is not a hand-presence confidence; do not apply the pose visibility threshold here.
 if(!Array.isArray(h)||h.length!==21||!Array.from(h).every(finitePoint))return false;
 const size=palmSize(h,aspect);
 // A collapsed/zero hand cannot supply a scale or orientation. No fixed hand-size clamp:
 // such a clamp changes the shape score merely when the signer moves farther away.
 return Number.isFinite(size)&&size>0&&h.every(p=>Number.isFinite((p.x-h[0].x)*aspect/size)&&Number.isFinite((p.y-h[0].y)/size));
}
function needed(f:Frame){return validPose(f)&&sides.every(side=>present(f[side],f.aspect));}
function shape(h:Point[],aspect:number){
 const w=h[0],s=palmSize(h,aspect);
 return h.flatMap(p=>[(p.x-w.x)*aspect/s,(p.y-w.y)/s]);
}
function timeline(frames:Frame[]){
 // Reference t = frameIndex * 1000 / fps; live t = performance.now(), both milliseconds.
 // Different clock origins and signing speeds are allowed. Reordering or duplicate clocks
 // are not repaired silently because doing so would invent temporal evidence.
 return Array.isArray(frames)&&frames.length>1&&Array.from(frames).every((f,i)=>
  !!f&&Number.isFinite(f.t)&&f.t>=0&&(i===0||f.t>frames[i-1].t));
}
function visible(frames:Frame[]){return frames.map((frame,index)=>({frame,index})).filter(x=>needed(x.frame));}
function coverageOf(frames:Frame[],good:IndexedFrame[]){
 if(!frames.length||!good.length)return 0;
 const duration=frames[frames.length-1].t-frames[0].t;
 const seen=new Set(good.map(x=>x.index));
 let covered=0;
 for(let i=0;i<frames.length;i++){
  const start=i===0?frames[i].t:(frames[i-1].t+frames[i].t)/2;
  const end=i===frames.length-1?frames[i].t:(frames[i].t+frames[i+1].t)/2;
  if(seen.has(i))covered+=end-start;
 }
 return Math.min(good.length/frames.length,covered/duration);
}
function hasGap(frames:Frame[],good:IndexedFrame[]){
 const start=frames[0].t,end=frames[frames.length-1].t;
 // Engineering abstention heuristic, not a validated LSC threshold. Do not stitch together
 // visible fragments across a long tracking outage (including absent detector frames).
 const limit=Math.max(250,(end-start)*.15);
 const times=[start,...good.map(x=>x.frame.t),end];
 return times.some((t,i)=>i>0&&t-times[i-1]>limit);
}
function sample(frames:IndexedFrame[],n=48){
 if(frames.length<=n)return frames;
 const start=frames[0].frame.t,end=frames[frames.length-1].frame.t;
 let j=0;
 return Array.from({length:n},(_,i)=>{
  const target=start+i*(end-start)/(n-1);
  while(j+1<frames.length&&Math.abs(frames[j+1].frame.t-target)<Math.abs(frames[j].frame.t-target))j++;
  return frames[j];
 });
}
const rms=(a:number[],b:number[])=>Math.sqrt(a.reduce((sum,v,i)=>sum+(v-b[i])**2,0)/a.length);
const ranges=(seq:number[][])=>seq[0].map((_,i)=>Math.max(...seq.map(p=>p[i]))-Math.min(...seq.map(p=>p[i])));
const score=(d:number,scale:number)=>Math.round(100*Math.exp(-d/scale));
const referenceFailure=(feedback:string):Evaluation=>({ok:false,coverage:0,feedback:[feedback]});

export function evaluate(reference:Frame[],attempt:Frame[]):Evaluation{
 if(!timeline(reference))return referenceFailure('La referencia tiene tiempos inválidos. Prueba otra lección.');
 const referenceVisible=visible(reference);
 if(referenceVisible.length<8||coverageOf(reference,referenceVisible)<.55||hasGap(reference,referenceVisible))
  return referenceFailure('La referencia no permite ver el cuerpo y las dos manos durante toda la seña. Prueba otra lección.');
 if(!timeline(attempt))return {ok:false,coverage:0,feedback:['No pude ordenar el movimiento en el tiempo. Repite la grabación.']};
 const live=visible(attempt),coverage=coverageOf(attempt,live);
 if(live.length<10||coverage<.55||hasGap(attempt,live))return {ok:false,coverage,feedback:[
  'No pude ver toda la seña. Incluye la cara, los hombros y ambas manos dentro de la cámara.',
  'Mejora la luz y repite sin salir del encuadre.'
 ]};
 const rr=sample(referenceVisible),aa=sample(live);
 const features=(frames:IndexedFrame[])=>frames.map(({frame})=>sides.map(side=>({
  location:position(frame,frame[side]),shape:shape(frame[side],frame.aspect)
 })));
 const rf=features(rr),af=features(aa);
 // Align both position and finger geometry. Wrist-only alignment can pair unrelated
 // handshapes whenever the wrist pauses. Normalize dimensions using the score scales.
 const align=(seq:typeof rf)=>seq.map(hands=>hands.flatMap(hand=>[
  ...hand.location.map(v=>v/(.6*Math.sqrt(2))),
  ...hand.shape.map(v=>v/(.8*Math.sqrt(42)))
 ]));
 const alignment=dtw(align(rf),align(af));
 if(!alignment.path.length||!Number.isFinite(alignment.distance))return {ok:false,coverage,feedback:['Los puntos del movimiento no se pudieron comparar. Repite la grabación.']};
 const errors=sides.map((_,side)=>{
  let shapeError=0,locationError=0,movementError=0,dy=0;
  for(const [i,j] of alignment.path){
   const x=rf[i][side],y=af[j][side];
   shapeError+=rms(x.shape,y.shape);
   locationError+=rms(x.location,y.location);
   // Use the same temporal correspondence for all three metrics. A second unconstrained
   // warp would let the movement score disagree with the displayed shape/location path.
   movementError+=rms(x.location.map((v,k)=>v-rf[0][side].location[k]),y.location.map((v,k)=>v-af[0][side].location[k]));
   dy+=y.location[1]-x.location[1];
  }
  const count=alignment.path.length;
  shapeError/=count;locationError/=count;movementError/=count;dy/=count;
  const referenceExtent=ranges(rf.map(h=>h[side].location)).reduce((a,b)=>a+b,0);
  const attemptExtent=ranges(af.map(h=>h[side].location)).reduce((a,b)=>a+b,0);
  if(referenceExtent>.25&&attemptExtent<referenceExtent*.25)movementError+=.8;
  return {shapeError,locationError,movementError,dy};
 });
 // Matching an idle hand must not hide differences in the other hand. These are
 // uncalibrated engineering similarity scales, not correctness or pass/fail thresholds.
 const metrics={
  shape:score(Math.max(...errors.map(e=>e.shapeError)),.8),
  location:score(Math.max(...errors.map(e=>e.locationError)),.6),
  movement:score(Math.max(...errors.map(e=>e.movementError)),.6)
 };
 const overall=Math.round(metrics.shape*.45+metrics.location*.30+metrics.movement*.25);
 const feedback:string[]=[];
 if(metrics.location<75){
  const side=errors[0].locationError>=errors[1].locationError?0:1;
  const hand=side===0?'mano izquierda':'mano derecha';
  const dy=errors[side].dy;
  feedback.push(dy>.15?`Prueba subir un poco la ${hand} para acercarte a la altura del ejemplo.`:
   dy<-.15?`Prueba bajar un poco la ${hand} para acercarte a la altura del ejemplo.`:
   `Mira dónde empieza y termina la ${hand} respecto a tus hombros.`);
 }
 if(metrics.shape<75)feedback.push('Compara la apertura de los dedos y la dirección de la mano con el video.');
 if(metrics.movement<75)feedback.push('Repite la trayectoria completa: observa el punto de inicio, la dirección y el final.');
 if(!feedback.length)feedback.push('Los puntos observados se parecen al ejemplo. Mira también la expresión y la orientación de la palma en el video.');
 feedback.push('Esta similitud visual no confirma que la seña sea correcta en LSC.');
 return {ok:true,score:overall,metrics,feedback,
  // Consumers need indices into the original inputs, not filtered/downsampled arrays.
  path:alignment.path.map(([i,j])=>[rr[i].index,aa[j].index]),coverage};
}
