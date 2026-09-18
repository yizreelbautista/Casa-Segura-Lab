(function(){
  'use strict';
  const CS=window.CasaSegura;

  const OpeningEditor={
    render(box,o){
      const CAD=CS.CAD;
      const rooms=CAD.model.rooms||[];
      const typeLabel=o.type==='door'?'Puerta':o.type==='window'?'Ventana':o.type==='passage'?'Apertura libre':'Cámara';

      box.innerHTML=`
        <div class="cad-selection-title">
          <span class="cad-selection-chip">${typeLabel}</span>
          <strong>${CS.escapeHtml?.(CS.state.devices?.find(d=>d.id===o.id)?.name||o.id)||o.id}</strong>
        </div>

        <label>Habitación / estructura</label>
        <select id="cad-opening-room">
          ${rooms.map(r=>`<option value="${r.id}" ${r.id===o.roomId?'selected':''}>${CS.escapeHtml?.(r.name)||r.name}</option>`).join('')}
        </select>

        <label>Pared</label>
        <select id="cad-opening-wall">
          ${['north','south','west','east'].map(w=>`<option value="${w}" ${w===o.wall?'selected':''}>${{north:'Norte',south:'Sur',west:'Oeste',east:'Este'}[w]}</option>`).join('')}
        </select>

        <label>Posición sobre pared</label>
        <input id="cad-opening-offset" type="range" min="3" max="97" step="1" value="${Math.round((o.offset??.5)*100)}">
        <small class="cad-range-value" id="cad-opening-offset-value">${Math.round((o.offset??.5)*100)}%</small>

        <div class="cad-prop-grid">
          <div><label>Ancho (m)</label><input id="cad-opening-width" type="number" min=".25" step=".05" value="${o.width||.9}"></div>
          ${o.type==='window'?`<div><label>Antepecho (m)</label><input id="cad-opening-sill" type="number" min=".2" step=".05" value="${o.sill??.9}"></div>`:''}
          ${o.type==='window'?`<div><label>Alto (m)</label><input id="cad-opening-height" type="number" min=".3" step=".05" value="${o.height||1.2}"></div>`:''}
          ${o.type==='camera'?`<div><label>Altura (m)</label><input id="cad-opening-sill" type="number" min="1" step=".05" value="${o.sill||2.25}"></div>`:''}
        </div>

        ${o.type==='passage'?`
          <div class="cad-info cad-info--passage">
            Esta apertura elimina completamente ese tramo de muro. No genera puerta ni sensor.
          </div>
        `:`
          <div class="cad-info cad-info--accent">
            También puedes arrastrar este elemento directamente por el plano. Al acercarlo a otra pared, se adhiere automáticamente.
          </div>
        `}

        <button id="cad-opening-apply" class="btn btn--primary btn--block" type="button">Aplicar propiedades</button>
        <button id="cad-opening-delete" class="btn btn--secondary btn--block" type="button">Eliminar ${typeLabel.toLowerCase()}</button>
      `;

      const range=box.querySelector('#cad-opening-offset');
      range?.addEventListener('input',()=>box.querySelector('#cad-opening-offset-value').textContent=`${range.value}%`);

      box.querySelector('#cad-opening-apply').onclick=()=>{
        o.roomId=box.querySelector('#cad-opening-room').value;
        o.wall=box.querySelector('#cad-opening-wall').value;
        o.offset=Number(box.querySelector('#cad-opening-offset').value)/100;
        o.width=Math.max(.25,Number(box.querySelector('#cad-opening-width').value)||o.width||.9);
        const sill=box.querySelector('#cad-opening-sill');
        const height=box.querySelector('#cad-opening-height');
        if(sill)o.sill=Math.max(.1,Number(sill.value)||o.sill||.9);
        if(height)o.height=Math.max(.3,Number(height.value)||o.height||1.2);
        CS.CADStore.save(CAD.model);CS.syncCADRuntime?.();
        CAD.render();
        CS.Architectural3D?.rebuild?.();
      };

      box.querySelector('#cad-opening-delete').onclick=()=>{
        CAD.model.openings=CAD.model.openings.filter(x=>x.id!==o.id);
        CAD.selectedOpening=null;
        CS.CADStore.save(CAD.model);CS.syncCADRuntime?.();
        CAD.render();
        CS.Architectural3D?.rebuild?.();
      };
    }
  };

  CS.CADOpeningEditor=OpeningEditor;
})();
