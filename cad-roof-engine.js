(function(){
  'use strict';
  const CS=window.CasaSegura;

  const Roof={
    plan(model){
      const analysis=CS.CADStructure?.analyze(model)||{components:[]};
      const roofs=[];

      for(const comp of analysis.components){
        if(comp.rooms.length===1||comp.coverage>=.90){
          roofs.push({
            id:`roof-${comp.id}`,type:'gable',
            ...comp.bounds,componentId:comp.id,roomIds:[...comp.roomIds]
          });
          continue;
        }

        // Irregular / L-shaped / staggered structure:
        // largest room is the main gable; attached rooms receive their own
        // shed roof. This preserves the real footprint instead of covering
        // empty voids in the component bounding box.
        const ordered=[...comp.rooms].sort((a,b)=>(b.w*b.d)-(a.w*a.d));
        const main=ordered[0];
        roofs.push({
          id:`roof-${comp.id}-main`,type:'gable',
          x:main.x,z:main.z,w:main.w,d:main.d,
          componentId:comp.id,roomIds:[main.id]
        });

        for(const r of ordered.slice(1)){
          const mcx=main.x+main.w/2,mcz=main.z+main.d/2;
          const rcx=r.x+r.w/2,rcz=r.z+r.d/2;
          const dx=rcx-mcx,dz=rcz-mcz;
          let slope;
          if(Math.abs(dx)>Math.abs(dz))slope=dx>0?'east':'west';
          else slope=dz>0?'south':'north';

          roofs.push({
            id:`roof-${comp.id}-${r.id}`,type:'shed',
            x:r.x,z:r.z,w:r.w,d:r.d,slope,
            componentId:comp.id,roomIds:[r.id]
          });
        }
      }

      return{roofs,structures:analysis.components};
    }
  };

  CS.CADRoofEngine=Roof;
})();
