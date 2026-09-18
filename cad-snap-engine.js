(function(){
  'use strict';
  const CS=window.CasaSegura;

  const Snap={
    enabled:true,
    grid:.10,
    edgeThreshold:.16,

    round(v,step=this.grid){
      return Math.round(v/step)*step;
    },

    clamp(v,a,b){return Math.max(a,Math.min(b,v));},

    roomPosition(room,x,z,rooms){
      x=Math.max(0,x);z=Math.max(0,z);
      if(this.enabled){
        x=this.round(x);z=this.round(z);

        const candidatesX=[],candidatesZ=[];
        const left=x,right=x+room.w,top=z,bottom=z+room.d;

        for(const o of rooms){
          if(o.id===room.id)continue;
          const ol=o.x,or=o.x+o.w,ot=o.z,ob=o.z+o.d;
          for(const a of [ol,or]){
            candidatesX.push({delta:a-left,value:a});
            candidatesX.push({delta:a-right,value:a-room.w});
          }
          for(const a of [ot,ob]){
            candidatesZ.push({delta:a-top,value:a});
            candidatesZ.push({delta:a-bottom,value:a-room.d});
          }
        }

        const sx=candidatesX.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
        const sz=candidatesZ.sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
        if(sx&&Math.abs(sx.delta)<=this.edgeThreshold)x=Math.max(0,sx.value);
        if(sz&&Math.abs(sz.delta)<=this.edgeThreshold)z=Math.max(0,sz.value);
      }
      return{x,z};
    },

    roomSize(room,x,z,w,d,handle,rooms){
      const min=1;
      if(this.enabled){
        x=this.round(x);z=this.round(z);w=this.round(w);d=this.round(d);
      }
      w=Math.max(min,w);d=Math.max(min,d);
      x=Math.max(0,x);z=Math.max(0,z);

      // Snap the resized edge to nearby room edges.
      if(this.enabled){
        const right=x+w,bottom=z+d;
        for(const o of rooms){
          if(o.id===room.id)continue;
          for(const edge of [o.x,o.x+o.w]){
            if(handle.includes('e')&&Math.abs(right-edge)<=this.edgeThreshold)w=Math.max(min,edge-x);
            if(handle.includes('w')&&Math.abs(x-edge)<=this.edgeThreshold){
              const oldRight=x+w;x=edge;w=Math.max(min,oldRight-x);
            }
          }
          for(const edge of [o.z,o.z+o.d]){
            if(handle.includes('s')&&Math.abs(bottom-edge)<=this.edgeThreshold)d=Math.max(min,edge-z);
            if(handle.includes('n')&&Math.abs(z-edge)<=this.edgeThreshold){
              const oldBottom=z+d;z=edge;d=Math.max(min,oldBottom-z);
            }
          }
        }
      }
      return{x,z,w,d};
    },

    nearestWall(rooms,x,z,maxDistance=.80){
      let best=null;

      for(const r of rooms){
        const walls=[
          {wall:'north',dist:Math.abs(z-r.z),inside:x>=r.x-.2&&x<=r.x+r.w+.2,
           x:this.clamp(x,r.x,r.x+r.w),z:r.z,offset:this.clamp((x-r.x)/r.w,.03,.97)},
          {wall:'south',dist:Math.abs(z-(r.z+r.d)),inside:x>=r.x-.2&&x<=r.x+r.w+.2,
           x:this.clamp(x,r.x,r.x+r.w),z:r.z+r.d,offset:this.clamp((x-r.x)/r.w,.03,.97)},
          {wall:'west',dist:Math.abs(x-r.x),inside:z>=r.z-.2&&z<=r.z+r.d+.2,
           x:r.x,z:this.clamp(z,r.z,r.z+r.d),offset:this.clamp((z-r.z)/r.d,.03,.97)},
          {wall:'east',dist:Math.abs(x-(r.x+r.w)),inside:z>=r.z-.2&&z<=r.z+r.d+.2,
           x:r.x+r.w,z:this.clamp(z,r.z,r.z+r.d),offset:this.clamp((z-r.z)/r.d,.03,.97)}
        ];

        for(const w of walls){
          if(!w.inside)continue;
          if(!best||w.dist<best.dist)best={...w,roomId:r.id};
        }
      }

      if(best&&best.dist<=maxDistance)return best;
      return null;
    }
  };

  CS.CADSnap=Snap;
})();
