/*
 * PUNTO 2 — SENSORES DE PUERTAS Y VENTANAS
 * Ahora trabaja con una colección dinámica de dispositivos.
 */
(function(){
  'use strict';
  const CS = window.CasaSegura;

  CS.getAccessDevices = function(){
    return (CS.state.devices || []).filter(d=>['door','window'].includes(d.type) && d.enabled!==false);
  };

  CS.getOpenAccesses = function(){
    return CS.getAccessDevices().filter(d=>d.state==='open');
  };

  CS.allSensorsClosed = function(){
    return CS.getOpenAccesses().length===0;
  };

  CS.toggleAccessDevice = async function(deviceId){
    const device = CS.state.devices.find(d=>d.id===deviceId);
    if(!device || !['door','window'].includes(device.type)) return;

    device.state = device.state==='open'?'closed':'open';
    await CS.DB.put('devices',device);

    const opened = device.state==='open';
    CS.updateHouseAccessVisual?.(device.id,device.state);
    CS.addEvent(
      `${device.name} ${opened?'abierta':'cerrada'}`,
      `${CS.getRoomName(device.roomId)} · cambio detectado en el modelo de vivienda.`,
      'sensor'
    );
    CS.notify(
      opened?'Acceso abierto':'Acceso cerrado',
      `${device.name} · ${CS.getRoomName(device.roomId)}`,
      opened?'warning':'info'
    );
    CS.showToast(opened?'Acceso abierto':'Acceso cerrado',device.name);

    if(opened && CS.state.armed){
      CS.triggerAlarm(`Apertura detectada: ${device.name}.`,'sensor');
    }
    CS.renderHomeEditor();
    // Permite ver la apertura/cierre físico antes de reconstruir la vista.
    if(!CS.state.alarm){
      setTimeout(()=>CS.render(),390);
    }else{
      CS.render();
    }
  };
})();
