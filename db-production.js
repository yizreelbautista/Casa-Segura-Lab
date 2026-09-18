/*
 * BASE DE DATOS — APLICACIÓN FINAL
 * IndexedDB principal + fallback localStorage.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  const DB_NAME=()=>CS.ProfileManager?.dbName?.()||'CasaSeguraDB';
  const DB_VERSION=3;
  const STORES=['settings','homes','rooms','devices','events','notifications','syncQueue'];
  const fallbackPrefix=()=>CS.ProfileManager?.fallbackPrefix?.()||'cs21_';

  const fallback={
    getAll(store){
      try{return JSON.parse(localStorage.getItem(fallbackPrefix()+store)||'[]');}catch{return[];}
    },
    setAll(store,items){localStorage.setItem(fallbackPrefix()+store,JSON.stringify(items));},
    async get(store,key){return this.getAll(store).find(x=>(x.id??x.key)===key)||null;},
    async put(store,value){
      const arr=this.getAll(store); const key=value.id??value.key;
      const i=arr.findIndex(x=>(x.id??x.key)===key);
      if(i>=0) arr[i]=value; else arr.push(value);
      this.setAll(store,arr); return value;
    },
    async delete(store,key){this.setAll(store,this.getAll(store).filter(x=>(x.id??x.key)!==key));},
    async clear(store){localStorage.removeItem(fallbackPrefix()+store);}
  };

  CS.DB={
    db:null,engine:'IndexedDB',
    async open(){
      if(!('indexedDB' in window)){this.engine='localStorage (compatibilidad)';return;}
      try{
        this.db=await new Promise((resolve,reject)=>{
          const req=indexedDB.open(DB_NAME(),DB_VERSION);
          req.onupgradeneeded=()=>{
            const db=req.result;
            STORES.forEach(store=>{
              if(!db.objectStoreNames.contains(store)){
                db.createObjectStore(store,{keyPath:store==='settings'?'key':'id'});
              }
            });
          };
          req.onsuccess=()=>resolve(req.result);
          req.onerror=()=>reject(req.error);
        });
      }catch(e){
        console.warn('IndexedDB no disponible, usando fallback:',e);
        this.db=null; this.engine='localStorage (compatibilidad)';
      }
    },
    async getAll(store){
      if(!this.db) return fallback.getAll(store);
      return new Promise((resolve,reject)=>{
        const req=this.db.transaction(store,'readonly').objectStore(store).getAll();
        req.onsuccess=()=>resolve(req.result||[]); req.onerror=()=>reject(req.error);
      });
    },
    async get(store,key){
      if(!this.db) return fallback.get(store,key);
      return new Promise((resolve,reject)=>{
        const req=this.db.transaction(store,'readonly').objectStore(store).get(key);
        req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>reject(req.error);
      });
    },
    async put(store,value){
      if(!this.db) return fallback.put(store,value);
      return new Promise((resolve,reject)=>{
        const req=this.db.transaction(store,'readwrite').objectStore(store).put(value);
        req.onsuccess=()=>resolve(value); req.onerror=()=>reject(req.error);
      });
    },
    async delete(store,key){
      if(!this.db) return fallback.delete(store,key);
      return new Promise((resolve,reject)=>{
        const req=this.db.transaction(store,'readwrite').objectStore(store).delete(key);
        req.onsuccess=()=>resolve(); req.onerror=()=>reject(req.error);
      });
    },
    async clear(store){
      if(!this.db) return fallback.clear(store);
      return new Promise((resolve,reject)=>{
        const req=this.db.transaction(store,'readwrite').objectStore(store).clear();
        req.onsuccess=()=>resolve(); req.onerror=()=>reject(req.error);
      });
    }
  };


  CS.initialModel=function(){
    if(CS.ProfileManager?.activeProfile==='main'){
      return{
        home:{id:'home-main',name:'Casa principal',active:true,createdAt:Date.now()},
        rooms:[],
        devices:[]
      };
    }
    return{
      home:{id:'home-main',name:'Casa Demo',active:true,createdAt:Date.now()},
      rooms:[
        {id:'room-sala',homeId:'home-main',name:'Sala / Entrada',type:'Sala'},
        {id:'room-kitchen',homeId:'home-main',name:'Cocina',type:'Cocina'},
        {id:'room-bed1',homeId:'home-main',name:'Recámara 1',type:'Recámara'},
        {id:'room-bed2',homeId:'home-main',name:'Recámara 2',type:'Recámara'},
        {id:'room-bath',homeId:'home-main',name:'Baño',type:'Baño'}
      ],
      devices:[
        {id:'door-main',homeId:'home-main',roomId:'room-sala',type:'door',name:'Puerta principal',state:'closed',enabled:true,visualZone:'front',visualSlot:0},
        {id:'door-kitchen',homeId:'home-main',roomId:'room-kitchen',type:'door',name:'Puerta de cocina',state:'closed',enabled:true,visualZone:'interior',visualSlot:0},
        {id:'door-bedroom1',homeId:'home-main',roomId:'room-bed1',type:'door',name:'Puerta recámara 1',state:'closed',enabled:true,visualZone:'interior',visualSlot:1},
        {id:'door-bedroom2',homeId:'home-main',roomId:'room-bed2',type:'door',name:'Puerta recámara 2',state:'closed',enabled:true,visualZone:'interior',visualSlot:2},
        {id:'door-bathroom',homeId:'home-main',roomId:'room-bath',type:'door',name:'Puerta del baño',state:'closed',enabled:true,visualZone:'interior',visualSlot:3},

        {id:'window-living',homeId:'home-main',roomId:'room-sala',type:'window',name:'Ventana sala 1',state:'closed',enabled:true,visualZone:'front',visualSlot:1},
        {id:'window-living-side',homeId:'home-main',roomId:'room-sala',type:'window',name:'Ventana sala 2',state:'closed',enabled:true,visualZone:'front',visualSlot:2},

        {id:'window-kitchen-front',homeId:'home-main',roomId:'room-kitchen',type:'window',name:'Ventana cocina 1',state:'closed',enabled:true,visualZone:'front',visualSlot:3},
        {id:'window-kitchen-side',homeId:'home-main',roomId:'room-kitchen',type:'window',name:'Ventana cocina 2',state:'closed',enabled:true,visualZone:'front',visualSlot:4},

        {id:'window-bedroom',homeId:'home-main',roomId:'room-bed1',type:'window',name:'Ventana recámara 1 - A',state:'closed',enabled:true,visualZone:'back',visualSlot:0},
        {id:'window-bedroom1-extra',homeId:'home-main',roomId:'room-bed1',type:'window',name:'Ventana recámara 1 - B',state:'closed',enabled:true,visualZone:'back',visualSlot:1},

        {id:'window-bedroom2',homeId:'home-main',roomId:'room-bed2',type:'window',name:'Ventana recámara 2 - A',state:'closed',enabled:true,visualZone:'back',visualSlot:2},
        {id:'window-bedroom2-extra',homeId:'home-main',roomId:'room-bed2',type:'window',name:'Ventana recámara 2 - B',state:'closed',enabled:true,visualZone:'back',visualSlot:3},

        {id:'window-bathroom',homeId:'home-main',roomId:'room-bath',type:'window',name:'Ventana pequeña del baño',state:'closed',enabled:true,visualZone:'back',visualSlot:4},

        {id:'motion-living',homeId:'home-main',roomId:'room-sala',type:'motion',name:'Movimiento sala',state:'idle',enabled:true,visualZone:'interior',visualSlot:4},
        {id:'motion-kitchen',homeId:'home-main',roomId:'room-kitchen',type:'motion',name:'Movimiento cocina',state:'idle',enabled:true,visualZone:'interior',visualSlot:5},
        {id:'motion-bed1',homeId:'home-main',roomId:'room-bed1',type:'motion',name:'Movimiento recámara 1',state:'idle',enabled:true,visualZone:'interior',visualSlot:6},
        {id:'motion-bed2',homeId:'home-main',roomId:'room-bed2',type:'motion',name:'Movimiento recámara 2',state:'idle',enabled:true,visualZone:'interior',visualSlot:7},

        {id:'camera-entry',homeId:'home-main',roomId:'room-sala',type:'camera',name:'Cámara entrada',state:'offline',enabled:true,source:'webcam',sourceValue:'',facingMode:'environment',visualZone:'front',visualSlot:5}
      ]
    };
  };

  CS.settings={onboarded:false,activeHomeId:'home-main',onlineMode:false,remoteProvider:null,apiBase:'',apiKey:'',lastSync:null};

  async function migrateLegacyDemo(){
    if(CS.ProfileManager)return;
    const legacy=await CS.DB.get('homes','home-demo');
    const main=await CS.DB.get('homes','home-main');
    if(!legacy || main)return;

    const allRooms=await CS.DB.getAll('rooms');
    const allDevices=await CS.DB.getAll('devices');
    const migratedHome={...legacy,id:'home-main',name:legacy.name==='Casa Demo'?'Mi vivienda':legacy.name};
    await CS.DB.put('homes',migratedHome);

    for(const r of allRooms.filter(x=>x.homeId==='home-demo')){
      r.homeId='home-main';await CS.DB.put('rooms',r);
    }
    for(const d of allDevices.filter(x=>x.homeId==='home-demo')){
      d.homeId='home-main';await CS.DB.put('devices',d);
    }
    await CS.DB.delete('homes','home-demo');
    await CS.DB.put('settings',{key:'activeHomeId',value:'home-main'});
  }

  CS.loadData=async function(){
    await CS.DB.open();
    const dbLabel=document.querySelector('#db-engine-label');
    if(dbLabel)dbLabel.textContent='Disponible';

    await migrateLegacyDemo();

    const settings=await CS.DB.getAll('settings');
    const pin=settings.find(s=>s.key==='pin');
    const onboarded=settings.find(s=>s.key==='onboarded');
    const active=settings.find(s=>s.key==='activeHomeId');
    const online=settings.find(s=>s.key==='onlineMode');
    const remote=settings.find(s=>s.key==='remoteProvider');
    const apiBase=settings.find(s=>s.key==='apiBase');
    const apiKey=settings.find(s=>s.key==='apiKey');
    const lastSync=settings.find(s=>s.key==='lastSync');
    if(pin)CS.PROJECT_PIN=pin.value;
    if(onboarded)CS.settings.onboarded=!!onboarded.value;
    if(active)CS.settings.activeHomeId=active.value;
    if(online)CS.settings.onlineMode=!!online.value;
    if(remote)CS.settings.remoteProvider=remote.value||null;
    if(apiBase)CS.settings.apiBase=apiBase.value||'';
    if(apiKey)CS.settings.apiKey=apiKey.value||'';
    if(lastSync)CS.settings.lastSync=lastSync.value||null;

    let homes=await CS.DB.getAll('homes');
    if(!homes.length){
      const initial=CS.initialModel();
      await CS.DB.put('homes',initial.home);
      for(const r of initial.rooms)await CS.DB.put('rooms',r);
      for(const d of initial.devices)await CS.DB.put('devices',d);
      homes=[initial.home];
      await CS.DB.put('settings',{key:'activeHomeId',value:'home-main'});
    }

    CS.state.home=homes.find(h=>h.id===CS.settings.activeHomeId)||homes.find(h=>h.id==='home-main')||homes[0];
    CS.settings.activeHomeId=CS.state.home.id;
    CS.state.rooms=(await CS.DB.getAll('rooms')).filter(r=>r.homeId===CS.state.home.id);
    CS.state.devices=(await CS.DB.getAll('devices')).filter(d=>d.homeId===CS.state.home.id);
    CS.state.events=(await CS.DB.getAll('events')).sort((a,b)=>b.timestamp-a.timestamp).slice(0,300);
    CS.state.notifications=(await CS.DB.getAll('notifications')).sort((a,b)=>b.timestamp-a.timestamp).slice(0,60);

    await ensureFloorPlanBase();

    // Si una instalación antigua quedó incompleta, añade únicamente los campos visuales faltantes.
    CS.state.devices.forEach((d,i)=>{
      if(!d.visualZone)d.visualZone=['front','left','right','back','interior'][i%5];
      if(d.visualSlot===undefined)d.visualSlot=i;
    });
  };


  async function ensureFloorPlanBase(){
    if(CS.ProfileManager?.activeProfile==='main')return;
    const base=CS.initialModel();
    const activeId=CS.state.home?.id;
    if(activeId!=='home-main')return;

    /* elimina únicamente el pasillo predeterminado de versiones anteriores */
    const oldHall=CS.state.rooms.find(r=>r.id==='room-hall');
    if(oldHall){
      await CS.DB.delete('rooms','room-hall');
      const hallDevices=CS.state.devices.filter(d=>d.roomId==='room-hall');
      for(const d of hallDevices)await CS.DB.delete('devices',d.id);
    }

    const existingRooms=await CS.DB.getAll('rooms');
    for(const room of base.rooms){
      if(!existingRooms.some(r=>r.id===room.id))await CS.DB.put('rooms',room);
    }

    const existingDevices=await CS.DB.getAll('devices');
    for(const model of base.devices){
      const current=existingDevices.find(d=>d.id===model.id);
      if(!current){
        await CS.DB.put('devices',model);
      }else{
        /* conserva estado/nombre del usuario; repara identidad y ubicación base */
        current.homeId='home-main';
        current.roomId=model.roomId;
        current.type=model.type;
        current.visualZone=model.visualZone;
        current.visualSlot=model.visualSlot;
        if(current.enabled===undefined)current.enabled=true;
        await CS.DB.put('devices',current);
      }
    }

    CS.state.rooms=(await CS.DB.getAll('rooms')).filter(r=>r.homeId==='home-main' && r.id!=='room-hall');
    CS.state.devices=(await CS.DB.getAll('devices')).filter(d=>d.homeId==='home-main' && d.roomId!=='room-hall');
  }

  CS.saveSetting=async function(key,value){
    await CS.DB.put('settings',{key,value});
    if(key==='onboarded')CS.settings.onboarded=!!value;
    if(key==='activeHomeId')CS.settings.activeHomeId=value;
    if(key==='pin')CS.PROJECT_PIN=String(value);
    if(key==='onlineMode')CS.settings.onlineMode=!!value;
    if(key==='remoteProvider')CS.settings.remoteProvider=value||null;
    if(key==='apiBase')CS.settings.apiBase=value||'';
    if(key==='apiKey')CS.settings.apiKey=value||'';
    if(key==='lastSync')CS.settings.lastSync=value||null;
  };
})();
