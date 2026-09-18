/*
 * CASA SEGURA — INTERFAZ VISUAL FINAL
 * - La vivienda inicial usa dispositivos preconfigurados sobre la escena base.
 * - Los dispositivos añadidos por el usuario se distribuyen automáticamente por zona visual.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  const state={mode:'interior',yaw:0,zoom:1,panX:0,panY:0,drag:false,lastX:0,lastY:0,selected:null,personLocation:'exterior',moving:false};
  const el={};

  const demoConfig={
      'door-main':{type:'door',icon:'▯'},'door-kitchen':{type:'door',icon:'▯',sideOpen:true},
      'door-bedroom1':{type:'door',icon:'▯'},'door-bedroom2':{type:'door',icon:'▯'},'door-bathroom':{type:'door',icon:'▯'},
      'window-living':{type:'window',icon:'▭'},'window-living-side':{type:'window',icon:'▭'},
      'window-kitchen-front':{type:'window',icon:'▭'},'window-kitchen-side':{type:'window',icon:'▭'},
      'window-bedroom':{type:'window',icon:'▭'},'window-bedroom1-extra':{type:'window',icon:'▭'},
      'window-bedroom2':{type:'window',icon:'▭'},'window-bedroom2-extra':{type:'window',icon:'▭'},
      'window-bathroom':{type:'window',icon:'▭'},
      'camera-entry':{type:'camera',icon:'◉'}
    };

  const zonePositions={
    front:[[22,82],[34,84],[47,84],[61,84],[74,83],[84,79]],
    left:[[12,62],[13,48],[14,34],[16,22],[20,72]],
    right:[[91,62],[90,48],[89,34],[86,22],[82,72]],
    back:[[32,16],[45,13],[58,13],[71,16],[80,20]],
    interior:[[45,54],[55,54],[37,42],[63,42],[50,30],[70,30],[30,30],[50,66]]
  };

  const personPositions={
    exterior:{left:49,top:79,label:'Exterior'},sala:{left:42,top:66,label:'Sala'},
    cocina:{left:72,top:67,label:'Cocina'},rec1:{left:70,top:29,label:'Recámara 1'},
    rec2:{left:33,top:29,label:'Recámara 2'},bano:{left:53,top:20,label:'Baño'}
  };

  function getDevice(id){return CS.state.devices.find(d=>d.id===id);}
  function isAlarmState(d){return !!CS.state.alarm&&d?.state==='open';}
  function iconFor(type){return({door:'▯',window:'▭',motion:'◌',camera:'◉'})[type]||'•';}

  function updateFloorplanLabels(){
    ['room-sala','room-kitchen','room-bed1','room-bed2','room-bath'].forEach(id=>{
      const room=CS.state.rooms.find(r=>r.id===id);
      const label=document.querySelector(`[data-plan-room="${id}"] .plan-room-name`);
      if(label)label.textContent=room?.name||'Espacio disponible';
    });
  }

  function buildLayer(){
    el.layer.innerHTML='';
    updateFloorplanLabels();
    buildBaseLayer();
    buildCustomLayer();
    updateDevices();
  }

  function buildBaseLayer(){
    Object.entries(demoConfig).forEach(([id,cfg])=>{
      const d=getDevice(id);if(!d)return;
      const btn=document.createElement('button');btn.type='button';btn.className='house-device-object';btn.dataset.houseDevice=id;btn.setAttribute('aria-label',d.name);
      if(cfg.type==='door'){
        btn.classList.add('house-door-object');if(cfg.sideOpen)btn.classList.add('side-open');
        const leaf=document.createElement('span');leaf.className='door-leaf';btn.append(leaf);
      }else if(cfg.type==='window'){
        btn.classList.add('house-window-object');
        const a=document.createElement('span');a.className='window-pane window-pane--a';
        const b=document.createElement('span');b.className='window-pane window-pane--b';btn.append(a,b);
      }else btn.classList.add('house-camera-object');
      const pin=document.createElement('span');pin.className='device-pin';btn.append(pin);
      bindDeviceButton(btn,id,cfg.type);el.layer.append(btn);
    });
  }

  function buildCustomLayer(){
    const counts={front:0,left:0,right:0,back:0,interior:0};
    CS.state.devices.filter(d=>d.enabled!==false && !demoConfig[d.id]).forEach(d=>{
      const zone=d.visualZone||'interior',positions=zonePositions[zone]||zonePositions.interior;
      const slot=Number.isFinite(Number(d.visualSlot))?Number(d.visualSlot):counts[zone]++;
      const pos=positions[slot%positions.length];

      const btn=document.createElement('button');btn.type='button';
      btn.className=`custom-device-marker is-${d.type}`;btn.dataset.houseDevice=d.id;
      btn.style.left=pos[0]+'%';btn.style.top=pos[1]+'%';btn.textContent=iconFor(d.type);
      btn.title=`${d.name} · ${CS.getRoomName(d.roomId)}`;
      bindDeviceButton(btn,d.id,d.type);el.layer.append(btn);
    });
  }

  function bindDeviceButton(btn,id,type){
    btn.addEventListener('click',e=>{
      e.stopPropagation();selectDevice(id);
      if(type==='camera')return;
      if(['door','window'].includes(type))CS.toggleAccessDevice(id);
    });
  }

  function updateDevices(){
    CS.state.devices.forEach(d=>{
      const node=el.layer?.querySelector(`[data-house-device="${CSS.escape(d.id)}"]`);
      if(!node)return;
      node.classList.toggle('is-open',d.state==='open');
      node.classList.toggle('is-alarm',isAlarmState(d));
    });
    renderSensorGrid();
    if(state.selected)renderSelected(state.selected);
  }

  CS.updateHouseAccessVisual=updateDevices;
  CS.renderHouse3D=function(){buildLayer();};

  function selectDevice(id){state.selected=id;renderSelected(id);}
  function renderSelected(id){
    const d=getDevice(id);
    if(!d){
      el.selectedName.textContent=CS.state.home?.name||'Mi vivienda';
      el.selectedState.className='selected-state selected-state--safe';
      el.selectedState.textContent='Sistema listo';
      el.selectedDetail.textContent='Selecciona una puerta, ventana, cámara o sensor dentro de la vivienda.';
      el.selectedIcon.textContent='⌂';el.selectedAction.hidden=true;return;
    }

    el.selectedName.textContent=d.name;el.selectedIcon.textContent=iconFor(d.type);
    const alarm=isAlarmState(d);
    if(alarm){el.selectedState.className='selected-state selected-state--alarm';el.selectedState.textContent='Alarma';}
    else if(d.state==='open'){el.selectedState.className='selected-state selected-state--open';el.selectedState.textContent='Abierto';}
    else{el.selectedState.className='selected-state selected-state--safe';el.selectedState.textContent=CS.deviceStatusText(d);}

    el.selectedDetail.textContent=`${CS.getRoomName(d.roomId)} · ${d.visualZone?('Vista: '+({front:'frente',left:'lateral izquierdo',right:'lateral derecho',back:'parte trasera',interior:'interior'}[d.visualZone]||d.visualZone)+'. '):''}Estado: ${alarm?'alarma activa':CS.deviceStatusText(d)}.`;
    if(d.type==='camera'){el.selectedAction.textContent='Abrir cámaras';el.selectedAction.hidden=false;}
    else if(['door','window'].includes(d.type)){el.selectedAction.textContent=d.state==='open'?'Cerrar acceso':'Abrir acceso';el.selectedAction.hidden=false;}
    else el.selectedAction.hidden=true;
  }

  function renderSensorGrid(){
    const list=CS.getAccessDevices?CS.getAccessDevices():CS.state.devices.filter(d=>['door','window'].includes(d.type));
    el.sensorGrid.innerHTML='';
    list.forEach(d=>{
      const alarm=isAlarmState(d),card=document.createElement('button');card.type='button';
      card.className=`sensor-status-card ${alarm?'is-alarm':d.state==='open'?'is-open':'is-safe'}`;
      const icon=document.createElement('span');icon.className='sensor-status-icon';icon.textContent=d.type==='door'?'▯':'▭';
      const copy=document.createElement('span'),strong=document.createElement('strong'),status=document.createElement('span');
      strong.textContent=d.name;status.textContent=alarm?'ALARMA':d.state==='open'?'Abierto':'Cerrado';
      copy.append(strong,status);card.append(icon,copy);card.addEventListener('click',()=>selectDevice(d.id));el.sensorGrid.append(card);
    });
  }

  function applyTransform(){
    const angle=Math.max(-16,Math.min(16,state.yaw));
    el.transform.style.transform=`translate(calc(-50% + ${state.panX}px),calc(-50% + ${state.panY}px)) scale(${state.zoom}) perspective(1400px) rotateY(${angle}deg)`;
  }

  function setMode(mode){
    state.mode=mode;
    ['interior','exterior','walk'].forEach(m=>document.querySelector(`#sim-view-${m}`)?.classList.toggle('is-active',m===mode));
    el.exterior.hidden=mode!=='exterior';el.image.style.opacity=mode==='exterior'?'0':'1';
    el.layer.style.display=mode==='exterior'?'none':'block';
    el.person.style.display=mode==='walk'?'block':'none';
    el.walk.hidden=mode!=='walk';
  }

  async function selectedAction(){
    const d=getDevice(state.selected);if(!d)return;
    if(d.type==='camera')CS.navigate('cameras');
    else if(['door','window'].includes(d.type))await CS.toggleAccessDevice(d.id);
  }

  async function ensureOpen(id){
    const d=getDevice(id);if(d&&d.state!=='open'){await CS.toggleAccessDevice(id);await new Promise(r=>setTimeout(r,520));}
  }

  async function movePerson(key){
    if(state.moving||!personPositions[key])return;state.moving=true;
    if(key==='exterior'){
      if(state.personLocation!=='sala'&&state.personLocation!=='exterior')await moveDirect('sala');
      const main=CS.state.devices.find(d=>d.type==='door'&&/principal/i.test(d.name))||CS.state.devices.find(d=>d.type==='door');
      if(state.personLocation==='sala'&&main)await ensureOpen(main.id);
    }else if(state.personLocation==='exterior'){
      const main=CS.state.devices.find(d=>d.type==='door'&&/principal/i.test(d.name))||CS.state.devices.find(d=>d.type==='door');
      if(main)await ensureOpen(main.id);
      await moveDirect('sala');
      if(key==='sala'){state.moving=false;return;}
    }
    await moveDirect(key);state.moving=false;
  }

  async function moveDirect(key){
    const p=personPositions[key];if(!p)return;
    el.person.style.left=p.left+'%';el.person.style.top=p.top+'%';el.personLocation.textContent=p.label;
    await new Promise(r=>setTimeout(r,930));state.personLocation=key;
    CS.addEvent('Movimiento en vivienda',`La persona simulada se desplazó a ${p.label}.`,'sensor');
    if(key!=='exterior'&&CS.state.armed)CS.triggerAlarm(`Movimiento detectado en ${p.label}.`,'sensor');
  }

  function bindScene(){
    el.scene.addEventListener('pointerdown',e=>{
      if(e.target.closest('[data-house-device]'))return;state.drag=true;state.lastX=e.clientX;state.lastY=e.clientY;
      try{el.scene.setPointerCapture(e.pointerId);}catch{}
    });
    el.scene.addEventListener('pointermove',e=>{
      if(!state.drag)return;state.panX+=e.clientX-state.lastX;state.panY+=e.clientY-state.lastY;state.lastX=e.clientX;state.lastY=e.clientY;applyTransform();
    });
    const stop=()=>state.drag=false;el.scene.addEventListener('pointerup',stop);el.scene.addEventListener('pointercancel',stop);
    el.scene.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(.82,Math.min(1.32,state.zoom-e.deltaY*.0009));applyTransform();},{passive:false});
  }

  CS.initVisual3DFinal=function(){
    Object.assign(el,{
      scene:document.querySelector('#security-house-scene'),transform:document.querySelector('#security-house-transform'),
      image:document.querySelector('#security-house-image'),exterior:document.querySelector('#house-exterior-layer'),
      layer:document.querySelector('#security-device-layer'),person:document.querySelector('#house-person'),
      walk:document.querySelector('#walk-controls'),personLocation:document.querySelector('#sim-person-location'),
      sensorGrid:document.querySelector('#sensor-status-grid'),selectedName:document.querySelector('#house-selected-name'),
      selectedState:document.querySelector('#house-selected-state'),selectedDetail:document.querySelector('#house-selected-detail'),
      selectedIcon:document.querySelector('#selected-device-icon'),selectedAction:document.querySelector('#house-selected-action')
    });

    buildLayer();bindScene();applyTransform();setMode('interior');selectDevice(null);

    document.querySelector('#sim-view-interior')?.addEventListener('click',()=>setMode('interior'));
    document.querySelector('#sim-view-exterior')?.addEventListener('click',()=>setMode('exterior'));
    document.querySelector('#sim-view-walk')?.addEventListener('click',()=>setMode('walk'));
    document.querySelector('#sim-rotate-left')?.addEventListener('click',()=>{state.yaw=Math.max(-16,state.yaw-6);applyTransform();});
    document.querySelector('#sim-rotate-right')?.addEventListener('click',()=>{state.yaw=Math.min(16,state.yaw+6);applyTransform();});
    document.querySelector('#sim-zoom-in')?.addEventListener('click',()=>{state.zoom=Math.min(1.32,state.zoom+.08);applyTransform();});
    document.querySelector('#sim-zoom-out')?.addEventListener('click',()=>{state.zoom=Math.max(.82,state.zoom-.08);applyTransform();});
    document.querySelector('#sim-reset-view')?.addEventListener('click',()=>{state.yaw=0;state.zoom=1;state.panX=0;state.panY=0;applyTransform();});
    el.selectedAction?.addEventListener('click',selectedAction);

    // El recorrido se controla desde architectural-3d-dynamic.js.
    // Sus destinos se generan desde las habitaciones reales del CAD.
  };
})();
