/*
 * CÁMARAS v2.3
 * - Cámara del dispositivo (demo) con getUserMedia.
 * - Cámara IP/LAN/RTSP registrada.
 * - Plataforma del fabricante mediante URL.
 * Nunca inicia una cámara sin una acción explícita del usuario.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;

  CS.startWebcam=async function(id){
    const d=CS.state.devices.find(x=>x.id===id&&x.type==='camera');
    if(!d) return;
    if(!navigator.mediaDevices?.getUserMedia){
      CS.showToast('Cámara no disponible','El navegador no permite acceso a la cámara en este contexto.');
      return;
    }
    try{
      CS.stopWebcam(id);
      const facing=d.facingMode||'environment';
      const video=facing==='default'?true:{facingMode:{ideal:facing}};
      const stream=await navigator.mediaDevices.getUserMedia({video,audio:false});
      CS.webcamStreams.set(id,stream);
      d.state='online';
      await CS.DB.put('devices',d);
      CS.addEvent('Cámara del dispositivo iniciada',`${d.name} comenzó a transmitir después de una acción explícita del usuario.`,'system');
      CS.showToast('Cámara activa',d.name);
      CS.renderCameraGrid();CS.render();CS.renderVisualHome?.();
    }catch(e){
      d.state='offline';await CS.DB.put('devices',d);
      CS.addEvent('Cámara no disponible',`${d.name}: permiso denegado o cámara no disponible.`,'system');
      CS.showToast('No se pudo abrir la cámara','Revisa el permiso del navegador y vuelve a intentarlo.');
      CS.renderCameraGrid();CS.renderVisualHome?.();
    }
  };

  CS.stopWebcam=function(id){
    const stream=CS.webcamStreams.get(id);
    if(stream){stream.getTracks().forEach(t=>t.stop());CS.webcamStreams.delete(id);}
    const d=CS.state.devices.find(x=>x.id===id);
    if(d?.type==='camera'&&d.source==='webcam'){
      d.state='offline';CS.DB.put('devices',d).catch(()=>{});
    }
    CS.renderActiveCameraStatus?.();
  };

  CS.stopAllWebcams=function(){[...CS.webcamStreams.keys()].forEach(id=>CS.stopWebcam(id));};

  CS.openExternalCamera=function(cam){
    const url=String(cam.sourceValue||'').trim();
    if(!/^https?:\/\//i.test(url)){
      CS.showToast('Dirección no compatible','Para abrir desde el navegador usa una URL HTTP o HTTPS.');
      return;
    }
    window.open(url,'_blank','noopener,noreferrer');
    CS.addEvent('Plataforma de cámara abierta',`${cam.name} abrió su dirección externa en una nueva pestaña.`,'system');
  };

  CS.renderActiveCameraStatus=function(){
    const el=document.querySelector('#active-camera-status');
    if(!el) return;
    const count=CS.webcamStreams.size;
    el.hidden=count===0;
    el.querySelector('span').textContent=`${count} cámara${count===1?'':'s'} activa${count===1?'':'s'}`;
  };

  CS.renderCameraGrid=function(){
    const grid=document.querySelector('#camera-grid');if(!grid)return;
    grid.innerHTML='';
    const cameras=CS.state.devices.filter(d=>d.type==='camera');

    if(!cameras.length){
      grid.innerHTML='<article class="card" style="padding:18px"><h3>No hay cámaras configuradas</h3><p class="muted compact">Agrega una cámara del dispositivo, una cámara IP/LAN o un enlace a la plataforma del fabricante.</p></article>';
      CS.renderActiveCameraStatus();
      return;
    }

    cameras.forEach(cam=>{
      const card=document.createElement('article');card.className='camera-card';
      const view=document.createElement('div');view.className='camera-view';
      const stream=CS.webcamStreams.get(cam.id);

      if(cam.source==='webcam'&&stream){
        const video=document.createElement('video');
        video.autoplay=true;video.playsInline=true;video.muted=true;video.srcObject=stream;
        view.append(video);
      }else{
        const p=document.createElement('div');p.className='camera-placeholder';
        const description =
          cam.source==='webcam'?'Cámara del dispositivo detenida':
          cam.source==='ip'?'Cámara IP / LAN registrada':
          cam.source==='vendor'?'Plataforma del fabricante configurada':'Fuente de demostración';
        p.innerHTML=`<span>◉</span><small>${CS.escapeHtml(description)}</small>`;
        view.append(p);
      }

      const meta=document.createElement('div');meta.className='camera-meta';
      const sourceLabel =
        cam.source==='webcam'?'Cámara del dispositivo':
        cam.source==='ip'?'IP / LAN / RTSP':
        cam.source==='vendor'?'Plataforma del fabricante':'Demostración';
      meta.innerHTML=`<h3>${CS.escapeHtml(cam.name)}</h3><p>${CS.escapeHtml(CS.getRoomName(cam.roomId))}</p><span class="camera-source-badge">${sourceLabel}</span>`;

      const privacy=document.createElement('div');privacy.className='camera-privacy-note';
      if(cam.source==='webcam'){
        privacy.innerHTML='<strong>Privacidad:</strong> esta cámara nunca se inicia automáticamente. Debes presionar “Iniciar cámara” y el navegador controla el permiso.';
      }else if(cam.source==='ip'){
        privacy.innerHTML='<strong>Red:</strong> una cámara IP puede estar en Wi‑Fi o Ethernet. RTSP directo no suele reproducirse en una página web; el acceso remoto real requiere gateway/plataforma compatible.';
      }else if(cam.source==='vendor'){
        privacy.innerHTML='<strong>Plataforma externa:</strong> Casa Segura puede abrir el panel web del fabricante si proporcionas una URL HTTPS.';
      }else{
        privacy.innerHTML='<strong>Demo:</strong> esta fuente no transmite video real.';
      }

      const actions=document.createElement('div');actions.className='camera-actions';

      if(cam.source==='webcam'){
        const start=document.createElement('button');
        start.className='btn btn--primary';start.type='button';
        start.textContent=stream?'Reiniciar cámara':'Iniciar cámara';
        start.addEventListener('click',()=>CS.startWebcam(cam.id));

        const stop=document.createElement('button');
        stop.className='btn btn--secondary';stop.type='button';stop.textContent='Detener';
        stop.disabled=!stream;
        stop.addEventListener('click',()=>{
          CS.stopWebcam(cam.id);
          CS.addEvent('Cámara detenida',`${cam.name} dejó de transmitir.`,'system');
          CS.showToast('Cámara detenida',cam.name);
          CS.renderCameraGrid();CS.render();CS.renderVisualHome?.();
        });
        actions.append(start,stop);
      }

      if(['ip','vendor'].includes(cam.source)&&cam.sourceValue){
        const open=document.createElement('button');
        open.className='btn btn--primary';open.type='button';
        open.textContent=cam.source==='vendor'?'Abrir plataforma':'Abrir dirección';
        open.addEventListener('click',()=>CS.openExternalCamera(cam));
        actions.append(open);
      }

      const del=document.createElement('button');
      del.className='btn btn--secondary';del.type='button';del.textContent='Eliminar';
      del.addEventListener('click',()=>CS.removeDevice(cam.id));
      actions.append(del);

      meta.append(privacy,actions);card.append(view,meta);grid.append(card);
    });

    CS.renderActiveCameraStatus();
  };

  CS.initCamerasV23=function(){
    document.querySelector('#add-camera-button').addEventListener('click',()=>CS.addDeviceFlow('camera'));
    CS.renderCameraGrid();CS.renderActiveCameraStatus();
  };
})();
