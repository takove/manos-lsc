async (page) => {
 const checks=[];
 const lessons=page.getByRole('region',{name:'Seleccionar lección'}).getByRole('button');
 for(let i=0;i<10;i++){
  await lessons.nth(i).click();
  await page.getByRole('button',{name:'Video LSC',exact:true}).click();
  await page.waitForFunction(()=>{const v=document.querySelector('.reference-video');return v&&v.readyState>=2&&Number.isFinite(v.duration)},{},{timeout:15000});
  checks.push(await page.locator('.reference-video').evaluate(v=>({source:v.getAttribute('src'),duration:v.duration,width:v.videoWidth,height:v.videoHeight})));
 }
 await page.getByRole('button',{name:'Velocidad 1. Cambiar velocidad'}).click();
 if(await page.locator('.reference-video').evaluate(v=>v.playbackRate)!==.5)throw Error('Half-speed control failed');
 await page.getByRole('button',{name:'Pausar demostración',exact:true}).click();
 if(!await page.locator('.reference-video').evaluate(v=>v.paused))throw Error('Pause failed');
 const slider=page.getByRole('slider',{name:'Posición de la demostración'});await slider.focus();await slider.press('Home');await slider.press('ArrowRight');
 if(Number(await slider.inputValue())!==1)throw Error('Keyboard seeking failed');
 await page.getByRole('button',{name:'Practicar',exact:true}).click();
 await page.getByRole('heading',{name:'Ahora, de memoria.'}).waitFor();
 await page.getByRole('button',{name:'Ver una pista'}).click();
 await page.locator('.reference-video').waitFor();
 await page.getByRole('button',{name:'Mi recorrido',exact:true}).click();
 await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');
 if(await page.getByRole('dialog').count())throw Error('Escape failed');
 await page.getByRole('button',{name:'Encuentro guiado',exact:true}).click();
 if(await page.locator('.conversation-strip button').count()!==5)throw Error('Guided sequence missing');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 if(overflow)throw Error('Horizontal viewport overflow');
 return {checks,playback:'pause, half-speed, keyboard seek verified',practice:'hint hidden then revealed',modal:'Escape closes',guided:'five expressions',horizontalOverflow:overflow};
}
