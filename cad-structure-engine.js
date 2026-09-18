(function(){
  'use strict';
  const CS=window.CasaSegura;

  const Structure={
    tolerance:.12,

    touches(a,b,t=this.tolerance){
      const ax1=a.x,ax2=a.x+a.w,az1=a.z,az2=a.z+a.d;
      const bx1=b.x,bx2=b.x+b.w,bz1=b.z,bz2=b.z+b.d;
      const separatedX=ax2<bx1-t||bx2<ax1-t;
      const separatedZ=az2<bz1-t||bz2<az1-t;
      return !(separatedX||separatedZ);
    },

    unionArea(rooms){
      if(!rooms.length)return 0;
      const xs=[...new Set(rooms.flatMap(r=>[r.x,r.x+r.w]))].sort((a,b)=>a-b);
      let area=0;
      for(let i=0;i<xs.length-1;i++){
        const x0=xs[i],x1=xs[i+1],mid=(x0+x1)/2;
        const segs=rooms
          .filter(r=>mid>=r.x&&mid<=r.x+r.w)
          .map(r=>[r.z,r.z+r.d])
          .sort((a,b)=>a[0]-b[0]);
        if(!segs.length)continue;
        let start=segs[0][0],end=segs[0][1],zlen=0;
        for(let j=1;j<segs.length;j++){
          const [s,e]=segs[j];
          if(s<=end){end=Math.max(end,e)}
          else{zlen+=end-start;start=s;end=e}
        }
        zlen+=end-start;
        area+=(x1-x0)*zlen;
      }
      return area;
    },

    analyze(model){
      const rooms=model.rooms||[];
      const seen=new Set(),components=[];

      for(const room of rooms){
        if(seen.has(room.id))continue;
        const queue=[room],group=[];seen.add(room.id);
        while(queue.length){
          const cur=queue.shift();group.push(cur);
          for(const other of rooms){
            if(seen.has(other.id))continue;
            if(this.touches(cur,other)){seen.add(other.id);queue.push(other);}
          }
        }

        const minX=Math.min(...group.map(r=>r.x));
        const minZ=Math.min(...group.map(r=>r.z));
        const maxX=Math.max(...group.map(r=>r.x+r.w));
        const maxZ=Math.max(...group.map(r=>r.z+r.d));
        const bounds={x:minX,z:minZ,w:maxX-minX,d:maxZ-minZ};
        const unionArea=this.unionArea(group);
        const boundsArea=bounds.w*bounds.d||1;
        components.push({
          id:`structure-${components.length+1}`,
          rooms:group,
          roomIds:group.map(r=>r.id),
          bounds,
          unionArea,
          coverage:Math.min(1,unionArea/boundsArea)
        });
      }

      return{components,count:components.length};
    }
  };

  CS.CADStructure=Structure;
})();
