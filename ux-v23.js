/*
 * UX v2.3 — navegación, mensajes, ayuda, onboarding y confirmaciones.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  const titles={dashboard:'Panel',home:'Mi vivienda',cad:'Editor CAD',devices:'Dispositivos',cameras:'Cámaras',history:'Historial',database:'Base de datos',settings:'Configuración',help:'Ayuda'};

  CS.navigate=function(view){
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('is-active',v.dataset.viewPanel===view));
    document.querySelectorAll('.nav-link').forEach(v=>v.classList.toggle('is-active',v.dataset.view===view));
    document.querySelector('#view-title').textContent=titles[view]||'Casa Segura';
    document.querySelector('#sidebar').classList.remove('is-open');
    if(view==='home'){CS.renderHomeEditor();CS.CAD?.renderHomePreview?.();}
    if(view==='cad')CS.CAD?.render();
    if(view==='devices')CS.renderDeviceTable();
    if(view==='cameras')CS.renderCameraGrid();
    if(view==='history')CS.renderEvents();
    if(view==='database')CS.refreshDatabaseBrowser?.();
  };

  CS.showToast=function(title,text){
    const region=document.querySelector('#toast-region');
    const t=document.createElement('div');t.className='toast';
    const strong=document.createElement('strong');strong.textContent=title;
    const span=document.createElement('span');span.textContent=text||'';
    t.append(strong,span);region.append(t);
    setTimeout(()=>t.remove(),3400);
  };

  CS.deleteNotification=async function(id){
    const item=CS.state.notifications.find(n=>n.id===id);
    if(!item)return;
    CS.state.notifications=CS.state.notifications.filter(n=>n.id!==id);
    try{await CS.DB?.delete('notifications',id);}catch(e){console.warn('No se pudo eliminar la notificación:',e);}
    CS.renderNotifications();
    CS.refreshDatabaseBrowser?.('notifications');
  };

  CS.clearNotifications=async function(){
    if(!CS.state.notifications.length)return;
    const ok=await CS.confirmAction('Eliminar todas las notificaciones','Se limpiará por completo el centro de notificaciones.','Eliminar todas');
    if(!ok)return;
    CS.state.notifications=[];
    try{await CS.DB?.clear('notifications');}catch(e){console.warn('No se pudieron limpiar las notificaciones:',e);}
    CS.renderNotifications();
    CS.refreshDatabaseBrowser?.('notifications');
    CS.showToast('Notificaciones eliminadas','El centro de notificaciones quedó vacío.');
  };

  CS.renderNotifications=function(){
    const list=document.querySelector('#notification-list');
    const count=document.querySelector('#notification-count');
    const panelCount=document.querySelector('#notification-panel-count');
    const clearButton=document.querySelector('#clear-notifications');
    if(!list||!count)return;

    const total=CS.state.notifications.length;
    list.innerHTML='';
    count.textContent=String(Math.min(99,total));
    count.hidden=total===0;
    if(panelCount)panelCount.textContent=`${total} notificación${total===1?'':'es'}`;
    if(clearButton)clearButton.disabled=total===0;

    if(!total){
      const empty=document.createElement('li');
      empty.className='notification-empty';
      empty.innerHTML='<strong>Sin notificaciones</strong><small>No hay avisos pendientes.</small>';
      list.append(empty);
      return;
    }

    CS.state.notifications.forEach(n=>{
      const li=document.createElement('li');
      li.className=`notification-item notification-item--${n.kind||'info'}`;

      const copy=document.createElement('div');
      copy.className='notification-copy';
      const strong=document.createElement('strong');
      strong.textContent=n.title;
      const small=document.createElement('small');
      small.textContent=`${n.detail} · ${n.time}`;
      copy.append(strong,small);

      const del=document.createElement('button');
      del.type='button';
      del.className='notification-delete-btn';
      del.textContent='×';
      del.title='Eliminar notificación';
      del.setAttribute('aria-label',`Eliminar: ${n.title}`);
      del.addEventListener('click',e=>{
        e.stopPropagation();
        CS.deleteNotification(n.id);
      });

      li.append(copy,del);
      list.append(li);
    });
  };

  CS.confirmAction=function(title,text,acceptText='Confirmar'){
    return new Promise(resolve=>{
      const back=document.querySelector('#confirm-backdrop');
      document.querySelector('#confirm-title').textContent=title;
      document.querySelector('#confirm-text').textContent=text;
      document.querySelector('#confirm-accept').textContent=acceptText;
      back.hidden=false;
      const cleanup=value=>{back.hidden=true;cancel.onclick=null;accept.onclick=null;resolve(value);};
      const cancel=document.querySelector('#confirm-cancel'),accept=document.querySelector('#confirm-accept');
      cancel.onclick=()=>cleanup(false);accept.onclick=()=>cleanup(true);
    });
  };

  const helpContent={
    vivienda:{title:'Configurar la vivienda',html:'<p>Primero crea habitaciones y después agrega dispositivos. Las puertas y ventanas participan en el estado de seguridad. Cada control de simulación está identificado como una acción, mientras que los estados son solamente texto.</p>'},
    camaras:{title:'Uso de cámaras',html:'<p>La cámara del dispositivo solo se activa cuando presionas Iniciar cámara. En teléfono puede usar la frontal o trasera. Las cámaras IP pueden funcionar dentro de tu LAN; para verlas desde otra red se requiere plataforma del fabricante, gateway o servicio remoto.</p>'},
    visual:{title:'Vivienda interactiva',html:'<p>La vista Interior muestra la vivienda amueblada. Las puertas y ventanas cambian visualmente con su estado. Los sensores usan verde para cerrado, amarillo para abierto y rojo durante alarma.</p><p>Los dispositivos pueden agregarse, editarse o eliminarse desde Mi vivienda.</p>'},
    online:{title:'Modo local y online',html:'<p>Casa Segura no conecta tu computadora al Wi‑Fi ni solicita su contraseña. Utiliza la red que ya tenga el sistema operativo. El modo local usa IndexedDB y el modo online puede sincronizar con la API PostgreSQL configurada.</p>'},
    servidor:{title:'Servidor PostgreSQL',html:'<p>Una PC central ejecuta PostgreSQL y la API incluida. Las demás laptops configuran la URL de esa API. Nunca conectamos el navegador directamente a PostgreSQL.</p>'},
    pin:{title:'PIN y privacidad',html:'<p>Los PIN se ocultan por defecto. El icono dentro del campo permite mostrar u ocultar temporalmente el valor. La versión remota deberá reemplazar este almacenamiento local por autenticación segura en backend.</p>'}
  };

  CS.openHelpTopic=function(topic){
    const data=helpContent[topic]||{title:'Ayuda',html:'<p>Consulta el manual integrado para obtener instrucciones completas.</p>'};
    document.querySelector('#help-drawer-title').textContent=data.title;
    document.querySelector('#help-drawer-content').innerHTML=data.html;
    document.querySelector('#help-drawer').hidden=false;
  };

  let onboardStep=0,onboardMode='demo';
  const onboarding=document.querySelector('#onboarding');
  CS.startOnboarding=function(){
    onboardStep=0;onboarding.hidden=false;renderOnboarding();
  };
  function renderOnboarding(){
    const content=document.querySelector('#onboarding-content'),bar=document.querySelector('#onboarding-bar');
    bar.style.width=`${(onboardStep+1)*25}%`;
    if(onboardStep===0){
      content.innerHTML=`<span class="onboarding-step-label">Paso 1 de 4</span><h2>Bienvenido a Casa Segura</h2><p>Elige cómo deseas comenzar.</p><div class="onboarding-actions"><button class="btn btn--primary" id="ob-custom">Configurar Casa Segura</button><button class="btn btn--secondary" id="ob-demo">Utilizar demo</button></div>`;
      document.querySelector('#ob-custom').onclick=async()=>{await CS.saveSetting('onboarded',true);onboarding.hidden=true;CS.navigate('cad');};
      document.querySelector('#ob-demo').onclick=async()=>{await CS.saveSetting('onboarded',true);CS.CAD?.reset?.();onboarding.hidden=true;CS.navigate('dashboard');};
    }else if(onboardStep===1){
      content.innerHTML=`<span class="onboarding-step-label">Paso 1 de 4</span><h2>Bienvenido a Casa Segura</h2><p>Tu vivienda inicial ya está configurada y puedes modificarla por completo desde “Mi vivienda”.</p><div class="onboarding-actions"><button class="btn btn--primary" id="ob-custom">Continuar</button></div>`;
      document.querySelector('#ob-custom').onclick=()=>{onboardMode='custom';onboardStep=2;renderOnboarding();};
    }else if(onboardStep===2){
      content.innerHTML=`<span class="onboarding-step-label">Paso 3 de 4</span><h2>Conoce las funciones principales</h2><p><strong>Panel:</strong> estado general y activación.</p><p><strong>Mi vivienda:</strong> habitaciones, sensores y cámaras.</p><p><strong>PÁNICO:</strong> emergencia manual que exige PIN para silenciar.</p><p><strong>Ayuda:</strong> manual completo integrado.</p><div class="onboarding-actions"><button class="btn btn--primary" id="ob-next">Continuar</button></div>`;
      document.querySelector('#ob-next').onclick=()=>{onboardStep=3;renderOnboarding();};
    }else{
      content.innerHTML=`<span class="onboarding-step-label">Paso 4 de 4</span><h2>Configuración lista</h2><p>Casa Segura ya está preparada. Puedes modificar la vivienda, agregar más dispositivos o consultar el manual en cualquier momento.</p><div class="onboarding-actions"><button class="btn btn--primary" id="ob-finish">Ir al Panel</button><button class="btn btn--secondary" id="ob-help">Abrir manual</button></div>`;
      document.querySelector('#ob-finish').onclick=()=>finishOnboarding('dashboard');
      document.querySelector('#ob-help').onclick=()=>finishOnboarding('help');
    }
  }

  async function createQuickHome(){
    const name=document.querySelector('#ob-home-name').value.trim()||'Mi vivienda';
    const roomCount=Math.max(1,Math.min(12,Number(document.querySelector('#ob-rooms').value)||1));
    const doors=Math.max(1,Math.min(20,Number(document.querySelector('#ob-doors').value)||1));
    const windows=Math.max(0,Math.min(30,Number(document.querySelector('#ob-windows').value)||0));

    const id=CS.uid('home');CS.state.home={id,name,active:true,createdAt:Date.now()};CS.state.rooms=[];CS.state.devices=[];
    await CS.DB.put('homes',CS.state.home);await CS.saveSetting('activeHomeId',id);
    for(let i=0;i<roomCount;i++){const r={id:CS.uid('room'),homeId:id,name:i===0?'Sala / Entrada':`Habitación ${i+1}`,type:i===0?'Sala':'Habitación'};CS.state.rooms.push(r);await CS.DB.put('rooms',r);}
    for(let i=0;i<doors;i++){const d={id:CS.uid('door'),homeId:id,roomId:CS.state.rooms[Math.min(i,CS.state.rooms.length-1)].id,type:'door',name:i===0?'Puerta principal':`Puerta ${i+1}`,state:'closed',enabled:true};CS.state.devices.push(d);await CS.DB.put('devices',d);}
    for(let i=0;i<windows;i++){const d={id:CS.uid('window'),homeId:id,roomId:CS.state.rooms[i%CS.state.rooms.length].id,type:'window',name:`Ventana ${i+1}`,state:'closed',enabled:true};CS.state.devices.push(d);await CS.DB.put('devices',d);}
    CS.addEvent('Vivienda configurada',`${name} fue creada mediante la guía inicial.`,'system');CS.renderHomeEditor();CS.render();
  }

  async function finishOnboarding(view){
    await CS.saveSetting('onboarded',true);onboarding.hidden=true;CS.navigate(view);
  }

  CS.initUXV23=function(){
    document.querySelectorAll('.nav-link').forEach(b=>b.addEventListener('click',()=>CS.navigate(b.dataset.view)));
    document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>CS.navigate(b.dataset.go)));
    document.querySelector('#menu-toggle').addEventListener('click',()=>document.querySelector('#sidebar').classList.toggle('is-open'));

    const np=document.querySelector('#notifications-panel');
    document.querySelector('#notifications-button').addEventListener('click',()=>np.hidden=!np.hidden);
    document.querySelector('#close-notifications').addEventListener('click',()=>np.hidden=true);
    document.querySelector('#clear-notifications')?.addEventListener('click',()=>CS.clearNotifications());

    document.querySelectorAll('[data-toggle-password]').forEach(btn=>btn.addEventListener('click',function(){
      const input=document.querySelector('#'+this.dataset.togglePassword);
      input.type=input.type==='password'?'text':'password';
      this.textContent=input.type==='password'?'◉':'◎';
      this.setAttribute('aria-label',input.type==='password'?'Mostrar PIN':'Ocultar PIN');
    }));

    document.querySelectorAll('[data-help-topic]').forEach(b=>b.addEventListener('click',()=>CS.openHelpTopic(b.dataset.helpTopic)));
    document.querySelector('#help-drawer-close').addEventListener('click',()=>document.querySelector('#help-drawer').hidden=true);
    document.querySelector('#help-drawer-manual').addEventListener('click',()=>{document.querySelector('#help-drawer').hidden=true;CS.navigate('help');});

    document.querySelector('#help-search').addEventListener('input',function(){
      const q=this.value.trim().toLowerCase();
      document.querySelectorAll('.help-topic').forEach(d=>d.hidden=q&&!d.textContent.toLowerCase().includes(q));
    });

    document.querySelector('#onboarding-close').addEventListener('click',()=>onboarding.hidden=true);
    document.querySelector('#restart-onboarding').addEventListener('click',CS.startOnboarding);
  };
})();
