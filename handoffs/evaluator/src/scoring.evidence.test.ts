import {test, expect} from 'vitest';
import {evaluate} from './scoring';
import type {Frame,Reference} from './types';
import a from '../public/references/0000.json';
import b from '../public/references/0001.json';
import c from '../public/references/0005.json';
import d from '../public/references/0024.json';
import e from '../public/references/0026.json';
import f from '../public/references/0030.json';
import g from '../public/references/0031.json';
import h from '../public/references/0032.json';
import i from '../public/references/0038.json';
import j from '../public/references/0039.json';
export const fixtures:Reference[]=[a,b,c,d,e,f,g,h,i,j];
export const copy=(frames:Frame[])=>structuredClone(frames);
export const transform=(frames:Frame[],scale=1,dx=0,dy=0)=>frames.map(frame=>({...frame,...Object.fromEntries((['p','l','r'] as const).map(side=>[side,frame[side].map(p=>({...p,x:p.x*scale+dx,y:p.y*scale+dy}))]))}));
export const reverse=(frames:Frame[])=>copy(frames).reverse().map((frame,i)=>({...frame,t:frames[i].t}));
export const still=(frames:Frame[])=>frames.map(frame=>({...structuredClone(frames[Math.floor(frames.length/2)]),t:frame.t}));
export const shiftHands=(frames:Frame[],dy:number)=>frames.map(frame=>({...frame,l:frame.l.map(p=>({...p,y:p.y+dy})),r:frame.r.map(p=>({...p,y:p.y+dy}))}));
export const fist=(frames:Frame[])=>frames.map(frame=>({...frame,...Object.fromEntries((['l','r'] as const).map(side=>[side,frame[side].map((p,k)=>k===0||k===5||k===9||k===13||k===17?p:{...p,x:frame[side][9].x,y:frame[side][9].y})]))}));
test('report reference and controlled perturbation evidence',()=>{
 const rows=fixtures.map(ref=>{
  const variants={self:ref.frames,translated:transform(ref.frames,1,.08,-.04),scaled:transform(ref.frames,.75,.08,.08),reversed:reverse(ref.frames),stationary:still(ref.frames),fist:fist(ref.frames),down:shiftHands(ref.frames,.16),missingLeft:ref.frames.map(f=>({...f,l:[]})),missingRight:ref.frames.map(f=>({...f,r:[]}))};
  const results=Object.fromEntries(Object.entries(variants).map(([name,attempt])=>{const v=evaluate(ref.frames,attempt);return [name,{ok:v.ok,score:v.score??null,metrics:v.metrics??null,feedback:v.feedback,coverage:v.coverage}]}));
  const cross=fixtures.filter(x=>x.id!==ref.id).map(other=>({id:other.id,label:other.label,...evaluate(ref.frames,other.frames)})).sort((a,b)=>(b.score??-1)-(a.score??-1));
  expect(results.self.score).toBe(100);
  return {id:ref.id,label:ref.label,results,cross};
 });
 console.log('EVIDENCE_JSON='+JSON.stringify(rows));
});

// These tests check numerical behavior and abstention, not linguistic correctness.
import {validPose,position} from './scoring';
import {describe} from 'vitest';
const first=fixtures[0].frames;
const mutateAll=(fn:(f:Frame)=>void)=>copy(first).map(f=>{fn(f);return f;});
const abstains=(frames:Frame[])=>{
 const value=evaluate(first,frames);
 expect(value.ok).toBe(false);
 expect(value.score).toBeUndefined();
 expect(value.metrics).toBeUndefined();
 expect(value.path).toBeUndefined();
 expect(Number.isFinite(value.coverage)).toBe(true);
};

