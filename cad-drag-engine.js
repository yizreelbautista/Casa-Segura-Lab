(function(){
  'use strict';
  const CS=window.CasaSegura;

  const Drag={
    drag:null,
    rebuildTimer:null,

    init(){
      const svg=document.querySelector('#cad-editor-svg');
      if(!svg||svg.dataset.dragReady==='1')return;
      svg.dataset.dragReady='1';

      svg.addEventListener('pointerdown',e=>this.onDown(e,svg));
      svg.addEventListener('pointermove',e=>this.onMove(e,svg));
      svg.addEventListener('pointerup',e=>this.onUp(e,svg));
      svg.addEventListener('pointercancel',e=>this.onUp(e,svg));

      document.querySelector('#cad-snap-toggle')?.addEventListener('click',()=>{
        CS.CADSnap.enabled=!CS.CADSnap.enabled;
        this.updateToolbar();
      });
      this.updateToolbar();
    },

    afterRender(){
      this.init();
      this.updateToolbar();
      const status=document.querySelector('#cad-structure-status');
      if(status){
        const analysis=CS.CADStructure?.analyze(CS.CAD.model);
        const n=analysis?.count||0;
        status.textContent=n===1?'1 estructura':`${n} estructuras`;
      }
    },

    updateToolbar(){
      const b=document.querySelector('#cad-snap-toggle');
      if(b){
        b.classList.toggle('is-active',!!CS.CADSnap.enabled);
        b.textContent=CS.CADSnap.enabled?'Snap: ON':'Snap: OFF';
      }
    },

    point(e,svg){
      const pt=svg.createSVGPoint();
      pt.x=e.clientX;pt.y=e.clientY;
      const ctm=svg.getScreenCTM();
      return ctm?pt.matrixTransform(ctm.inverse()):{x:e.offsetX,y:e.offsetY};
    },

    liveRebuild(){
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer=setTimeout(()=>{
        CS.CAD.renderHomePreview?.();
        CS.Architectural3D?.rebuild?.();
      },95);
    },

    setStatus(text){
      const s=document.querySelector('#cad-drag-status');
      if(s)s.textContent=text;
    },

    onDown(e,svg){
      if(e.button!==0)return;

      const opening=e.target.closest?.('[data-opening-id]');
      const resize=e.target.closest?.('[data-resize-handle]');
      const roomNode=e.target.closest?.('[data-room-id]');

      const p=this.point(e,svg);

      if(opening){
        const id=opening.dataset.openingId;
        const o=CS.CAD.model.openings.find(x=>x.id===id);
        if(!o)return;
        CS.CAD.selectedOpening=id;CS.CAD.selected=null;
        const r=CS.CAD.room(o.roomId);
        const op=CS.CAD.openingPoint(r,o);
        this.drag={kind:'opening',id,start:p,origin:{...o},originPoint:op,node:opening,preview:null};
        opening.classList.add('is-dragging');
        this.setStatus('Arrastra el elemento hacia cualquier pared.');
        try{svg.setPointerCapture(e.pointerId)}catch{}
        e.preventDefault();
        return;
      }

      if(resize){
        const id=resize.dataset.roomId,room=CS.CAD.room(id);
        if(!room)return;
        CS.CAD.selected=id;CS.CAD.selectedOpening=null;
        this.drag={kind:'resize',id,handle:resize.dataset.resizeHandle,start:p,origin:{...room}};
        this.setStatus('Redimensionando habitación.');
        try{svg.setPointerCapture(e.pointerId)}catch{}
        e.preventDefault();
        return;
      }

      if(roomNode){
        const id=roomNode.dataset.roomId,room=CS.CAD.room(id);
        if(!room)return;
        CS.CAD.selected=id;CS.CAD.selectedOpening=null;
        this.drag={kind:'room',id,start:p,origin:{...room}};
        svg.classList.add('is-room-dragging');
        this.setStatus('Moviendo habitación. Acércala a otra para adherirla.');
        try{svg.setPointerCapture(e.pointerId)}catch{}
        e.preventDefault();
      }
    },

    onMove(e,svg){
      if(!this.drag)return;
      const p=this.point(e,svg),S=CS.CAD.scale;
      const dx=(p.x-this.drag.start.x)/S,dz=(p.y-this.drag.start.y)/S;

      if(this.drag.kind==='room'){
        const room=CS.CAD.room(this.drag.id);
        const pos=CS.CADSnap.roomPosition(
          room,
          this.drag.origin.x+dx,
          this.drag.origin.z+dz,
          CS.CAD.model.rooms
        );
        room.x=pos.x;room.z=pos.z;
        const tx=(room.x-this.drag.origin.x)*S,ty=(room.z-this.drag.origin.z)*S;
        svg.querySelectorAll(`[data-room-visual="${CSS.escape(room.id)}"],[data-owner-room="${CSS.escape(room.id)}"]`)
          .forEach(n=>n.setAttribute('transform',`translate(${tx} ${ty})`));
        this.setStatus(`X ${room.x.toFixed(2)} m · Z ${room.z.toFixed(2)} m`);
        this.liveRebuild();
        return;
      }

      if(this.drag.kind==='resize'){
        const room=CS.CAD.room(this.drag.id),h=this.drag.handle,o=this.drag.origin;
        let x=o.x,z=o.z,w=o.w,d=o.d;

        if(h.includes('e'))w=o.w+dx;
        if(h.includes('s'))d=o.d+dz;
        if(h.includes('w')){x=o.x+dx;w=o.w-dx;}
        if(h.includes('n')){z=o.z+dz;d=o.d-dz;}

        const next=CS.CADSnap.roomSize(room,x,z,w,d,h,CS.CAD.model.rooms);
        Object.assign(room,next);

        // For resizing we redraw the editor. Pointer capture remains on the SVG.
        CS.CAD.render();
        this.setStatus(`${room.w.toFixed(2)} × ${room.d.toFixed(2)} m`);
        this.liveRebuild();
        return;
      }

      if(this.drag.kind==='opening'){
        const o=CS.CAD.model.openings.find(x=>x.id===this.drag.id);
        if(!o)return;

        const mx=(p.x-CS.CAD.pad)/S,mz=(p.y-CS.CAD.pad)/S;
        const hit=CS.CADSnap.nearestWall(CS.CAD.model.rooms,mx,mz,1.15);

        if(hit){
          o.roomId=hit.roomId;o.wall=hit.wall;o.offset=hit.offset;
          this.drag.preview=hit;
          const px=CS.CAD.pad+hit.x*S,py=CS.CAD.pad+hit.z*S;
          const ox=CS.CAD.pad+this.drag.originPoint.x*S,oy=CS.CAD.pad+this.drag.originPoint.z*S;
          this.drag.node.setAttribute('transform',`translate(${px-ox} ${py-oy})`);
          this.drag.node.classList.add('is-snapped');
          const room=CS.CAD.room(hit.roomId);
          this.setStatus(`${room?.name||'Habitación'} · pared ${hit.wall}`);
          this.liveRebuild();
        }else{
          const ox=CS.CAD.pad+this.drag.originPoint.x*S,oy=CS.CAD.pad+this.drag.originPoint.z*S;
          this.drag.node.setAttribute('transform',`translate(${p.x-ox} ${p.y-oy})`);
          this.drag.node.classList.remove('is-snapped');
          this.setStatus('Acerca el elemento a una pared para fijarlo.');
        }
      }
    },

    onUp(e,svg){
      if(!this.drag)return;

      if(this.drag.kind==='opening'&&!this.drag.preview){
        const o=CS.CAD.model.openings.find(x=>x.id===this.drag.id);
        if(o)Object.assign(o,this.drag.origin);
      }

      CS.CAD.model.width=Math.max(12,...CS.CAD.model.rooms.map(r=>r.x+r.w));
      CS.CAD.model.depth=Math.max(8,...CS.CAD.model.rooms.map(r=>r.z+r.d));
      CS.CADStore.save(CS.CAD.model);
      CS.syncCADRuntime?.();

      this.drag=null;
      svg.classList.remove('is-room-dragging');
      try{svg.releasePointerCapture(e.pointerId)}catch{}
      CS.CAD.render();
      CS.Architectural3D?.rebuild?.();
      this.setStatus('Edición libre activa.');
    }
  };

  CS.CADDragEngine=Drag;
})();
