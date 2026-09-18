/*
 * CASA SEGURA — SINCRONIZACIÓN POSTGRESQL
 * El frontend nunca se conecta directamente a PostgreSQL.
 * Habla con la API Node.js del servidor central.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  let timer=null;
  let syncing=false;

  CS.Remote={
    suppress:false,
    async headers(){
      const h={'Content-Type':'application/json'};
      if(CS.settings.apiKey)h['X-CasaSegura-Key']=CS.settings.apiKey;
      return h;
    },
    api(path=''){
      return String(CS.settings.apiBase||'').replace(/\/$/,'')+path;
    },
    async health(){
      if(!CS.settings.apiBase)throw new Error('API no configurada');
      const r=await fetch(this.api('/health'),{headers:await this.headers(),cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async enqueue(action,store,value=null,key=null){
      if(this.suppress)return;
      if(!['homes','rooms','devices','events','notifications','settings'].includes(store))return;
      const op={id:`sync-${Date.now()}-${Math.floor(Math.random()*100000)}`,action,store,value,key,createdAt:Date.now()};
      await CS.DB.put('syncQueue',op);
      CS.renderRemoteStatus?.();
    },
    async flush(){
      if(syncing||!CS.settings.apiBase||!navigator.onLine)return false;
      syncing=true;
      try{
        const ops=(await CS.DB.getAll('syncQueue')).sort((a,b)=>a.createdAt-b.createdAt);
        for(const op of ops){
          const r=await fetch(this.api('/sync'),{
            method:'POST',headers:await this.headers(),body:JSON.stringify(op)
          });
          if(!r.ok)throw new Error(`Sincronización HTTP ${r.status}`);
          await CS.DB.delete('syncQueue',op.id);
        }
        await CS.saveSetting('lastSync',new Date().toISOString());
        CS.renderRemoteStatus?.();
        return true;
      }finally{syncing=false;}
    },
    async uploadCurrentState(){
      if(!CS.settings.apiBase)throw new Error('API no configurada');
      const body={
        home:CS.state.home,rooms:CS.state.rooms,devices:CS.state.devices,
        events:CS.state.events.slice(0,300),notifications:CS.state.notifications.slice(0,60)
      };
      const r=await fetch(this.api('/bootstrap'),{
        method:'POST',headers:await this.headers(),body:JSON.stringify(body)
      });
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      await CS.saveSetting('lastSync',new Date().toISOString());
      return r.json();
    },
    async pull(){
      if(!CS.settings.apiBase||!CS.state.home?.id)return;
      const r=await fetch(this.api(`/state/${encodeURIComponent(CS.state.home.id)}`),{
        headers:await this.headers(),cache:'no-store'
      });
      if(!r.ok){
        if(r.status===404)return;
        throw new Error(`HTTP ${r.status}`);
      }
      const data=await r.json();
      this.suppress=true;
      try{
        if(data.home){CS.state.home=data.home;await CS.DB.put('homes',data.home);}
        if(Array.isArray(data.rooms)){
          for(const old of CS.state.rooms)await CS.DB.delete('rooms',old.id);
          CS.state.rooms=data.rooms;
          for(const x of data.rooms)await CS.DB.put('rooms',x);
        }
        if(Array.isArray(data.devices)){
          for(const old of CS.state.devices)await CS.DB.delete('devices',old.id);
          CS.state.devices=data.devices;
          for(const x of data.devices)await CS.DB.put('devices',x);
        }
        if(Array.isArray(data.events)){
          CS.state.events=data.events;
          for(const x of data.events)await CS.DB.put('events',x);
        }
        if(Array.isArray(data.notifications)){
          CS.state.notifications=data.notifications;
          for(const x of data.notifications)await CS.DB.put('notifications',x);
        }
      }finally{this.suppress=false;}
      CS.renderHomeEditor?.();CS.render();
    },
    async listTables(){
      if(!CS.settings.apiBase)throw new Error('Servidor no configurado');
      const r=await fetch(this.api('/admin/tables'),{headers:await this.headers(),cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async readTable(name,limit=200){
      if(!CS.settings.apiBase)throw new Error('Servidor no configurado');
      const r=await fetch(this.api(`/admin/table/${encodeURIComponent(name)}?limit=${limit}`),{headers:await this.headers(),cache:'no-store'});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    async syncCycle(){
      if(!CS.settings.onlineMode||!CS.settings.apiBase||!navigator.onLine)return;
      try{
        await this.flush();
        await this.pull();
        CS.renderRemoteStatus?.('ok');
      }catch(e){
        console.warn('Sync:',e);
        CS.renderRemoteStatus?.('error');
      }
    }
  };

  function wrapDB(){
    const rawPut=CS.DB.put.bind(CS.DB);
    const rawDelete=CS.DB.delete.bind(CS.DB);
    const rawClear=CS.DB.clear.bind(CS.DB);

    CS.DB.put=async function(store,value){
      const result=await rawPut(store,value);
      if(store!=='syncQueue')await CS.Remote.enqueue('put',store,value,null);
      return result;
    };
    CS.DB.delete=async function(store,key){
      const result=await rawDelete(store,key);
      if(store!=='syncQueue')await CS.Remote.enqueue('delete',store,null,key);
      return result;
    };
    CS.DB.clear=async function(store){
      const result=await rawClear(store);
      if(store!=='syncQueue')await CS.Remote.enqueue('clear',store,null,null);
      return result;
    };
  }

  CS.renderRemoteStatus=async function(forced){
    const server=document.querySelector('#api-server-status');
    const last=document.querySelector('#last-sync-label');
    const pending=document.querySelector('#pending-sync-label');
    if(!server)return;
    const count=(await CS.DB.getAll('syncQueue')).length;
    pending.textContent=String(count);
    last.textContent=CS.settings.lastSync?new Date(CS.settings.lastSync).toLocaleString('es-MX'):'Nunca';
    server.classList.remove('remote-health-ok','remote-health-error');
    if(forced==='ok'){server.textContent='Conectado';server.classList.add('remote-health-ok');}
    else if(forced==='error'){server.textContent='Sin respuesta';server.classList.add('remote-health-error');}
    else server.textContent=CS.settings.apiBase?'Configurado':'No configurado';
  };

  CS.initRemoteFinal=function(){
    wrapDB();
    const url=document.querySelector('#api-base-url');
    const key=document.querySelector('#api-shared-key');
    url.value=CS.settings.apiBase||'';
    key.value=CS.settings.apiKey||'';

    document.querySelector('#save-api-config').addEventListener('click',async()=>{
      const value=url.value.trim().replace(/\/$/,'');
      await CS.saveSetting('apiBase',value);
      await CS.saveSetting('apiKey',key.value.trim());
      CS.showToast('Servidor guardado',value||'Configuración eliminada');
      CS.renderRemoteStatus();
    });

    document.querySelector('#test-api-connection').addEventListener('click',async()=>{
      try{
        const data=await CS.Remote.health();
        CS.renderRemoteStatus('ok');
        CS.showToast('Servidor conectado',data.database?'PostgreSQL disponible.':'API disponible.');
      }catch(e){
        CS.renderRemoteStatus('error');
        CS.showToast('No se pudo conectar',String(e.message||e));
      }
    });

    document.querySelector('#sync-now-button').addEventListener('click',async()=>{
      try{
        if(!CS.settings.apiBase)throw new Error('Configura primero la dirección de la API.');
        await CS.Remote.uploadCurrentState();
        await CS.Remote.flush();
        await CS.Remote.pull();
        CS.renderRemoteStatus('ok');
        CS.addEvent('Sincronización completada','La información local se sincronizó con PostgreSQL.','system');
        CS.showToast('Sincronización completada','PostgreSQL y la base local están actualizados.');
      }catch(e){
        CS.renderRemoteStatus('error');
        CS.showToast('Error de sincronización',String(e.message||e));
      }
    });

    CS.renderRemoteStatus();
    clearInterval(timer);
    timer=setInterval(()=>CS.Remote.syncCycle(),5000);
  };
})();