describe.each(fixtures)('$label real reference',ref=>{
 test('self comparison is exact and leaves inputs unchanged',()=>{
  const before=JSON.stringify(ref.frames);
  const actual=evaluate(ref.frames,ref.frames);
  expect(actual).toMatchObject({ok:true,score:100,metrics:{shape:100,location:100,movement:100},coverage:1});
  expect(actual.path?.[0]).toEqual([0,0]);
  expect(actual.path?.at(-1)).toEqual([ref.frames.length-1,ref.frames.length-1]);
  expect(JSON.stringify(ref.frames)).toBe(before);
 });
 test('body translation and uniform scale preserve geometry',()=>{
  for(const [scale,dx,dy] of [[1,.08,-.04],[.75,.08,.08],[1.25,-.1,-.1]])
   expect(evaluate(ref.frames,transform(ref.frames,scale,dx,dy)).score).toBe(100);
 });
 test('equivalent coordinates at a different image aspect preserve geometry',()=>{
  const changed=ref.frames.map(frame=>({...frame,aspect:frame.aspect*1.5,
   ...Object.fromEntries((['p','l','r'] as const).map(s=>[s,frame[s].map(p=>({...p,x:p.x/1.5}))]))}));
  expect(evaluate(ref.frames,changed).score).toBe(100);
 });
 test('clock origin and uniform duration changes preserve similarity',()=>{
  const changed=ref.frames.map(f=>({...f,t:f.t*1.8+90000}));
  expect(evaluate(ref.frames,changed).score).toBe(100);
 });
 test('stationary and reversed geometry reduce the movement metric',()=>{
  expect(evaluate(ref.frames,still(ref.frames)).metrics!.movement).toBeLessThan(50);
  expect(evaluate(ref.frames,reverse(ref.frames)).metrics!.movement).toBeLessThan(100);
 });
 test('altering finger geometry lowers shape even with matching wrists',()=>{
  const changed=evaluate(ref.frames,fist(ref.frames));
  expect(changed.metrics!.shape).toBeLessThan(75);
  expect(changed.feedback.some(s=>s.includes('apertura de los dedos'))).toBe(true);
 });
 test.each(['l','r'] as const)('missing %s hand abstains even if it is stationary in the reference',side=>{
  expect(evaluate(ref.frames,ref.frames.map(f=>({...f,[side]:[]})))).toMatchObject({ok:false,coverage:0});
 });
 test('other signs never self-match and always disclose uncertainty',()=>{
  for(const other of fixtures.filter(x=>x.id!==ref.id)){
   const result=evaluate(ref.frames,other.frames);
   expect(result.ok).toBe(true);
   expect(result.score).toBeLessThan(100);
   expect(result.feedback).toContain('Esta similitud visual no confirma que la seña sea correcta en LSC.');
  }
 });
});

describe('invalid and missing input',()=>{
 test.each([NaN,Infinity,-Infinity,0,-1])('rejects invalid aspect %s',aspect=>{
  const frames=mutateAll(f=>{f.aspect=aspect;});
  expect(validPose(frames[0])).toBe(false);
  abstains(frames);
 });
 test.each([NaN,Infinity,-Infinity,-1])('rejects invalid timestamp %s',t=>abstains(mutateAll(f=>{f.t=t;})));
 test('rejects unordered, repeated, and missing timestamps',()=>{
  abstains(copy(first).reverse());
  const repeated=copy(first);repeated[4].t=repeated[3].t;abstains(repeated);
  const absent=copy(first);delete (absent[4] as Partial<Frame>).t;abstains(absent);
 });
 test('rejects empty and very short input',()=>{
  abstains([]);abstains(first.slice(0,1));abstains(first.slice(0,9));
  expect(evaluate(first.slice(0,7),first).ok).toBe(false);
 });
 test.each([0,11,12,13,14])('rejects absent pose anchor %s without throwing',index=>{
  abstains(mutateAll(f=>{delete f.p[index];}));
 });
 test.each(['x','y','z'] as const)('rejects nonfinite pose and hand %s coordinates',coordinate=>{
  for(const invalid of [NaN,Infinity,-Infinity]){
   abstains(mutateAll(f=>{f.p[11][coordinate]=invalid;}));
   abstains(mutateAll(f=>{f.l[20][coordinate]=invalid;}));
   abstains(mutateAll(f=>{f.r[0][coordinate]=invalid;}));
  }
 });
 test('rejects sparse, absent and collapsed hands',()=>{
  abstains(mutateAll(f=>{delete f.l[9];}));
  abstains(mutateAll(f=>{f.r=undefined as unknown as Frame['r'];}));
  abstains(mutateAll(f=>{f.r=Array.from({length:21},()=>({x:0,y:0,z:0}));}));
  abstains(mutateAll(f=>{f.l=Array.from({length:21},()=>({...f.l[0]}));}));
 });
 test('rejects low/nonfinite required pose visibility',()=>{
  for(const visibility of [0,.4,NaN,Infinity])abstains(mutateAll(f=>{f.p[0].visibility=visibility;}));
 });
 test('accepts MediaPipe hand visibility zero defaults',()=>{
  const attempt=mutateAll(f=>{for(const p of [...f.l,...f.r])p.visibility=0;});
  expect(evaluate(first,attempt).score).toBe(100);
 });
 test('rejects nonfinite hand visibility',()=>abstains(mutateAll(f=>{f.l[0].visibility=NaN;})));
 test('rejects insufficient reference visibility',()=>{
  expect(evaluate(mutateAll(f=>{f.r=[];}),first).ok).toBe(false);
 });
 test('handles malformed runtime frames without throwing',()=>{
  abstains([null] as unknown as Frame[]);
  abstains(null as unknown as Frame[]);
  abstains(mutateAll(f=>{f.p=undefined as unknown as Frame['p'];}));
  expect(evaluate(null as unknown as Frame[],first).ok).toBe(false);
  expect(validPose(null as unknown as Frame)).toBe(false);
  expect(position(first[0],[]).every(Number.isNaN)).toBe(true);
 });
 test('ignores optional face data and does not use z as metric depth',()=>{
  const changed=mutateAll(f=>{
   f.f=[{x:NaN,y:NaN,z:NaN}];
   for(const p of [...f.p,...f.l,...f.r])p.z=p.z*50+8;
  });
  expect(evaluate(first,changed).score).toBe(100);
 });
});

