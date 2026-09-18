(function(){
  'use strict';
  const CS=window.CasaSegura;
  let persistTimer=null;
  let renderQueued=false;

  const typeLabel={
    door:'Puerta',
    window:'Ventana',
    camera:'Cámara'
  };

  function roomName(id,model){
    return model.rooms.find(r=>r.id===id)?.name||'Espacio';
  }

  function defaultDeviceName(o,model){
    const base=typeLabel[o.type]||'Dispositivo';
    return `${base} · ${roomName(o.roomId,model)}`;
  }

  async function persistSnapshot(removedRoomIds,removedDeviceIds){
    try{
      for(const id of removedDeviceIds)await CS.DB.delete('devices',id);
      for(const id of removedRoomIds)await CS.DB.delete('rooms',id);
      for(const r of CS.state.rooms)await CS.DB.put('rooms',r);
      for(const d of CS.state.devices)await CS.DB.put('devices',d);
    }catch(e){
      console.warn('Sincronización CAD → DB:',e);
    }
  }

  CS.renderDynamicWalkDestinations=function(){
    const host=document.querySelector('#walk-dynamic-destinations');
    if(!host)return;

    const model=CS.CAD?.model||CS.CADStore?.load?.();
    if(!model){host.innerHTML='';return;}

    host.innerHTML='';
    const analysis=CS.CADStructure?.analyze(model);
    const structureByRoom=new Map();

    (analysis?.components||[]).forEach((component,index)=>{
      component.roomIds.forEach(id=>structureByRoom.set(id,index+1));
    });

    for(const room of model.rooms){
      const btn=document.createElement('button');
      btn.type='button';
      btn.dataset.walkRoomId=room.id;
      btn.className='walk-destination-button';
      const structure=structureByRoom.get(room.id)||1;
      btn.innerHTML=`<strong>${CS.escapeHtml?.(room.name)||room.name}</strong><small>Estructura ${structure}</small>`;
      host.append(btn);
    }

    if(!model.rooms.length){
      const empty=document.createElement('span');
      empty.className='walk-destination-empty';
      empty.textContent='No hay habitaciones en el plano.';
      host.append(empty);
    }
  };

  CS.syncCADRuntime=function(options={}){
    const model=CS.CAD?.model||CS.CADStore?.load?.();
    if(!model||!CS.state)return;

    const persist=options.persist!==false;
    const previousRooms=[...(CS.state.rooms||[])];
    const previousDevices=[...(CS.state.devices||[])];

    const roomIds=new Set(model.rooms.map(r=>r.id));
    const openingIds=new Set(model.openings.map(o=>o.id));

    // CAD rooms are authoritative for room identity/name/type.
    const nextRooms=model.rooms.map(cr=>{
      const existing=previousRooms.find(r=>r.id===cr.id);
      return{
        ...(existing||{}),
        id:cr.id,
        homeId:CS.state.home?.id||'home-main',
        name:cr.name||existing?.name||'Habitación',
        type:cr.type||existing?.type||'Otro',
        cadManaged:true
      };
    });

    // Preserve non-architectural devices such as motion sensors.
    const nonStructural=previousDevices.filter(d=>!['door','window','camera'].includes(d.type));

    const structural=model.openings.filter(o=>['door','window','camera'].includes(o.type)).map(o=>{
      const existing=previousDevices.find(d=>d.id===o.id);
      const state=existing?.state ?? (o.type==='camera'?'offline':'closed');
      return{
        ...(existing||{}),
        id:o.id,
        homeId:CS.state.home?.id||'home-main',
        roomId:o.roomId,
        type:o.type,
        name:existing?.name||defaultDeviceName(o,model),
        state,
        enabled:existing?.enabled!==false,
        visualZone:existing?.visualZone||'interior',
        visualSlot:Number.isFinite(Number(existing?.visualSlot))?Number(existing.visualSlot):0,
        cadManaged:true
      };
    });

    // Keep non-structural devices only when their room still exists.
    CS.state.rooms=nextRooms;
    CS.state.devices=[
      ...structural,
      ...nonStructural.filter(d=>roomIds.has(d.roomId))
    ];

    const removedRoomIds=previousRooms.filter(r=>!roomIds.has(r.id)).map(r=>r.id);
    const currentDeviceIds=new Set(CS.state.devices.map(d=>d.id));
    const removedDeviceIds=previousDevices.filter(d=>!currentDeviceIds.has(d.id)).map(d=>d.id);

    CS.renderDynamicWalkDestinations();

    if(!renderQueued){
      renderQueued=true;
      requestAnimationFrame(()=>{
        renderQueued=false;
        CS.renderHomeEditor?.();
        CS.renderDeviceTable?.();
        CS.renderHouse3D?.();
        CS.render?.();
      });
    }

    if(persist){
      clearTimeout(persistTimer);
      persistTimer=setTimeout(
        ()=>persistSnapshot(removedRoomIds,removedDeviceIds),
        180
      );
    }
  };
})();
