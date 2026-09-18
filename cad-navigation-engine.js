(function(){
  'use strict';
  const CS=window.CasaSegura;
  const TOL=.16;

  function roomCenter(r){ return [r.x+r.w/2,0,r.z+r.d/2]; }

  function doorPose(model,o){
    return CS.CADWallEngine?.openingPose(model,o)||null;
  }

  function oppositeWall(w){
    return w==='north'?'south':w==='south'?'north':w==='west'?'east':'west';
  }

  function pointOnWall(r,wall,p){
    if(wall==='north')return Math.abs(r.z-p.z)<=TOL && p.x>=r.x-TOL && p.x<=r.x+r.w+TOL;
    if(wall==='south')return Math.abs((r.z+r.d)-p.z)<=TOL && p.x>=r.x-TOL && p.x<=r.x+r.w+TOL;
    if(wall==='west')return Math.abs(r.x-p.x)<=TOL && p.z>=r.z-TOL && p.z<=r.z+r.d+TOL;
    return Math.abs((r.x+r.w)-p.x)<=TOL && p.z>=r.z-TOL && p.z<=r.z+r.d+TOL;
  }

  function adjacentRoom(model,o,p){
    const expected=oppositeWall(o.wall);
    const candidates=(model.rooms||[]).filter(r=>r.id!==o.roomId && pointOnWall(r,expected,p));
    if(!candidates.length)return null;
    return candidates.sort((a,b)=>{
      const ac=roomCenter(a),bc=roomCenter(b);
      return Math.hypot(ac[0]-p.x,ac[2]-p.z)-Math.hypot(bc[0]-p.x,bc[2]-p.z);
    })[0];
  }

  function outsidePoint(owner,o,p,margin=.48){
    if(o.wall==='north')return[p.x,0,p.z-margin];
    if(o.wall==='south')return[p.x,0,p.z+margin];
    if(o.wall==='west')return[p.x-margin,0,p.z];
    return[p.x+margin,0,p.z];
  }

  function insidePoint(r,p,margin=.42){
    const c=roomCenter(r);
    const dx=c[0]-p.x,dz=c[2]-p.z,len=Math.hypot(dx,dz)||1;
    return[p.x+dx/len*margin,0,p.z+dz/len*margin];
  }

  const Navigation={
    buildGraph(model){
      const graph=new Map();
      const add=(a,edge)=>{
        if(!graph.has(a))graph.set(a,[]);
        graph.get(a).push(edge);
      };

      for(const r of model.rooms||[])graph.set(r.id,[]);
      graph.set('exterior',[]);

      for(const o of (model.openings||[]).filter(x=>['door','passage'].includes(x.type))){
        const owner=model.rooms.find(r=>r.id===o.roomId);
        const p=doorPose(model,o);
        if(!owner||!p)continue;

        const other=adjacentRoom(model,o,p);
        const b=other?.id||'exterior';
        const point=[p.x,0,p.z];

        const requiresDoor=o.type==='door';
        add(owner.id,{from:owner.id,to:b,doorId:requiresDoor?o.id:null,opening:o,point,requiresDoor});
        add(b,{from:b,to:owner.id,doorId:requiresDoor?o.id:null,opening:o,point,requiresDoor});
      }

      return graph;
    },

    findEdges(model,from,to){
      if(from===to)return[];
      const graph=this.buildGraph(model);
      const q=[from],prev=new Map([[from,null]]);
      while(q.length){
        const node=q.shift();
        for(const edge of graph.get(node)||[]){
          if(prev.has(edge.to))continue;
          prev.set(edge.to,{node,edge});
          if(edge.to===to){
            const route=[];
            let cur=to;
            while(cur!==from){
              const p=prev.get(cur);
              route.push(p.edge);
              cur=p.node;
            }
            return route.reverse();
          }
          q.push(edge.to);
        }
      }
      return null;
    },

    approachPoint(model,node,edge){
      const owner=model.rooms.find(r=>r.id===edge.opening.roomId);
      const p={x:edge.point[0],z:edge.point[2]};
      if(node==='exterior')return outsidePoint(owner,edge.opening,p);
      const r=model.rooms.find(x=>x.id===node);
      return r?insidePoint(r,p):edge.point;
    },

    buildWaypoints(model,from,to,startPoint){
      const edges=this.findEdges(model,from,to);
      if(edges===null)return null;

      const steps=[];
      let cursor=[...startPoint];

      const pushMove=(point,extra={})=>{
        if(Math.hypot(point[0]-cursor[0],point[2]-cursor[2])>.025){
          steps.push({point:[...point],...extra});
          cursor=[...point];
        }else if(Object.keys(extra).length){
          steps.push({point:[...point],...extra});
        }
      };

      for(const edge of edges){
        const fromApproach=this.approachPoint(model,edge.from,edge);
        const toApproach=this.approachPoint(model,edge.to,edge);
        pushMove(fromApproach);
        if(edge.requiresDoor){
          pushMove(edge.point,{openDoorId:edge.doorId});
          pushMove(toApproach,{closeDoorId:edge.doorId});
        }else{
          // Apertura libre: se cruza directamente, sin animación de puerta.
          pushMove(edge.point,{passageId:edge.opening.id});
          pushMove(toApproach);
        }
      }

      if(to!=='exterior'){
        const r=model.rooms.find(x=>x.id===to);
        if(r)pushMove(roomCenter(r));
      }

      return{edges,steps};
    }
  };

  CS.CADNavigation=Navigation;
})();
