async () => {
 const v=document.createElement('video');v.src='/references/0030.mp4';v.muted=true;v.loop=true;v.playsInline=true;await v.play();
 const canvas=document.createElement('canvas');canvas.width=760;canvas.height=820;const ctx=canvas.getContext('2d');
 const draw=()=>{ctx.drawImage(v,620,230,760,820,0,0,760,820);requestAnimationFrame(draw);};draw();
 const source=canvas.captureStream(24);window.__cameraFixture={video:v,stream:source,starts:0};
 navigator.mediaDevices.getUserMedia=async()=>source;
 new MutationObserver(()=>{if(document.querySelector('.recording-pill')&&!window.__cameraFixture.started){window.__cameraFixture.started=true;window.__cameraFixture.starts++;v.loop=false;v.currentTime=0;v.play();}}).observe(document.body,{childList:true,subtree:true});
 return 'Recorded Hola camera fixture: full-resolution source, crop x620 y230 w760 h820, no generated motion';
}