describe('coverage and temporal correspondence',()=>{
 test('tolerates an isolated dropped detection and returns original input indices',()=>{
  const attempt=copy(first);attempt[22].l=[];
  const reference=copy(first);reference[17].r=[];
  const result=evaluate(reference,attempt);
  expect(result.ok).toBe(true);
  expect(result.coverage).toBeCloseTo((first.length-1)/first.length,2);
  expect(result.path?.some(([i,j])=>i===17||j===22)).toBe(false);
  expect(result.path?.at(-1)).toEqual([first.length-1,first.length-1]);
  for(let k=1;k<result.path!.length;k++){
   expect(result.path![k][0]).toBeGreaterThanOrEqual(result.path![k-1][0]);
   expect(result.path![k][1]).toBeGreaterThanOrEqual(result.path![k-1][1]);
  }
 });
 test('abstains across a long central or leading outage despite majority coverage',()=>{
  for(const [start,end] of [[18,33],[0,12]]){
   const attempt=copy(first);for(let i=start;i<end;i++)attempt[i].r=[];
   const result=evaluate(first,attempt);
   expect(result.coverage).toBeGreaterThan(.55);
   expect(result.ok).toBe(false);
  }
 });
 test('abstains on detector stalls that supplied no intermediate frames',()=>{
  const attempt=first.filter((_,i)=>i<18||i>33);
  const result=evaluate(first,attempt);
  expect(result.coverage).toBe(1);
  expect(result.ok).toBe(false);
 });
 test('uses elapsed time for nonuniform capture density',()=>{
  const dense=first.flatMap((f,i)=>i<first.length/2?[structuredClone(f),{...structuredClone(f),t:f.t+1}]:[structuredClone(f)]);
  const result=evaluate(first,dense);
  expect(result.ok).toBe(true);
  expect(result.score).toBeGreaterThanOrEqual(98);
 });
 test('vertical feedback uses image y and names the anatomical hand',()=>{
  const down=evaluate(first,shiftHands(first,.16));
  const up=evaluate(first,shiftHands(first,-.16));
  expect(down.feedback.some(s=>s.includes('subir un poco la mano'))).toBe(true);
  expect(up.feedback.some(s=>s.includes('bajar un poco la mano'))).toBe(true);
  const rightOnly=copy(first).map(f=>({...f,r:f.r.map(p=>({...p,y:p.y+.3}))}));
  expect(evaluate(first,rightOnly).feedback.some(s=>s.includes('subir un poco la mano derecha'))).toBe(true);
 });
 test('a low score means a completed comparison, with corrective feedback and no success claim',()=>{
  const result=evaluate(first,still(first));
  expect(result.ok).toBe(true);
  expect(result.score).toBeLessThan(50);
  expect(result.feedback.some(s=>s.includes('trayectoria completa'))).toBe(true);
  expect(result.feedback.some(s=>s.startsWith('Los puntos observados se parecen'))).toBe(false);
  expect(result.feedback).toContain('Esta similitud visual no confirma que la seña sea correcta en LSC.');
 });
});
