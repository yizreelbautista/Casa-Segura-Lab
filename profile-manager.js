/*
 * CASA SEGURA — ADMINISTRADOR DE PERFILES
 * Separa por completo la Demo de la Casa principal.
 * No modifica la geometría del motor arquitectónico.
 */
(function(){
  'use strict';
  const CS=window.CasaSegura=window.CasaSegura||{};

  const META_MAIN='CasaSegura_Profile_HasMain_v1';
  const META_MAIN_CONFIGURED='CasaSegura_Profile_MainConfigured_v1';
  const META_ACTIVE='CasaSegura_Profile_Active_v1';

  const PM={
    activeProfile:null,
    startView:'dashboard',

    hasMain(){
      return localStorage.getItem(META_MAIN)==='1';
    },

    mainConfigured(){
      return localStorage.getItem(META_MAIN_CONFIGURED)==='1';
    },

    markPrimaryConfigured(){
      localStorage.setItem(META_MAIN,'1');
      localStorage.setItem(META_MAIN_CONFIGURED,'1');
    },

    dbName(profile=this.activeProfile){
      return profile==='main'
        ? 'CasaSeguraDB_Principal_v1'
        : 'CasaSeguraDB_Demo_v1';
    },

    fallbackPrefix(profile=this.activeProfile){
      return profile==='main'?'cs_main_v1_':'cs_demo_v1_';
    },

    cadKey(profile=this.activeProfile){
      return profile==='main'
        ? 'CasaSegura_CAD_Model_v4_main'
        : 'CasaSegura_CAD_Model_v4_demo';
    },

    profileLabel(profile=this.activeProfile){
      return profile==='main'?'Casa principal':'Demo';
    },

    emptyCADModel(){
      return{version:4,width:12,depth:8,wallHeight:2.8,rooms:[],openings:[]};
    },

    choose(profile,firstConfiguration=false){
      this.activeProfile=profile;
      localStorage.setItem(META_ACTIVE,profile);

      if(profile==='main'){
        localStorage.setItem(META_MAIN,'1');
        this.startView=(firstConfiguration||!this.mainConfigured())?'cad':'dashboard';
      }else{
        this.startView='dashboard';
      }

      const screen=document.querySelector('#profile-screen');
      const access=document.querySelector('#access-screen');
      if(screen)screen.hidden=true;
      if(access)access.hidden=false;
      this.updateProfileButton();
      this._resolveSelection?.(profile);
      this._resolveSelection=null;
    },

    async deleteDatabase(profile){
      const name=this.dbName(profile);
      try{
        await new Promise(resolve=>{
          const req=indexedDB.deleteDatabase(name);
          req.onsuccess=req.onerror=req.onblocked=()=>resolve();
        });
      }catch(e){console.warn('No se pudo eliminar IndexedDB:',e)}

      const prefix=this.fallbackPrefix(profile);
      [...Array(localStorage.length)].forEach((_,i)=>{
        const k=localStorage.key(i);
        if(k?.startsWith(prefix))localStorage.removeItem(k);
      });
    },

    async restoreDemo(){
      const ok=window.confirm('¿Restaurar la demo exactamente a su configuración original? Se perderán únicamente los cambios hechos en la Demo.');
      if(!ok)return false;

      await this.deleteDatabase('demo');
      localStorage.removeItem(this.cadKey('demo'));
      localStorage.setItem(META_ACTIVE,'demo');
      location.reload();
      return true;
    },

    renderSelector(){
      const content=document.querySelector('#profile-content');
      if(!content)return;

      const hasMain=this.hasMain();
      const title=document.querySelector('#profile-title');
      const copy=document.querySelector('#profile-copy');

      if(title)title.textContent=hasMain?'¿Qué vivienda quieres abrir?':'¿Cómo quieres comenzar?';
      if(copy)copy.textContent=hasMain
        ? 'Demo y Casa principal guardan su configuración por separado.'
        : 'Puedes usar la demostración o crear una vivienda completamente independiente.';

      content.innerHTML=hasMain
        ? `
          <button class="profile-card profile-card--primary" type="button" data-profile-choice="main">
            <span class="profile-card__icon">⌂</span>
            <span><strong>Casa principal</strong><small>Tu vivienda y tus dispositivos guardados.</small></span>
            <b>Abrir</b>
          </button>
          <button class="profile-card" type="button" data-profile-choice="demo">
            <span class="profile-card__icon">◇</span>
            <span><strong>Demo</strong><small>Vivienda demostrativa. Puedes modificarla y restaurarla.</small></span>
            <b>Abrir</b>
          </button>
          <button id="profile-restore-demo" class="btn btn--secondary btn--block" type="button">Restaurar Demo original</button>
        `
        : `
          <button class="profile-card" type="button" data-profile-choice="demo">
            <span class="profile-card__icon">◇</span>
            <span><strong>Continuar con demo</strong><small>Abre la casa demostrativa que ya está terminada.</small></span>
            <b>Usar Demo</b>
          </button>
          <button class="profile-card profile-card--primary" type="button" data-profile-choice="main-new">
            <span class="profile-card__icon">＋</span>
            <span><strong>Configurar mi propia vivienda</strong><small>Empieza con un plano vacío y crea tu propia casa.</small></span>
            <b>Configurar</b>
          </button>
        `;

      content.querySelectorAll('[data-profile-choice]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const value=btn.dataset.profileChoice;
          if(value==='main-new')this.choose('main',true);
          else this.choose(value,false);
        });
      });

      content.querySelector('#profile-restore-demo')?.addEventListener('click',()=>this.restoreDemo());
    },

    selectOnStart(){
      const screen=document.querySelector('#profile-screen');
      const access=document.querySelector('#access-screen');
      if(screen)screen.hidden=false;
      if(access)access.hidden=true;
      this.renderSelector();

      return new Promise(resolve=>{
        this._resolveSelection=resolve;
      });
    },

    openSwitcher(){
      const screen=document.querySelector('#profile-screen');
      if(!screen)return;
      screen.hidden=false;
      this.renderSelector();

      // En un cambio de perfil la selección recarga para abrir su propia base.
      screen.querySelectorAll('[data-profile-choice]').forEach(btn=>{
        btn.replaceWith(btn.cloneNode(true));
      });
      this.renderSelector();
      screen.querySelectorAll('[data-profile-choice]').forEach(btn=>{
        btn.addEventListener('click',()=>{
          const v=btn.dataset.profileChoice;
          const profile=v==='main-new'?'main':v;
          if(v==='main-new')localStorage.setItem(META_MAIN,'1');
          localStorage.setItem(META_ACTIVE,profile);
          location.reload();
        });
      });
      screen.querySelector('#profile-restore-demo')?.addEventListener('click',()=>this.restoreDemo());
    },

    updateProfileButton(){
      const btn=document.querySelector('#profile-switch-button');
      if(!btn)return;
      btn.innerHTML=`<span>${this.activeProfile==='main'?'⌂':'◇'}</span><b>${this.profileLabel()}</b>`;
      btn.title='Cambiar entre Casa principal y Demo';
    },

    bindAppControls(){
      this.updateProfileButton();
      document.querySelector('#profile-switch-button')?.addEventListener('click',()=>this.openSwitcher());
      document.querySelector('#restore-demo-button')?.addEventListener('click',()=>this.restoreDemo());
    }
  };

  CS.ProfileManager=PM;
})();
