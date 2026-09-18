/*
 * INICIALIZACIÓN CASA SEGURA — APLICACIÓN FINAL
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;

  async function initSettings(){
    document.querySelector('#change-pin-form').addEventListener('submit',async function(e){
      e.preventDefault();
      const current=document.querySelector('#current-pin').value.trim();
      const next=document.querySelector('#new-pin').value.trim();
      const confirm=document.querySelector('#confirm-pin').value.trim();
      const msg=document.querySelector('#pin-settings-message');msg.classList.remove('is-success');

      if(!CS.validPinValue(current)){msg.textContent='El PIN actual es incorrecto.';return;}
      if(!/^\d{4,8}$/.test(next)){msg.textContent='El nuevo PIN debe contener entre 4 y 8 números.';return;}
      if(next!==confirm){msg.textContent='La confirmación no coincide.';return;}

      await CS.saveSetting('pin',next);
      e.target.reset();msg.textContent='PIN actualizado correctamente.';msg.classList.add('is-success');
      CS.addEvent('PIN actualizado','El usuario cambió la credencial local.','system');
      CS.showToast('PIN actualizado','La nueva credencial ya está activa.');
    });

  }

  async function registerSW(){
    if('serviceWorker' in navigator && location.protocol!=='file:'){
      try{await navigator.serviceWorker.register('./service-worker.js');}
      catch(e){console.warn('Service Worker no registrado:',e);}
    }
  }

  async function init(){
    await CS.ProfileManager?.selectOnStart?.();
    CS.cacheElements();
    await CS.loadData();

    CS.initPoint1();
    CS.initPoint3();
    CS.initPoint4();
    CS.initPoint7();
    CS.initHomeV23();
    CS.initCamerasV23();
    CS.initUXV23();
    CS.initVisual3DFinal();
    CS.initCADEditor?.();
    CS.initArchitectural3D();
    CS.initRemoteFinal();
    CS.initDatabaseAdmin();
    CS.initConnectivityV23();
    await initSettings();
    CS.ProfileManager?.bindAppControls?.();

    if(!CS.state.events.length)CS.addEvent('Sistema iniciado','Casa Segura está preparada para comenzar.','info');

    CS.renderNotifications();
    CS.render();
    registerSW();
  }

  document.addEventListener('DOMContentLoaded',init);
})();
