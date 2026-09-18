/*
 * PUNTO 1 — CONTROL MEDIANTE PIN
 * Mantiene la responsabilidad académica de acceso y armado.
 */
(function(){
  'use strict';
  const CS = window.CasaSegura = window.CasaSegura || {};

  CS.state = Object.assign({
    authorized:false, armed:false, alarm:false, agency:'waiting', agencyProgress:0,
    lastEvent:'Sistema iniciado', emergencyReason:'', emergencySource:'', home:null,
    rooms:[], devices:[], notifications:[], events:[]
  }, CS.state || {});

  CS.PROJECT_PIN = '1234';
  CS.audioContext = null;
  CS.alarmInterval = null;
  CS.agencyInterval = null;
  CS.clockInterval = null;
  CS.webcamStreams = new Map();

  CS.cacheElements = function(){
    CS.el = {
      accessScreen:document.querySelector('#access-screen'), appShell:document.querySelector('#app-shell'),
      accessForm:document.querySelector('#access-form'), accessPin:document.querySelector('#access-pin'),
      accessMessage:document.querySelector('#access-message'), pin:document.querySelector('#pin-input'),
      pinMessage:document.querySelector('#pin-message'), systemButton:document.querySelector('#system-button'),
      logoutButton:document.querySelector('#logout-button'), silenceButton:document.querySelector('#silence-button'),
      panicButton:document.querySelector('#panic-button'), systemBanner:document.querySelector('#system-banner'),
      generalStatusText:document.querySelector('#general-status-text'), protectionText:document.querySelector('#protection-text'),
      secureCount:document.querySelector('#secure-count'), deviceCount:document.querySelector('#device-count'),
      cameraCount:document.querySelector('#camera-count'), lastEventText:document.querySelector('#last-event-text'),
      lastEventTime:document.querySelector('#last-event-time'), homeReadyState:document.querySelector('#home-ready-state'),
      topSystemStatus:document.querySelector('#top-system-status'), alarmStateLabel:document.querySelector('#alarm-state-label'),
      alarmDescription:document.querySelector('#alarm-description'), agencyState:document.querySelector('#agency-state'),
      agencyTitle:document.querySelector('#agency-title'), agencyDescription:document.querySelector('#agency-description'),
      agencyProgress:document.querySelector('#agency-progress'), agencyProgressText:document.querySelector('#agency-progress-text'),
      recentEventList:document.querySelector('#recent-event-list'), eventList:document.querySelector('#event-list'),
      currentTime:document.querySelector('#current-time'), clearHistory:document.querySelector('#clear-history'),
      emergencyScreen:document.querySelector('#emergency-screen'), emergencyReason:document.querySelector('#emergency-reason'),
      emergencyAgencyText:document.querySelector('#emergency-agency-text'),
      emergencyAgencyProgress:document.querySelector('#emergency-agency-progress'),
      emergencyPinForm:document.querySelector('#emergency-pin-form'), emergencyPin:document.querySelector('#emergency-pin'),
      emergencyPinMessage:document.querySelector('#emergency-pin-message')
    };
  };

  CS.setMessage = function(el, text, ok=false){
    if(!el) return;
    el.textContent = text || '';
    el.classList.toggle('is-success', !!ok);
  };

  CS.validPinValue = function(value){
    return String(value || '').trim() === String(CS.PROJECT_PIN);
  };

  CS.validatePinInput = function(input, messageEl){
    const value = input.value.trim();
    if(!/^\d{4,8}$/.test(value)){
      CS.setMessage(messageEl,'El PIN debe contener entre 4 y 8 números.');
      return false;
    }
    if(!CS.validPinValue(value)){
      CS.setMessage(messageEl,'PIN incorrecto. Verifica la credencial.');
      return false;
    }
    CS.setMessage(messageEl,'PIN validado correctamente.',true);
    return true;
  };

  CS.showApp = function(show){
    CS.state.authorized = show;
    CS.el.accessScreen.hidden = show;
    CS.el.appShell.hidden = !show;
    if(show){
      CS.addEvent('Acceso autorizado','El usuario abrió el centro de monitoreo.','system');
      CS.notify('Sesión iniciada','Casa Segura está lista para operar.');
      CS.render();
      if(CS.ProfileManager){
        setTimeout(()=>CS.navigate?.(CS.ProfileManager.startView||'dashboard'),100);
      }else if(!CS.settings.onboarded){
        setTimeout(()=>CS.startOnboarding(),120);
      }
    }else{
      CS.el.accessPin.value='';
      CS.setMessage(CS.el.accessMessage,'');
    }
  };

  CS.initPoint1 = function(){
    const sanitize = input => input.value = input.value.replace(/\D/g,'').slice(0,8);
    [CS.el.accessPin,CS.el.pin].forEach(input=>input.addEventListener('input',()=>sanitize(input)));

    CS.el.accessForm.addEventListener('submit',function(e){
      e.preventDefault();
      if(!CS.validatePinInput(CS.el.accessPin,CS.el.accessMessage)) return;
      CS.showApp(true);
    });

    CS.el.systemButton.addEventListener('click',async function(){
      if(!CS.validatePinInput(CS.el.pin,CS.el.pinMessage)) return;

      if(!CS.state.armed){
        const open = CS.getOpenAccesses();
        if(open.length){
          CS.setMessage(CS.el.pinMessage,`No se puede activar: ${open.length} acceso(s) abierto(s).`);
          CS.notify('No se pudo activar',`Revisa: ${open.map(d=>d.name).join(', ')}.`,'warning');
          CS.showToast('Protección no activada','Existen accesos abiertos.');
          return;
        }
      }

      CS.state.armed = !CS.state.armed;
      if(!CS.state.armed && CS.state.alarm) CS.silenceAlarm(false);

      CS.addEvent(
        CS.state.armed?'Protección activada':'Protección desactivada',
        CS.state.armed?'Todos los accesos configurados quedaron bajo monitoreo.':'La vivienda quedó en espera.',
        'system'
      );
      CS.notify(CS.state.armed?'Protección activada':'Protección desactivada',
        CS.state.armed?'La vivienda está bajo monitoreo.':'El sistema quedó en espera.');
      CS.showToast(CS.state.armed?'Protección activada':'Protección desactivada',
        CS.state.armed?'Todos los accesos están listos.':'El sistema ya no está armado.');
      CS.el.pin.value='';
      CS.render();
    });

    CS.el.logoutButton.addEventListener('click',async function(){
      if(CS.state.alarm){
        CS.openEmergencyScreen();
        CS.showToast('Acción bloqueada','Primero debes silenciar la emergencia con tu PIN.');
        return;
      }
      CS.state.armed=false;
      CS.stopAllWebcams?.();
      CS.addEvent('Sesión cerrada','El usuario bloqueó el panel.','system');
      CS.render();
      CS.showApp(false);
    });
  };
})();
