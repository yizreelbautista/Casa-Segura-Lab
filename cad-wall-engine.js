(function(){
  'use strict';
  const CS=window.CasaSegura;
  const EPS=.015;

  function key(v){ return Math.round(v*1000)/1000; }

  function openingPose(model,o){
    const r=model.rooms.find(x=>x.id===o.roomId);
    if(!r)return null;
    const q=Math.min(.97,Math.max(.03,Number(o.offset??.5)));
    if(o.wall==='north')return{axis:'x',coord:r.z,center:r.x+r.w*q,x:r.x+r.w*q,z:r.z};
    if(o.wall==='south')return{axis:'x',coord:r.z+r.d,center:r.x+r.w*q,x:r.x+r.w*q,z:r.z+r.d};
    if(o.wall==='west')return{axis:'z',coord:r.x,center:r.z+r.d*q,x:r.x,z:r.z+r.d*q};
    return{axis:'z',coord:r.x+r.w,center:r.z+r.d*q,x:r.x+r.w,z:r.z+r.d*q};
  }

  function addGroup(map,axis,coord,a,b,owner){
    if(b-a<=EPS)return;
    const k=`${axis}:${key(coord)}`;
    if(!map.has(k))map.set(k,{axis,coord:key(coord),segments:[]});
    map.get(k).segments.push({a:Math.min(a,b),b:Math.max(a,b),owner});
  }

  function mergedIntervals(segments){
    const sorted=[...segments].sort((a,b)=>a.a-b.a);
    const out=[];
    for(const s of sorted){
      const last=out[out.length-1];
      if(!last||s.a>last.b+EPS){
        out.push({a:s.a,b:s.b});
      }else{
        last.b=Math.max(last.b,s.b);
      }
    }
    return out;
  }

  const Engine={
    openingPose,

    build(model){
      const groups=new Map();

      for(const r of model.rooms||[]){
        addGroup(groups,'x',r.z,r.x,r.x+r.w,{roomId:r.id,wall:'north'});
        addGroup(groups,'x',r.z+r.d,r.x,r.x+r.w,{roomId:r.id,wall:'south'});
        addGroup(groups,'z',r.x,r.z,r.z+r.d,{roomId:r.id,wall:'west'});
        addGroup(groups,'z',r.x+r.w,r.z,r.z+r.d,{roomId:r.id,wall:'east'});
      }

      const walls=[];
      for(const g of groups.values()){
        for(const interval of mergedIntervals(g.segments)){
          const openings=(model.openings||[])
            .filter(o=>['door','window','passage'].includes(o.type))
            .map(o=>({o,p:openingPose(model,o)}))
            .filter(({p})=>p
              &&p.axis===g.axis
              &&Math.abs(p.coord-g.coord)<=.025
              &&p.center>=interval.a-EPS
              &&p.center<=interval.b+EPS)
            .map(({o,p})=>({...o,physicalCenter:p.center}));

          walls.push({
            axis:g.axis,
            coord:g.coord,
            a:interval.a,
            b:interval.b,
            openings
          });
        }
      }
      return walls;
    }
  };

  CS.CADWallEngine=Engine;
})();
