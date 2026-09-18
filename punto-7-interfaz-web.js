/*
 * PUNTO 7 — INTERFAZ E HISTORIAL
 * Toda acción importante comunica al usuario qué ocurrió.
 */
(function(){
  'use strict';
  const CS = window.CasaSegura;

  CS.getTime = ()=>new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  CS.getDateTime = ()=>new Date().toLocaleString('es-MX');

  CS.addEvent = function(title,detail,kind='info'){
    const event={id:`evt-${Date.now()}-${Math.floor(Math.random()*10000)}`,title,detail,kind,time:CS.getTime(),timestamp:Date.now()};
    CS.state.events.unshift(event);
    CS.state.events=CS.state.events.slice(0,300);
    CS.state.lastEvent=title;
    CS.DB?.put('events',event).catch(()=>{});
    CS.renderEvents?.();
  };

  CS.notify = function(title,detail,kind='info'){
    const n={id:`not-${Date.now()}-${Math.floor(Math.random()*10000)}`,title,detail,kind,time:CS.getTime(),timestamp:Date.now()};
    CS.state.notifications.unshift(n);

    const removed=CS.state.notifications.splice(60);
    CS.DB?.put('notifications',n).catch(()=>{});
    removed.forEach(old=>CS.DB?.delete('notifications',old.id).catch(()=>{}));

    CS.renderNotifications?.();
  };

  CS.renderEvents = function(){
    const build=(el,limit)=>{
      if(!el) return;
      el.innerHTML='';
      const events=CS.state.events.slice(0,limit);
      if(!events.length){
        el.innerHTML='<li><span class="event-icon">IN</span><span><strong>Sin eventos</strong><small>No hay actividad registrada.</small></span><time>--</time></li>';
        return;
      }
      events.forEach(e=>{
        const li=document.createElement('li');
        const icon=document.createElement('span');
        icon.className=`event-icon event-icon--${e.kind}`;
        icon.textContent=({info:'IN',system:'SC',sensor:'SN',alarm:'AL',agency:'AV'})[e.kind]||'IN';
        const copy=document.createElement('span');
        const strong=document.createElement('strong'); strong.textContent=e.title;
        const small=document.createElement('small'); small.textContent=e.detail;
        const time=document.createElement('time'); time.textContent=e.time;
        copy.append(strong,small); li.append(icon,copy,time); el.append(li);
      });
    };
    build(CS.el.eventList,300);
    build(CS.el.recentEventList,6);
  };

  CS.openEmergencyScreen = function(){
    if(!CS.state.alarm) return;
    CS.el.emergencyReason.textContent=CS.state.emergencyReason || 'Se activó una emergencia.';
    CS.el.emergencyScreen.hidden=false;
    CS.el.emergencyPin.value='';
    CS.el.emergencyPinMessage.textContent='';
    setTimeout(()=>CS.el.emergencyPin.focus(),80);
  };

  CS.render = function(){
    if(!CS.state.home) return;
    const access=CS.getAccessDevices();
    const open=CS.getOpenAccesses();
    const cameras=CS.state.devices.filter(d=>d.type==='camera');

    CS.el.systemBanner.classList.toggle('is-active',CS.state.armed && !CS.state.alarm);
    CS.el.systemBanner.classList.toggle('is-alarm',CS.state.alarm);

    if(CS.state.alarm){
      CS.el.generalStatusText.textContent='EMERGENCIA ACTIVA';
      CS.el.protectionText.textContent='La alarma permanecerá activa hasta validar el PIN.';
    }else if(CS.state.armed){
      CS.el.generalStatusText.textContent='PROTECCIÓN ACTIVA';
      CS.el.protectionText.textContent='Todos los accesos configurados están bajo monitoreo.';
    }else{
      CS.el.generalStatusText.textContent='DESACTIVADO';
      CS.el.protectionText.textContent='La vivienda no está armada.';
    }

    CS.el.secureCount.textContent=`${access.length-open.length} de ${access.length}`;
    CS.el.deviceCount.textContent=String(CS.state.devices.length);
    CS.el.cameraCount.textContent=String(cameras.length);
    CS.el.lastEventText.textContent=CS.state.lastEvent;
    CS.el.lastEventTime.textContent=CS.state.events[0]?.time || 'Ahora';
    CS.el.systemButton.textContent=CS.state.armed?'Desactivar protección':'Activar protección';

    const ready=CS.allSensorsClosed();
    const homeState=CS.el.homeReadyState;
    homeState.querySelector('i').className=`dot ${ready?'dot--ok':'dot--warn'}`;
    homeState.querySelector('span').textContent=ready?'Perímetro seguro':`${open.length} acceso(s) abierto(s)`;

    const top=CS.el.topSystemStatus;
    top.querySelector('i').className=`dot ${CS.state.alarm?'dot--danger':CS.state.armed?'dot--ok':''}`;
    top.querySelector('span').textContent=CS.state.alarm?'Emergencia activa':CS.state.armed?'Protección activa':'Sistema desactivado';

    CS.el.alarmStateLabel.querySelector('i').className=`dot ${CS.state.alarm?'dot--danger':''}`;
    CS.el.alarmStateLabel.querySelector('span').textContent=CS.state.alarm?'Sonando':'En silencio';
    CS.el.alarmDescription.textContent=CS.state.alarm?'La emergencia requiere validación del PIN para silenciar.':'La alarma se activa por un acceso armado o por el botón de pánico.';

    CS.el.agencyProgress.value=CS.state.agencyProgress;
    CS.el.agencyProgressText.textContent=`${CS.state.agencyProgress}%`;
    CS.el.emergencyAgencyProgress.value=CS.state.agencyProgress;

    if(CS.state.agency==='contacting'){
      CS.el.agencyState.textContent='Enviando';
      CS.el.agencyTitle.textContent='Enviando alerta…';
      CS.el.agencyDescription.textContent='Procesando la señal de emergencia de demostración.';
      CS.el.emergencyAgencyText.textContent=`Enviando alerta · ${CS.state.agencyProgress}%`;
    }else if(CS.state.agency==='notified'){
      CS.el.agencyState.textContent='Aviso enviado';
      CS.el.agencyTitle.textContent='Alerta recibida';
      CS.el.agencyDescription.textContent='La central simulada confirmó la señal.';
      CS.el.emergencyAgencyText.textContent='Aviso enviado';
    }else{
      CS.el.agencyState.textContent='En espera';
      CS.el.agencyTitle.textContent='Canal disponible';
      CS.el.agencyDescription.textContent='El aviso de vigilancia es una simulación académica.';
      CS.el.emergencyAgencyText.textContent='En espera';
    }

    CS.renderHouse3D?.();
    CS.renderDeviceTable?.();
    CS.renderCameraGrid?.();
    CS.renderConnectivity?.();
    CS.renderEvents();
    CS.renderNotifications?.();
  };

  CS.initPoint7 = function(){
    CS.el.clearHistory.addEventListener('click',async function(){
      const ok=await CS.confirmAction('Limpiar historial','Se eliminarán todos los eventos almacenados localmente. Esta acción no puede deshacerse.','Limpiar');
      if(!ok) return;
      await CS.DB.clear('events');
      CS.state.events=[];
      CS.addEvent('Historial reiniciado','Se inició un nuevo registro de eventos.','system');
      CS.showToast('Historial reiniciado','Los eventos anteriores fueron eliminados.');
      CS.render();
    });

    const tick=()=>CS.el.currentTime.textContent=CS.getTime();
    tick(); CS.clockInterval=setInterval(tick,1000);
  };
})();
