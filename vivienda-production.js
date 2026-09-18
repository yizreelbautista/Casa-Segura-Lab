/*
 * CASA SEGURA — VIVIENDA DE PRODUCCIÓN
 * La vivienda inicial es una configuración normal y totalmente editable.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  const labels={door:'Puerta',window:'Ventana',motion:'Movimiento',camera:'Cámara'};
  const zoneLabels={front:'Frente',left:'Lateral izquierdo',right:'Lateral derecho',back:'Parte trasera',interior:'Interior'};

  CS.uid=prefix=>`${prefix}-${Date.now()}-${Math.floor(Math.random()*10000)}`;
  CS.getRoomName=id=>CS.state.rooms.find(r=>r.id===id)?.name||'Sin ubicación';
  CS.escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  CS.openModal=function(title,html,onSubmit){
    const back=document.querySelector('#modal-backdrop'),form=document.querySelector('#dynamic-form');
    document.querySelector('#modal-title').textContent=title;
    form.innerHTML=html;back.hidden=false;
    form.onsubmit=async e=>{
      e.preventDefault();
      const close=await onSubmit(new FormData(form),form);
      if(close!==false)CS.closeModal();
    };
  };
  CS.closeModal=function(){document.querySelector('#modal-backdrop').hidden=true;document.querySelector('#dynamic-form').innerHTML='';};

  function visualZoneOptions(selected='interior'){
    return Object.entries(zoneLabels).map(([v,l])=>`<option value="${v}" ${v===selected?'selected':''}>${l}</option>`).join('');
  }

  CS.addRoomFlow=function(){
    CS.openModal('Agregar habitación',`
      <label for="room-name">Nombre de la habitación</label>
      <input id="room-name" name="name" required maxlength="50" placeholder="Ej. Sala 2, Recámara 4">
      <label for="room-type">Tipo</label>
      <select id="room-type" name="type">
        <option>Sala</option><option>Recámara</option><option>Cocina</option><option>Baño</option>
        <option>Patio</option><option>Garaje</option><option>Pasillo</option><option>Servicio</option>
        <option>Bodega</option><option>Otro</option>
      </select>
      <div class="modal-note">Puedes crear tantas habitaciones como necesites.</div>
      <button class="btn btn--primary btn--block" type="submit">Agregar habitación</button>`,
      async data=>{
        const name=String(data.get('name')||'').trim();if(!name)return false;
        const room={id:CS.uid('room'),homeId:CS.state.home.id,name,type:String(data.get('type'))};
        CS.state.rooms.push(room);await CS.DB.put('rooms',room);
        CS.addEvent('Habitación agregada',`${name} se agregó a ${CS.state.home.name}.`,'system');
        CS.showToast('Habitación agregada',name);CS.renderHomeEditor();CS.render();
      });
  };

  CS.addDeviceFlow=function(type,forcedRoomId){
    if(!CS.state.rooms.length){CS.showToast('Primero crea una habitación','Los dispositivos necesitan una ubicación.');return;}
    const opts=CS.state.rooms.map(r=>`<option value="${r.id}" ${r.id===forcedRoomId?'selected':''}>${CS.escapeHtml(r.name)}</option>`).join('');
    const cameraFields=type==='camera'?`
      <label for="camera-source">Fuente de cámara</label>
      <select id="camera-source" name="source">
        <option value="webcam">Cámara del dispositivo</option>
        <option value="ip">Cámara IP / LAN / RTSP</option>
        <option value="vendor">Plataforma del fabricante</option>
        <option value="demo">Fuente sin video</option>
      </select>
      <label for="camera-facing">Cámara del dispositivo</label>
      <select id="camera-facing" name="facingMode">
        <option value="environment">Trasera / entorno</option>
        <option value="user">Frontal</option>
        <option value="default">Predeterminada</option>
      </select>
      <label for="camera-source-value">Dirección, stream o plataforma (opcional)</label>
      <input id="camera-source-value" name="sourceValue" placeholder="https://..., http://192.168..., rtsp://...">`: '';

    CS.openModal(`Agregar ${labels[type]||'dispositivo'}`,`
      <label for="device-name">Nombre</label>
      <input id="device-name" name="name" required maxlength="60" placeholder="Ej. Ventana sala 2">
      <label for="device-room">Ubicación</label>
      <select id="device-room" name="roomId">${opts}</select>
      <label for="device-visual-zone">Ubicación visual aproximada</label>
      <select id="device-visual-zone" name="visualZone">${visualZoneOptions(type==='door'?'interior':'front')}</select>
      ${cameraFields}
      <div class="modal-note">La ubicación visual es una referencia de monitoreo y puede modificarse después.</div>
      <button class="btn btn--primary btn--block" type="submit">Agregar dispositivo</button>`,
      async data=>{
        const name=String(data.get('name')||'').trim(),roomId=String(data.get('roomId')||'');
        if(!name||!roomId)return false;
        const zone=String(data.get('visualZone')||'interior');
        const sameZone=CS.state.devices.filter(d=>d.visualZone===zone).length;
        const d={id:CS.uid(type),homeId:CS.state.home.id,roomId,type,name,enabled:true,
          state:type==='motion'?'idle':type==='camera'?'offline':'closed',visualZone:zone,visualSlot:sameZone};
        if(type==='camera'){
          d.source=String(data.get('source')||'demo');
          d.sourceValue=String(data.get('sourceValue')||'');
          d.facingMode=String(data.get('facingMode')||'environment');
        }
        CS.state.devices.push(d);await CS.DB.put('devices',d);
        CS.addEvent(`${labels[type]} agregado`,`${name} · ${CS.getRoomName(roomId)}.`,'system');
        CS.showToast('Dispositivo agregado',name);CS.renderHomeEditor();CS.render();
      });
  };

  CS.editDeviceFlow=function(id){
    const d=CS.state.devices.find(x=>x.id===id);if(!d)return;
    const opts=CS.state.rooms.map(r=>`<option value="${r.id}" ${r.id===d.roomId?'selected':''}>${CS.escapeHtml(r.name)}</option>`).join('');
    CS.openModal('Editar dispositivo',`
      <label for="edit-device-name">Nombre</label>
      <input id="edit-device-name" name="name" required maxlength="60" value="${CS.escapeHtml(d.name)}">
      <label for="edit-device-room">Habitación</label>
      <select id="edit-device-room" name="roomId">${opts}</select>
      <label for="edit-device-zone">Ubicación visual</label>
      <select id="edit-device-zone" name="visualZone">${visualZoneOptions(d.visualZone||'interior')}</select>
      <label for="edit-device-enabled">Estado del dispositivo</label>
      <select id="edit-device-enabled" name="enabled">
        <option value="true" ${d.enabled!==false?'selected':''}>Activo</option>
        <option value="false" ${d.enabled===false?'selected':''}>Desactivado</option>
      </select>
      <button class="btn btn--primary btn--block" type="submit">Guardar cambios</button>`,
      async data=>{
        d.name=String(data.get('name')||'').trim();d.roomId=String(data.get('roomId')||'');
        d.visualZone=String(data.get('visualZone')||'interior');d.enabled=String(data.get('enabled'))==='true';
        await CS.DB.put('devices',d);
        CS.addEvent('Dispositivo actualizado',`${d.name} fue modificado.`,'system');
        CS.showToast('Cambios guardados',d.name);CS.renderHomeEditor();CS.render();
      });
  };

  CS.editRoomFlow=function(roomId){
    const r=CS.state.rooms.find(x=>x.id===roomId);if(!r)return;
    CS.openModal('Editar habitación',`
      <label for="edit-room-name">Nombre</label>
      <input id="edit-room-name" name="name" required maxlength="50" value="${CS.escapeHtml(r.name)}">
      <label for="edit-room-type">Tipo</label>
      <select id="edit-room-type" name="type">
        ${['Sala','Recámara','Cocina','Baño','Patio','Garaje','Pasillo','Servicio','Bodega','Otro'].map(x=>`<option ${x===r.type?'selected':''}>${x}</option>`).join('')}
      </select>
      <button class="btn btn--primary btn--block" type="submit">Guardar habitación</button>`,
      async data=>{
        r.name=String(data.get('name')||'').trim();r.type=String(data.get('type')||'Otro');
        await CS.DB.put('rooms',r);CS.addEvent('Habitación actualizada',r.name,'system');
        CS.showToast('Habitación actualizada',r.name);CS.renderHomeEditor();CS.render();
      });
  };

  CS.removeRoom=async function(roomId){
    const room=CS.state.rooms.find(r=>r.id===roomId);if(!room)return;
    const linked=CS.state.devices.filter(d=>d.roomId===roomId);
    const ok=await CS.confirmAction('Eliminar habitación',`Se eliminará “${room.name}” y ${linked.length} dispositivo(s) asociados.`,'Eliminar');
    if(!ok)return;
    for(const d of linked){CS.stopWebcam?.(d.id);await CS.DB.delete('devices',d.id);}
    await CS.DB.delete('rooms',roomId);
    CS.state.rooms=CS.state.rooms.filter(r=>r.id!==roomId);
    CS.state.devices=CS.state.devices.filter(d=>d.roomId!==roomId);
    CS.addEvent('Habitación eliminada',room.name,'system');CS.renderHomeEditor();CS.render();
  };

  CS.removeDevice=async function(id){
    const d=CS.state.devices.find(x=>x.id===id);if(!d)return;
    const ok=await CS.confirmAction('Eliminar dispositivo',`“${d.name}” dejará de formar parte del monitoreo.`,'Eliminar');
    if(!ok)return;
    CS.stopWebcam?.(id);await CS.DB.delete('devices',id);
    CS.state.devices=CS.state.devices.filter(x=>x.id!==id);
    CS.addEvent('Dispositivo eliminado',d.name,'system');CS.renderHomeEditor();CS.render();
  };

  CS.deviceIcon=type=>({door:'▯',window:'▭',motion:'◌',camera:'◉'})[type]||'•';
  CS.deviceStatusText=d=>{
    if(d.enabled===false)return'Desactivado';
    if(d.type==='camera')return d.source==='webcam'?(d.state==='online'?'Cámara activa':'Cámara detenida'):d.source==='ip'?'Cámara IP / LAN configurada':d.source==='vendor'?'Plataforma del fabricante':'Fuente configurada';
    if(d.type==='motion')return d.state==='active'?'Movimiento detectado':'Sin movimiento';
    return d.state==='open'?'ABIERTA':'CERRADA';
  };

  CS.quickAddDevice=function(roomId){
    CS.openModal(`Agregar en ${CS.getRoomName(roomId)}`,`
      <label for="quick-type">Tipo de dispositivo</label>
      <select id="quick-type" name="type">
        <option value="door">Puerta</option><option value="window">Ventana</option>
        <option value="motion">Sensor de movimiento</option><option value="camera">Cámara</option>
      </select>
      <button class="btn btn--primary btn--block" type="submit">Continuar</button>`,
      async data=>{const type=String(data.get('type'));CS.closeModal();setTimeout(()=>CS.addDeviceFlow(type,roomId),40);return false;});
  };

  CS.renderHomeEditor=function(){
    const editor=document.querySelector('#home-editor');if(!editor||!CS.state.home)return;
    document.querySelector('#editor-home-name').textContent=CS.state.home.name;
    document.querySelector('#home-name-input').value=CS.state.home.name;
    document.querySelector('#home-name-input').disabled=false;
    document.querySelector('#save-home-name').disabled=false;

    const mt=document.querySelector('#active-home-mode-title'),mc=document.querySelector('#active-home-mode-copy'),ms=document.querySelector('#active-home-mode-state');
    if(mt)mt.textContent=CS.state.home.name;if(mc)mc.textContent='Configuración residencial editable.';
    if(ms){ms.textContent='ACTIVA';ms.classList.add('is-user');}

    editor.innerHTML='';
    if(!CS.state.rooms.length){
      editor.innerHTML='<div class="empty-state"><div><strong>La vivienda no tiene habitaciones.</strong><br><br>Agrega una habitación para comenzar.</div></div>';
      return;
    }

    CS.state.rooms.forEach(room=>{
      const card=document.createElement('article');card.className='room-card';
      const head=document.createElement('div');head.className='room-header';
      const title=document.createElement('div');title.innerHTML=`<h4>${CS.escapeHtml(room.name)}</h4><small>${CS.escapeHtml(room.type)}</small>`;
      const actions=document.createElement('div');actions.className='room-header-actions';
      const editRoom=document.createElement('button');editRoom.type='button';editRoom.textContent='✎';editRoom.title='Editar habitación';editRoom.addEventListener('click',()=>CS.editRoomFlow(room.id));
      const plus=document.createElement('button');plus.type='button';plus.textContent='+';plus.title='Agregar dispositivo';plus.addEventListener('click',()=>CS.quickAddDevice(room.id));
      const del=document.createElement('button');del.type='button';del.textContent='×';del.title='Eliminar habitación';del.addEventListener('click',()=>CS.removeRoom(room.id));
      actions.append(editRoom,plus,del);head.append(title,actions);

      const list=document.createElement('div');list.className='room-devices';
      const devices=CS.state.devices.filter(d=>d.roomId===room.id);
      if(!devices.length){const empty=document.createElement('small');empty.className='muted';empty.textContent='Sin dispositivos asociados.';list.append(empty);}
      devices.forEach(d=>{
        const item=document.createElement('div');item.className='room-device';
        const row=document.createElement('div');row.className='room-device-row';
        const copy=document.createElement('div');
        const strong=document.createElement('strong');strong.textContent=`${CS.deviceIcon(d.type)} ${d.name}`;
        const small=document.createElement('small');small.textContent=CS.deviceStatusText(d);
        const zone=document.createElement('span');zone.className='visual-zone-badge';zone.textContent=zoneLabels[d.visualZone||'interior']||'Interior';
        copy.append(strong,small,zone);row.append(copy);
        if(['door','window'].includes(d.type)){
          const btn=document.createElement('button');btn.type='button';btn.className='sensor-action'+(d.state==='open'?' is-open':'');
          btn.textContent=d.state==='open'?'Cerrar':'Abrir';btn.addEventListener('click',()=>CS.toggleAccessDevice(d.id));row.append(btn);
        }
        item.append(row);
        const controls=document.createElement('div');controls.className='device-edit-row';
        const eb=document.createElement('button');eb.type='button';eb.textContent='Editar';eb.addEventListener('click',()=>CS.editDeviceFlow(d.id));
        const db=document.createElement('button');db.type='button';db.textContent='Eliminar';db.addEventListener('click',()=>CS.removeDevice(d.id));
        controls.append(eb,db);item.append(controls);list.append(item);
      });
      const add=document.createElement('button');add.type='button';add.className='btn btn--secondary room-add';add.textContent='Agregar dispositivo';add.addEventListener('click',()=>CS.quickAddDevice(room.id));
      card.append(head,list,add);editor.append(card);
    });
  };

  CS.renderDeviceTable=function(){
    const body=document.querySelector('#device-table-body');if(!body)return;body.innerHTML='';
    if(!CS.state.devices.length){body.innerHTML='<tr><td colspan="5">No hay dispositivos configurados.</td></tr>';return;}
    CS.state.devices.forEach(d=>{
      const tr=document.createElement('tr');
      [d.name,labels[d.type]||d.type,CS.getRoomName(d.roomId),CS.deviceStatusText(d)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td);});
      const td=document.createElement('td');td.className='table-actions';
      if(['door','window'].includes(d.type)){const sim=document.createElement('button');sim.className='mini-btn';sim.type='button';sim.textContent=d.state==='open'?'Cerrar':'Abrir';sim.addEventListener('click',()=>CS.toggleAccessDevice(d.id));td.append(sim);}
      const edit=document.createElement('button');edit.className='mini-btn';edit.type='button';edit.textContent='Editar';edit.addEventListener('click',()=>CS.editDeviceFlow(d.id));td.append(edit);
      const del=document.createElement('button');del.className='mini-btn mini-btn--danger';del.type='button';del.textContent='Eliminar';del.addEventListener('click',()=>CS.removeDevice(d.id));td.append(del);
      tr.append(td);body.append(tr);
    });
  };

  CS.initHomeV23=function(){
    document.querySelectorAll('[data-add]').forEach(btn=>btn.addEventListener('click',()=>btn.dataset.add==='room'?CS.addRoomFlow():CS.addDeviceFlow(btn.dataset.add)));
    document.querySelector('#modal-close').addEventListener('click',CS.closeModal);
    document.querySelector('#save-home-name').addEventListener('click',async function(){
      const value=document.querySelector('#home-name-input').value.trim();if(!value)return;
      CS.state.home.name=value;await CS.DB.put('homes',CS.state.home);
      CS.addEvent('Vivienda actualizada',`El nombre cambió a ${value}.`,'system');
      CS.showToast('Nombre actualizado',value);CS.renderHomeEditor();CS.render();
    });
    CS.renderHomeEditor();
  };
})();
