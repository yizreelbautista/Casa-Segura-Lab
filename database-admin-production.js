/*
 * CASA SEGURA — EXPLORADOR DE BASE DE DATOS
 * Online: PostgreSQL vía API.
 * Offline: caché local IndexedDB.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura;
  const TABLE_LABELS={homes:'Viviendas',rooms:'Habitaciones',devices:'Dispositivos',events:'Eventos',notifications:'Notificaciones'};
  let current='homes';

  function els(){
    return{
      origin:document.querySelector('#database-origin'),
      originDetail:document.querySelector('#database-origin-detail'),
      server:document.querySelector('#database-server-status'),
      serverDetail:document.querySelector('#database-server-detail'),
      home:document.querySelector('#database-home-name'),
      count:document.querySelector('#database-record-count'),
      msg:document.querySelector('#database-table-message'),
      head:document.querySelector('#database-record-head'),
      body:document.querySelector('#database-record-body')
    };
  }

  function onlineReady(){
    return !!CS.settings.onlineMode && !!CS.settings.apiBase && navigator.onLine;
  }

  function normalizeLocal(table,rows){
    if(table==='settings')return rows;
    return rows;
  }

  async function localRows(table){
    const rows=await CS.DB.getAll(table);
    if(table==='rooms'||table==='devices')return rows.filter(x=>x.homeId===CS.state.home?.id);
    return rows;
  }

  function formatValue(v){
    if(v===null||v===undefined)return '<span class="db-null">null</span>';
    if(typeof v==='boolean')return `<span class="${v?'db-bool-true':'db-bool-false'}">${v?'true':'false'}</span>`;
    if(typeof v==='object')return CS.escapeHtml(JSON.stringify(v));
    return CS.escapeHtml(String(v));
  }

  function renderRows(table,rows,source){
    const e=els();
    e.head.innerHTML='';e.body.innerHTML='';
    if(!rows.length){
      e.msg.textContent=`${TABLE_LABELS[table]||table}: sin registros en ${source}.`;
      e.count.textContent='0 registros visibles';
      return;
    }
    const cols=[...new Set(rows.flatMap(r=>Object.keys(r)))].slice(0,14);
    const trh=document.createElement('tr');
    cols.forEach(c=>{const th=document.createElement('th');th.textContent=c;trh.append(th);});
    e.head.append(trh);
    rows.slice(0,200).forEach(row=>{
      const tr=document.createElement('tr');
      cols.forEach(c=>{const td=document.createElement('td');td.innerHTML=formatValue(row[c]);td.title=typeof row[c]==='object'?JSON.stringify(row[c]):String(row[c]??'');tr.append(td);});
      e.body.append(tr);
    });
    e.msg.textContent=`${TABLE_LABELS[table]||table}: ${rows.length} registro(s) · origen ${source}.`;
    e.count.textContent=`${rows.length} registros visibles`;
  }

  CS.refreshDatabaseBrowser=async function(table=current){
    current=table;
    const e=els();
    if(!e.origin)return;
    e.home.textContent=CS.state.home?.name||'Mi vivienda';
    e.msg.textContent='Consultando registros…';

    document.querySelectorAll('[data-db-table]').forEach(b=>b.classList.toggle('is-active',b.dataset.dbTable===table));

    if(onlineReady()){
      try{
        const health=await CS.Remote.health();
        e.origin.textContent='PostgreSQL';
        e.originDetail.textContent='Registros centrales compartidos entre los equipos conectados.';
        e.server.textContent='Conectado';
        e.serverDetail.textContent=CS.settings.apiBase;
        const data=await CS.Remote.readTable(table,200);
        renderRows(table,data.rows||[],'PostgreSQL');
        updateSettingsStatus(true);
        return;
      }catch(err){
        e.server.textContent='Sin respuesta';
        e.serverDetail.textContent=String(err.message||err);
      }
    }

    e.origin.textContent='Caché local';
    e.originDetail.textContent='El equipo está trabajando con su almacenamiento offline.';
    e.server.textContent=CS.settings.apiBase?'Servidor no disponible':'No configurado';
    e.serverDetail.textContent=CS.settings.apiBase||'Configura el servidor en Configuración.';
    const rows=normalizeLocal(table,await localRows(table));
    renderRows(table,rows,'local');
    updateSettingsStatus(false);
  };

  function updateSettingsStatus(connected){
    const s=document.querySelector('#settings-db-status'),server=document.querySelector('#settings-db-server');
    if(s)s.textContent=connected?'PostgreSQL conectado':'Offline / caché local';
    if(server)server.textContent=CS.settings.apiBase||'No configurado';
  }

  CS.initDatabaseAdmin=function(){
    document.querySelectorAll('[data-db-table]').forEach(btn=>btn.addEventListener('click',()=>CS.refreshDatabaseBrowser(btn.dataset.dbTable)));
    document.querySelector('#db-refresh-button')?.addEventListener('click',()=>CS.refreshDatabaseBrowser());
    updateSettingsStatus(onlineReady());
  };
})();
