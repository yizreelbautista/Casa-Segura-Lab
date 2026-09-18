(function(){
  'use strict';
  const CS=window.CasaSegura;

  const CAD={
    model:null,selected:null,selectedOpening:null,scale:70,pad:55,

    init(){
      this.model=CS.CADStore.load();
      this.syncNamesFromState();
      CS.syncCADRuntime?.();
      document.querySelector('#cad-editor-svg')?.addEventListener('click',e=>{
        if(CS.CADDragEngine?.drag)return;
        const opening=e.target.closest?.('[data-opening-id]');
        if(opening){
          this.selectedOpening=opening.dataset.openingId;
          this.selected=null;
          this.render();
          return;
        }
        const room=e.target.closest?.('[data-room-id]');
        if(room){
          this.selected=room.dataset.roomId;
          this.selectedOpening=null;
          this.render();
        }
      });
      document.querySelector('#cad-generate')?.addEventListener('click',()=>this.generateBedrooms(document.querySelector('#cad-bedrooms').value));
      document.querySelector('#cad-add-room')?.addEventListener('click',()=>this.addRoom());
      const resetBtn=document.querySelector('#cad-reset');
      if(resetBtn){
        resetBtn.textContent=CS.ProfileManager?.activeProfile==='demo'?'Restaurar demo original':'Vaciar plano';
        resetBtn.addEventListener('click',()=>this.reset());
      }
      document.querySelector('#cad-apply')?.addEventListener('click',()=>this.applyToCasaSegura());
      document.querySelector('#home-open-cad')?.addEventListener('click',()=>CS.navigate?.('cad'));
      this.render();
    },

    room(id){return this.model.rooms.find(r=>r.id===id);},

    syncNamesFromState(){
      for(const r of this.model.rooms){
        const sr=CS.state.rooms?.find(x=>x.id===r.id);
        if(sr){r.name=sr.name;r.type=sr.type;}
      }
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
    },

    async reset(){
      if(CS.ProfileManager?.activeProfile==='demo'){
        await CS.ProfileManager.restoreDemo();
        return;
      }

      const ok=window.confirm('¿Vaciar el plano de Casa principal? Esto eliminará habitaciones y dispositivos de la Casa principal, pero no afectará la Demo.');
      if(!ok)return;

      this.model=CS.CADStore.emptyModel();
      this.selected=null;
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();

      for(const d of [...CS.state.devices])await CS.DB.delete('devices',d.id);
      for(const r of [...CS.state.rooms])await CS.DB.delete('rooms',r.id);
      CS.state.rooms=[];
      CS.state.devices=[];

      this.render();
      CS.Architectural3D?.rebuild?.();
      CS.renderHomeEditor?.();
      CS.render?.();
      CS.showToast?.('Plano vacío','Casa principal está lista para configurarse.');
    },

    generateBedrooms(count){
      count=Math.max(1,Math.min(6,Number(count)||2));
      const bathW=2,backW=10,bw=backW/count;
      const rooms=[];
      for(let i=0;i<count;i++){
        rooms.push({id:`room-bed${i+1}`,name:`Recámara ${i+1}`,type:'Recámara',x:i*bw,z:0,w:bw,d:4});
      }
      rooms.push({id:'room-bath',name:'Baño',type:'Baño',x:10,z:0,w:2,d:4});
      rooms.push({id:'room-sala',name:'Sala / Entrada',type:'Sala',x:0,z:4,w:6,d:4});
      rooms.push({id:'room-kitchen',name:'Cocina',type:'Cocina',x:6,z:4,w:6,d:4});

      this.model.rooms=rooms;
      this.model.width=12;this.model.depth=8;
      this.model.openings=this.model.openings.filter(o=>rooms.some(r=>r.id===o.roomId));

      // Garantizar puerta y 2 ventanas por recámara.
      for(let i=0;i<count;i++){
        const rid=`room-bed${i+1}`;
        if(!this.model.openings.some(o=>o.id===`door-bedroom${i+1}`))
          this.model.openings.push({id:`door-bedroom${i+1}`,type:'door',roomId:rid,wall:'south',offset:.5,width:.9});
        for(const suffix of ['a','b']){
          const id=`window-bedroom${i+1}-${suffix}`;
          if(!this.model.openings.some(o=>o.id===id))
            this.model.openings.push({id,type:'window',roomId:rid,wall:'north',offset:suffix==='a'?.30:.72,width:Math.min(1.2,bw*.30),height:1.2,sill:.9});
        }
      }

      this.selected=null;
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
      this.render();
      CS.Architectural3D?.rebuild?.();
    },

    addRoom(){
      const maxX=Math.max(12,...this.model.rooms.map(r=>r.x+r.w));
      const id=CS.uid?.('room')||`room-${Date.now()}`;
      this.model.rooms.push({id,name:`Habitación ${this.model.rooms.length+1}`,type:'Otro',x:maxX+.3,z:0,w:3,d:3});
      this.model.width=maxX+3.3;
      this.selected=id;
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
      this.render();
      CS.Architectural3D?.rebuild?.();
    },

    removeSelected(){
      if(!this.selected)return;
      const id=this.selected;
      this.model.rooms=this.model.rooms.filter(r=>r.id!==id);
      this.model.openings=this.model.openings.filter(o=>o.roomId!==id);
      this.selected=null;
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
      this.render();
      CS.Architectural3D?.rebuild?.();
    },

    addOpening(type){
      const room=this.room(this.selected)||this.model.rooms[0];
      if(!room)return;

      if(type==='passage'&&room.type!=='Pasillo'){
        CS.showToast?.(
          'Apertura libre',
          'Selecciona primero una habitación con categoría Pasillo.'
        );
        return;
      }

      const id=CS.uid?.(type)||`${type}-${Date.now()}`;
      const opening={
        id,type,roomId:room.id,wall:'south',offset:.5,
        width:type==='door'?.9:type==='window'?1.2:type==='passage'?1.5:.35,
        height:type==='door'?2.1:type==='window'?1.2:type==='passage'?(this.model.wallHeight||2.8):.22,
        sill:type==='window'?.9:type==='camera'?2.25:0
      };
      this.model.openings.push(opening);
      this.selectedOpening=id;
      this.selected=null;
      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
      this.render();
      CS.Architectural3D?.rebuild?.();
    },

    async applyToCasaSegura(){
      const keep=new Set(this.model.rooms.map(r=>r.id));

      for(const cr of this.model.rooms){
        let room=CS.state.rooms.find(r=>r.id===cr.id);
        if(!room){
          room={id:cr.id,homeId:CS.state.home.id,name:cr.name,type:cr.type};
          CS.state.rooms.push(room);
        }else{
          room.name=cr.name;room.type=cr.type;
        }
        await CS.DB.put('rooms',room);
      }

      for(const old of [...CS.state.rooms].filter(r=>!keep.has(r.id))){
        for(const d of CS.state.devices.filter(d=>d.roomId===old.id)){
          await CS.DB.delete('devices',d.id);
        }
        await CS.DB.delete('rooms',old.id);
      }

      CS.state.rooms=CS.state.rooms.filter(r=>keep.has(r.id));
      CS.state.devices=CS.state.devices.filter(d=>keep.has(d.roomId));

      // Crear dispositivos faltantes del plano CAD en el mismo estado global.
      // "passage" es arquitectura: no debe convertirse en sensor/dispositivo.
      for(const op of this.model.openings.filter(o=>['door','window','camera'].includes(o.type))){
        if(!CS.state.devices.some(d=>d.id===op.id)){
          const name=op.type==='door'?'Puerta':op.type==='window'?'Ventana':'Cámara';
          const dev={
            id:op.id,homeId:CS.state.home.id,roomId:op.roomId,type:op.type,
            name:`${name} ${CS.state.devices.filter(d=>d.type===op.type).length+1}`,
            state:op.type==='camera'?'offline':'closed',enabled:true,
            visualZone:'interior',visualSlot:0
          };
          CS.state.devices.push(dev);
          await CS.DB.put('devices',dev);
        }
      }

      CS.CADStore.save(this.model);CS.syncCADRuntime?.();
      if(CS.ProfileManager?.activeProfile==='main')CS.ProfileManager.markPrimaryConfigured();
      CS.Architectural3D?.rebuild?.();
      this.renderHomePreview();
      CS.renderHomeEditor?.();
      CS.renderCameraGrid?.();
      CS.render?.();
      CS.addEvent?.('Modelo CAD aplicado','El plano arquitectónico se sincronizó con Casa Segura.','system');
      CS.showToast?.('Casa actualizada','El panel 3D usa ahora esta configuración.');
    },

    render(){
      const svg=document.querySelector('#cad-editor-svg');
      if(!svg)return;
      const S=this.scale,P=this.pad;
      const maxX=Math.max(12,this.model.width||12,...this.model.rooms.map(r=>r.x+r.w));
      const maxZ=Math.max(8,this.model.depth||8,...this.model.rooms.map(r=>r.z+r.d));
      const W=Math.max(980,maxX*S+P*2),H=Math.max(650,maxZ*S+P*2);
      svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML='';
      const ns='http://www.w3.org/2000/svg';

      for(let x=P;x<=W-P;x+=S){
        const l=document.createElementNS(ns,'line');l.setAttribute('x1',x);l.setAttribute('x2',x);l.setAttribute('y1',P);l.setAttribute('y2',H-P);l.setAttribute('class','cad-grid-line');svg.append(l);
      }
      for(let y=P;y<=H-P;y+=S){
        const l=document.createElementNS(ns,'line');l.setAttribute('x1',P);l.setAttribute('x2',W-P);l.setAttribute('y1',y);l.setAttribute('y2',y);l.setAttribute('class','cad-grid-line');svg.append(l);
      }

      for(const r of this.model.rooms){
        const x=P+r.x*S,y=P+r.z*S,w=r.w*S,h=r.d*S;

        const rect=document.createElementNS(ns,'rect');
        rect.setAttribute('x',x);rect.setAttribute('y',y);
        rect.setAttribute('width',w);rect.setAttribute('height',h);
        rect.setAttribute('class','cad-room'+(this.selected===r.id?' is-selected':''));
        rect.dataset.roomId=r.id;rect.dataset.roomVisual=r.id;svg.append(rect);

        const t=document.createElementNS(ns,'text');
        t.setAttribute('x',x+w/2);t.setAttribute('y',y+h/2-4);
        t.setAttribute('class','cad-room-name');t.textContent=r.name;
        t.dataset.roomId=r.id;t.dataset.roomVisual=r.id;svg.append(t);

        const s=document.createElementNS(ns,'text');
        s.setAttribute('x',x+w/2);s.setAttribute('y',y+h/2+15);
        s.setAttribute('class','cad-room-size');s.textContent=`${r.w.toFixed(1)} × ${r.d.toFixed(1)} m`;
        s.dataset.roomId=r.id;s.dataset.roomVisual=r.id;svg.append(s);

        if(this.selected===r.id){
          const handles=[
            ['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]
          ];
          for(const [name,hx,hy] of handles){
            const handle=document.createElementNS(ns,'rect');
            handle.setAttribute('x',hx-7);handle.setAttribute('y',hy-7);
            handle.setAttribute('width',14);handle.setAttribute('height',14);
            handle.setAttribute('rx',3);handle.setAttribute('class','cad-resize-handle');
            handle.dataset.roomId=r.id;handle.dataset.roomVisual=r.id;handle.dataset.resizeHandle=name;
            svg.append(handle);
          }
        }
      }

      // Aperturas con símbolos arquitectónicos
      for(const o of this.model.openings){
        const r=this.room(o.roomId);if(!r)continue;
        const pt=this.openingPoint(r,o),x=P+pt.x*S,y=P+pt.z*S;
        const g=document.createElementNS(ns,'g');
        g.setAttribute('class','cad-symbol'+(this.selectedOpening===o.id?' is-selected':''));
        g.dataset.openingId=o.id;
        g.dataset.ownerRoom=o.roomId;

        if(o.type==='door'){
          const l=document.createElementNS(ns,'line');l.setAttribute('x1',x-25);l.setAttribute('x2',x+25);l.setAttribute('y1',y);l.setAttribute('y2',y);l.setAttribute('class','cad-door-line');g.append(l);
          const a=document.createElementNS(ns,'path');a.setAttribute('d',`M ${x-25} ${y} A 50 50 0 0 1 ${x+18} ${y-42}`);a.setAttribute('class','cad-door-arc');g.append(a);
        }else if(o.type==='window'){
          const rr=document.createElementNS(ns,'rect');rr.setAttribute('x',x-28);rr.setAttribute('y',y-7);rr.setAttribute('width',56);rr.setAttribute('height',14);rr.setAttribute('class','cad-window-shape');g.append(rr);
          const l=document.createElementNS(ns,'line');l.setAttribute('x1',x);l.setAttribute('x2',x);l.setAttribute('y1',y-7);l.setAttribute('y2',y+7);l.setAttribute('class','cad-window-mid');g.append(l);
        }else if(o.type==='passage'){
          const len=Math.max(44,(o.width||1.5)*S);
          const l=document.createElementNS(ns,'line');
          if(o.wall==='north'||o.wall==='south'){
            l.setAttribute('x1',x-len/2);l.setAttribute('x2',x+len/2);
            l.setAttribute('y1',y);l.setAttribute('y2',y);
          }else{
            l.setAttribute('x1',x);l.setAttribute('x2',x);
            l.setAttribute('y1',y-len/2);l.setAttribute('y2',y+len/2);
          }
          l.setAttribute('class','cad-passage-line');g.append(l);

          const tag=document.createElementNS(ns,'text');
          tag.setAttribute('x',x+8);tag.setAttribute('y',y-10);
          tag.setAttribute('class','cad-passage-label');tag.textContent='ABIERTO';g.append(tag);
        }else{
          const b=document.createElementNS(ns,'rect');b.setAttribute('x',x-16);b.setAttribute('y',y-10);b.setAttribute('width',32);b.setAttribute('height',20);b.setAttribute('rx',5);b.setAttribute('class','cad-camera-body');g.append(b);
          const lens=document.createElementNS(ns,'circle');lens.setAttribute('cx',x);lens.setAttribute('cy',y);lens.setAttribute('r',5);lens.setAttribute('class','cad-camera-lens');g.append(lens);
        }
        svg.append(g);
      }

      this.renderProperties();
      this.renderDeviceList();
      this.renderHomePreview();
      CS.CADDragEngine?.afterRender?.();
    },

    openingPoint(r,o){
      const q=Math.min(.95,Math.max(.05,Number(o.offset??.5)));
      if(o.wall==='north')return{x:r.x+r.w*q,z:r.z};
      if(o.wall==='south')return{x:r.x+r.w*q,z:r.z+r.d};
      if(o.wall==='west')return{x:r.x,z:r.z+r.d*q};
      return{x:r.x+r.w,z:r.z+r.d*q};
    },


    renderHomePreview(){
      const svg=document.querySelector('#home-cad-preview');
      if(!svg||!this.model?.rooms?.length)return;

      const S=72,P=62;
      const maxX=Math.max(12,this.model.width||12,...this.model.rooms.map(r=>r.x+r.w));
      const maxZ=Math.max(8,this.model.depth||8,...this.model.rooms.map(r=>r.z+r.d));
      const W=Math.max(1020,maxX*S+P*2),H=Math.max(680,maxZ*S+P*2);
      svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
      svg.innerHTML='';
      const ns='http://www.w3.org/2000/svg';

      const el=(tag,attrs={})=>{
        const n=document.createElementNS(ns,tag);
        Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,String(v)));
        return n;
      };

      const typeClass=t=>{
        t=String(t||'').toLowerCase();
        if(t.includes('sala'))return'sala';
        if(t.includes('cocina'))return'cocina';
        if(t.includes('recámara')||t.includes('recamara'))return'recamara';
        if(t.includes('baño')||t.includes('bano'))return'bano';
        return'other';
      };

      // Piso y mobiliario
      for(const r of this.model.rooms){
        const x=P+r.x*S,y=P+r.z*S,w=r.w*S,h=r.d*S;
        svg.append(el('rect',{x,y,width:w,height:h,rx:2,class:`home-cad-floor ${typeClass(r.type)}`}));

        // mobiliario sencillo para leer el plano como vivienda real
        const cx=x+w/2,cy=y+h/2;
        if(typeClass(r.type)==='recamara'){
          const bw=Math.min(w*.55,145),bh=Math.min(h*.53,125);
          svg.append(el('rect',{x:cx-bw/2,y:cy-bh/2,width:bw,height:bh,rx:5,class:'home-cad-bed'}));
          svg.append(el('rect',{x:cx-bw*.37,y:cy-bh*.40,width:bw*.74,height:20,rx:4,class:'home-cad-furniture-light'}));
        }else if(typeClass(r.type)==='sala'){
          svg.append(el('rect',{x:x+w*.12,y:y+h*.52,width:Math.min(w*.45,175),height:55,rx:8,class:'home-cad-furniture'}));
          svg.append(el('rect',{x:x+w*.58,y:y+h*.56,width:75,height:45,rx:5,class:'home-cad-furniture-light'}));
        }else if(typeClass(r.type)==='cocina'){
          svg.append(el('rect',{x:x+18,y:y+18,width:Math.max(45,w-36),height:34,rx:3,class:'home-cad-counter'}));
          svg.append(el('rect',{x:x+w-52,y:y+18,width:34,height:Math.max(45,h-36),rx:3,class:'home-cad-counter'}));
          svg.append(el('rect',{x:cx-55,y:y+h*.58,width:110,height:48,rx:4,class:'home-cad-furniture-light'}));
        }else if(typeClass(r.type)==='bano'){
          svg.append(el('rect',{x:x+18,y:y+18,width:62,height:72,rx:4,class:'home-cad-water'}));
          svg.append(el('ellipse',{cx:x+w-40,cy:y+45,rx:20,ry:28,class:'home-cad-furniture-light'}));
        }

        const name=el('text',{x:cx,y:cy-4,class:'home-cad-room-name'});name.textContent=r.name;svg.append(name);
        const size=el('text',{x:cx,y:cy+15,class:'home-cad-room-size'});size.textContent=`${r.w.toFixed(1)} × ${r.d.toFixed(1)} m`;svg.append(size);
      }

      // Paredes físicas únicas. Una pared compartida por dos cuartos se dibuja UNA sola vez.
      // Esto evita que la pared del cuarto vecino tape la puerta interior.
      const physicalWalls=CS.CADWallEngine?.build(this.model)||[];
      for(const wall of physicalWalls){
        const horizontal=wall.axis==='x';
        const len=(wall.b-wall.a)*S;
        const base=wall.a*S;
        const fixed=P+wall.coord*S;

        const gaps=(wall.openings||[]).map(o=>{
          const center=(o.physicalCenter-wall.a)*S;
          const width=Math.max(28,(o.width||(o.type==='door'?.9:1.2))*S);
          return{a:Math.max(0,center-width/2),b:Math.min(len,center+width/2)};
        }).sort((a,b)=>a.a-b.a);

        let cur=0;
        for(const q of gaps){
          if(q.a>cur){
            if(horizontal)svg.append(el('line',{x1:P+base+cur,y1:fixed,x2:P+base+q.a,y2:fixed,class:'home-cad-wall'}));
            else svg.append(el('line',{x1:fixed,y1:P+base+cur,x2:fixed,y2:P+base+q.a,class:'home-cad-wall'}));
          }
          cur=Math.max(cur,q.b);
        }
        if(cur<len){
          if(horizontal)svg.append(el('line',{x1:P+base+cur,y1:fixed,x2:P+base+len,y2:fixed,class:'home-cad-wall'}));
          else svg.append(el('line',{x1:fixed,y1:P+base+cur,x2:fixed,y2:P+base+len,class:'home-cad-wall'}));
        }
      }

      // Accesos y cámaras
      for(const o of this.model.openings){
        const r=this.room(o.roomId);if(!r)continue;
        const pt=this.openingPoint(r,o),x=P+pt.x*S,y=P+pt.z*S;
        const state=CS.state.devices?.find(d=>d.id===o.id);
        const isOpen=state?.state==='open';
        const alarm=!!CS.state.alarm&&isOpen;
        const horizontal=(o.wall==='north'||o.wall==='south');

        if(o.type==='door'){
          const g=el('g',{class:`home-cad-door${isOpen?' is-open':''}${alarm?' is-alarm':''}`,tabindex:0});
          const len=Math.max(46,(o.width||.9)*S);
          // marco visible en el hueco
          if(horizontal){
            g.append(el('line',{x1:x-len/2,y1:y,x2:x+len/2,y2:y,class:'home-cad-door-frame'}));
            g.append(el('line',{x1:x-len/2,y1:y,x2:x-len/2+len*.88,y2:y-len*.62,class:'home-cad-door-leaf'}));
            g.append(el('path',{d:`M ${x-len/2} ${y} A ${len} ${len} 0 0 1 ${x+len*.33} ${y-len*.75}`,class:'home-cad-door-arc'}));
            g.append(el('circle',{cx:x+len*.27,cy:y-len*.19,r:5,class:'home-cad-door-status'}));
          }else{
            g.append(el('line',{x1:x,y1:y-len/2,x2:x,y2:y+len/2,class:'home-cad-door-frame'}));
            g.append(el('line',{x1:x,y1:y-len/2,x2:x-len*.62,y2:y-len/2+len*.88,class:'home-cad-door-leaf'}));
            g.append(el('path',{d:`M ${x} ${y-len/2} A ${len} ${len} 0 0 0 ${x-len*.75} ${y+len*.33}`,class:'home-cad-door-arc'}));
            g.append(el('circle',{cx:x-len*.19,cy:y+len*.27,r:5,class:'home-cad-door-status'}));
          }
          g.addEventListener('click',()=>CS.toggleAccessDevice?.(o.id));
          svg.append(g);
        }else if(o.type==='window'){
          const g=el('g',{class:`home-cad-window${isOpen?' is-open':''}${alarm?' is-alarm':''}`,tabindex:0});
          const len=Math.max(54,(o.width||1.2)*S);
          if(horizontal){
            g.append(el('rect',{x:x-len/2,y:y-9,width:len,height:18,rx:2,class:'home-cad-window-frame'}));
            g.append(el('rect',{x:x-len/2+5,y:y-5,width:len-10,height:10,rx:1,class:'home-cad-window-glass'}));
            g.append(el('line',{x1:x,y1:y-7,x2:x,y2:y+7,class:'home-cad-window-mid'}));
            g.append(el('circle',{cx:x+len/2+9,cy:y,r:5,class:'home-cad-window-status'}));
          }else{
            g.append(el('rect',{x:x-9,y:y-len/2,width:18,height:len,rx:2,class:'home-cad-window-frame'}));
            g.append(el('rect',{x:x-5,y:y-len/2+5,width:10,height:len-10,rx:1,class:'home-cad-window-glass'}));
            g.append(el('line',{x1:x-7,y1:y,x2:x+7,y2:y,class:'home-cad-window-mid'}));
            g.append(el('circle',{cx:x,cy:y+len/2+9,r:5,class:'home-cad-window-status'}));
          }
          g.addEventListener('click',()=>CS.toggleAccessDevice?.(o.id));
          svg.append(g);
        }else if(o.type==='passage'){
          const len=Math.max(56,(o.width||1.5)*S);
          const g=el('g',{class:'home-cad-passage'});
          if(horizontal){
            g.append(el('line',{x1:x-len/2,y1:y,x2:x+len/2,y2:y,class:'home-cad-passage-threshold'}));
          }else{
            g.append(el('line',{x1:x,y1:y-len/2,x2:x,y2:y+len/2,class:'home-cad-passage-threshold'}));
          }
          svg.append(g);
        }else if(o.type==='camera'){
          const active=state?.state==='online';
          const g=el('g',{class:`home-cad-camera${active?' is-active':''}`,tabindex:0});
          if(horizontal){
            g.append(el('line',{x1:x,y1:y,x2:x,y2:y-22,class:'home-cad-camera-arm'}));
            g.append(el('rect',{x:x-17,y:y-39,width:34,height:21,rx:5,class:'home-cad-camera-body'}));
            g.append(el('circle',{cx:x,cy:y-28,r:6,class:'home-cad-camera-lens'}));
          }else{
            g.append(el('line',{x1:x,y1:y,x2:x-22,y2:y,class:'home-cad-camera-arm'}));
            g.append(el('rect',{x:x-39,y:y-17,width:21,height:34,rx:5,class:'home-cad-camera-body'}));
            g.append(el('circle',{cx:x-28,cy:y,r:6,class:'home-cad-camera-lens'}));
          }
          g.addEventListener('click',()=>CS.navigate?.('cameras'));
          svg.append(g);
        }
      }
    },

    renderProperties(){
      const box=document.querySelector('#cad-editor-properties');
      if(!box)return;
      const opening=this.model.openings.find(o=>o.id===this.selectedOpening);
      if(opening){
        CS.CADOpeningEditor?.render(box,opening);
        return;
      }
      const r=this.room(this.selected);
      if(!r){box.innerHTML='<p class="muted compact">Selecciona una habitación, puerta, ventana o cámara.</p>';return;}
      box.innerHTML=`
        <label>Nombre</label><input id="cad-name" value="${CS.escapeHtml?.(r.name)||r.name}">
        <label>Tipo</label>
        <select id="cad-type">${['Sala','Recámara','Cocina','Baño','Pasillo','Patio','Garaje','Servicio','Otro'].map(x=>`<option ${x===r.type?'selected':''}>${x}</option>`).join('')}</select>
        <div class="cad-prop-grid">
          <div><label>X (m)</label><input id="cad-x" type="number" step=".1" value="${r.x}"></div>
          <div><label>Z (m)</label><input id="cad-z" type="number" step=".1" value="${r.z}"></div>
          <div><label>Ancho (m)</label><input id="cad-w" type="number" min="1" step=".1" value="${r.w}"></div>
          <div><label>Fondo (m)</label><input id="cad-d" type="number" min="1" step=".1" value="${r.d}"></div>
        </div>
        <button id="cad-update-room" class="btn btn--primary btn--block" type="button">Aplicar cambios</button>
        <button id="cad-delete-room" class="btn btn--secondary btn--block" type="button">Eliminar habitación</button>
        <div class="cad-toolbar">
          <button id="cad-add-door" class="btn btn--secondary" type="button">+ Puerta</button>
          <button id="cad-add-window" class="btn btn--secondary" type="button">+ Ventana</button>
          <button id="cad-add-camera" class="btn btn--secondary" type="button">+ Cámara</button>
          ${r.type==='Pasillo'?'<button id="cad-add-passage" class="btn btn--passage" type="button">+ Apertura libre</button>':''}
        </div>
        ${r.type==='Pasillo'?'<div class="cad-info cad-info--passage">Como esta habitación es Pasillo, puedes eliminar tramos de muro sin colocar una puerta.</div>':''}`;

      document.querySelector('#cad-update-room').onclick=()=>{
        r.name=document.querySelector('#cad-name').value.trim()||r.name;
        r.type=document.querySelector('#cad-type').value;
        r.x=Number(document.querySelector('#cad-x').value)||0;
        r.z=Number(document.querySelector('#cad-z').value)||0;
        r.w=Math.max(1,Number(document.querySelector('#cad-w').value)||r.w);
        r.d=Math.max(1,Number(document.querySelector('#cad-d').value)||r.d);
        this.model.width=Math.max(12,...this.model.rooms.map(x=>x.x+x.w));
        this.model.depth=Math.max(8,...this.model.rooms.map(x=>x.z+x.d));
        CS.CADStore.save(this.model);CS.syncCADRuntime?.();this.render();CS.Architectural3D?.rebuild?.();
      };
      document.querySelector('#cad-delete-room').onclick=()=>this.removeSelected();
      document.querySelector('#cad-add-door').onclick=()=>this.addOpening('door');
      document.querySelector('#cad-add-window').onclick=()=>this.addOpening('window');
      document.querySelector('#cad-add-camera').onclick=()=>this.addOpening('camera');
      document.querySelector('#cad-add-passage')?.addEventListener('click',()=>this.addOpening('passage'));
    },

    renderDeviceList(){
      const box=document.querySelector('#cad-device-list');
      if(!box)return;
      box.innerHTML='';
      for(const o of this.model.openings){
        const r=this.room(o.roomId);
        const row=document.createElement('div');row.className='cad-device-row'+(this.selectedOpening===o.id?' is-selected':'');
        const label=o.type==='door'?'Puerta':o.type==='window'?'Ventana':o.type==='passage'?'Apertura libre':'Cámara';
        row.innerHTML=`<div data-opening-select="${o.id}"><strong>${label}</strong><small>${r?.name||'Sin habitación'} · muro ${o.wall} · ${Math.round((o.offset??.5)*100)}%</small></div><button class="mini-btn" type="button">×</button>`;
        row.querySelector('[data-opening-select]')?.addEventListener('click',()=>{
          this.selectedOpening=o.id;this.selected=null;this.render();
        });
        row.querySelector('button').onclick=()=>{
          this.model.openings=this.model.openings.filter(x=>x.id!==o.id);
          CS.CADStore.save(this.model);CS.syncCADRuntime?.();this.render();CS.Architectural3D?.rebuild?.();
        };
        box.append(row);
      }
    }
  };

  CS.CAD=CAD;
  CS.initCADEditor=()=>CAD.init();
})();
