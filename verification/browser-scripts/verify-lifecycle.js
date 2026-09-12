async (page) => {
 await page.reload();
 await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const stream=canvas.captureStream(10);window.__lateStream=stream;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.__resolveCamera=resolve);});
 await page.getByRole('button',{name:'Activar mi cámara',exact:true}).click();
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.evaluate(()=>window.__resolveCamera(window.__lateStream));
 await page.waitForFunction(()=>window.__lateStream.getTracks().every(t=>t.readyState==='ended'));
 if(await page.getByRole('button',{name:'Apagar cámara',exact:true}).count())throw Error('Canceled request reactivated');
 const trigger=page.getByRole('button',{name:'Mi recorrido',exact:true});await trigger.click();await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Shift+Tab');
 if(!await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]')))throw Error('Focus escaped dialog');
 await page.keyboard.press('Escape');
 if(!await trigger.evaluate(el=>el===document.activeElement))throw Error('Modal did not return focus');
 return {lateCameraCancellation:'passed; late-arriving stream tracks stopped',modalFocus:'trapped and restored to trigger',physicalCameraUsed:false};
}
