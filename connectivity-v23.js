/*
 * CASA SEGURA — CONTROL OFFLINE / ONLINE
 * OFFLINE: trabaja con el almacenamiento del equipo.
 * ONLINE: requiere Internet y un servidor Casa Segura configurado.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;

  CS.isInternetAvailable=()=>navigator.onLine;

  CS.renderConnectivity=function(){
    const internet=document.querySelector('#internet-status-label');
    const label=document.querySelector('#online-mode-label');
    const provider=document.querySelector('#remote-provider-label');
    const settingsButton=document.querySelector('#toggle-online-mode');
    const top=document.querySelector('#network-mode-status');
    const mainButton=document.querySelector('#main-online-toggle');
    const sideTitle=document.querySelector('#sidebar-mode-title');
    const sideCopy=document.querySelector('#sidebar-mode-copy');

    const requested=!!CS.settings.onlineMode;
    const active=requested&&navigator.onLine&&!!CS.settings.apiBase;

    if(internet)internet.textContent=navigator.onLine?'Disponible':'Sin conexión';
    if(label)label.textContent=active?'Online':'Offline';
    if(provider)provider.textContent=CS.settings.apiBase?'Servidor configurado':'No configurado';
    if(settingsButton)settingsButton.textContent=active?'Cambiar a offline':'Activar modo online';

    if(top){
      top.querySelector('i').className=`dot ${active?'dot--ok':''}`;
      top.querySelector('span').textContent=active?'ONLINE':'OFFLINE';
    }
    if(mainButton){
      mainButton.classList.toggle('is-online',active);
      mainButton.querySelector('span').textContent=active?'Volver offline':'Activar online';
    }
    if(sideTitle)sideTitle.textContent=active?'ONLINE':'OFFLINE';
    if(sideCopy)sideCopy.textContent=active?'Sincronización activa':'Operación independiente';
  };

  CS.setOnlineMode=async function(enable){
    if(!enable){
      await CS.saveSetting('onlineMode',false);
      CS.renderConnectivity();
      CS.addEvent('Modo offline activado','Casa Segura dejó de sincronizar con el servidor compartido.','system');
      CS.showToast('Modo offline','Casa Segura continúa funcionando en este dispositivo.');
      return true;
    }

    if(!navigator.onLine){
      CS.showToast('No hay Internet','Casa Segura permanece en modo offline.');
      return false;
    }

    if(!CS.settings.apiBase){
      CS.navigate?.('settings');
      CS.showToast('Falta configurar el servidor','En Configuración agrega la dirección del servidor Casa Segura.');
      document.querySelector('#api-base-url')?.focus();
      return false;
    }

    try{
      await CS.Remote.health();
      await CS.saveSetting('onlineMode',true);
      CS.renderConnectivity();
      await CS.Remote.uploadCurrentState();
      await CS.Remote.flush();
      await CS.Remote.pull();
      CS.renderRemoteStatus?.('ok');
      CS.addEvent('Modo online activado','Casa Segura se conectó al servidor compartido.','system');
      CS.showToast('Casa Segura online','Sincronización con otros equipos activada.');
      return true;
    }catch(e){
      await CS.saveSetting('onlineMode',false);
      CS.renderConnectivity();
      CS.renderRemoteStatus?.('error');
      CS.showToast('Servidor no disponible',String(e.message||e));
      return false;
    }
  };

  CS.initConnectivityV23=function(){
    const handler=()=>CS.setOnlineMode(!CS.settings.onlineMode);
    document.querySelector('#toggle-online-mode')?.addEventListener('click',handler);
    document.querySelector('#main-online-toggle')?.addEventListener('click',handler);

    window.addEventListener('online',()=>{
      CS.renderConnectivity();
      CS.notify('Conexión disponible','Casa Segura detectó acceso a Internet.');
    });
    window.addEventListener('offline',async()=>{
      if(CS.settings.onlineMode)await CS.saveSetting('onlineMode',false);
      CS.renderConnectivity();
      CS.notify('Modo offline','La conexión se perdió. Casa Segura continúa funcionando.','warning');
    });

    CS.renderConnectivity();
  };
})();
