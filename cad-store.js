(function(){
  'use strict';
  const CS=window.CasaSegura;
  const KEY=()=>CS.ProfileManager?.cadKey?.()||'CasaSegura_CAD_Model_v4';

  CS.CADStore={
    emptyModel(){
      return{version:4,width:12,depth:8,wallHeight:2.8,rooms:[],openings:[]};
    },
    defaultModel(){
      return{
        version:4,width:12,depth:8,wallHeight:2.8,
        rooms:[
          {id:'room-bed1',name:'Recámara 1',type:'Recámara',x:0,z:0,w:4,d:4},
          {id:'room-bath',name:'Baño',type:'Baño',x:4,z:0,w:2,d:4},
          {id:'room-bed2',name:'Recámara 2',type:'Recámara',x:6,z:0,w:6,d:4},
          {id:'room-sala',name:'Sala / Entrada',type:'Sala',x:0,z:4,w:6,d:4},
          {id:'room-kitchen',name:'Cocina',type:'Cocina',x:6,z:4,w:6,d:4}
        ],
        openings:[
          {id:'door-main',type:'door',roomId:'room-sala',wall:'south',offset:.50,width:1.0},
          {id:'door-kitchen',type:'door',roomId:'room-kitchen',wall:'west',offset:.50,width:.9},
          {id:'door-bedroom1',type:'door',roomId:'room-bed1',wall:'south',offset:.55,width:.9},
          {id:'door-bedroom2',type:'door',roomId:'room-bed2',wall:'south',offset:.45,width:.9},
          {id:'door-bathroom',type:'door',roomId:'room-bath',wall:'south',offset:.50,width:.8},

          {id:'window-living',type:'window',roomId:'room-sala',wall:'south',offset:.18,width:1.2,height:1.2,sill:.9},
          {id:'window-living-side',type:'window',roomId:'room-sala',wall:'south',offset:.82,width:1.2,height:1.2,sill:.9},

          {id:'window-kitchen-front',type:'window',roomId:'room-kitchen',wall:'south',offset:.28,width:1.2,height:1.2,sill:.9},
          {id:'window-kitchen-side',type:'window',roomId:'room-kitchen',wall:'south',offset:.75,width:1.2,height:1.2,sill:.9},

          {id:'window-bedroom',type:'window',roomId:'room-bed1',wall:'north',offset:.30,width:1.2,height:1.2,sill:.9},
          {id:'window-bedroom1-extra',type:'window',roomId:'room-bed1',wall:'north',offset:.72,width:1.2,height:1.2,sill:.9},

          {id:'window-bedroom2',type:'window',roomId:'room-bed2',wall:'north',offset:.30,width:1.2,height:1.2,sill:.9},
          {id:'window-bedroom2-extra',type:'window',roomId:'room-bed2',wall:'north',offset:.72,width:1.2,height:1.2,sill:.9},

          {id:'window-bathroom',type:'window',roomId:'room-bath',wall:'north',offset:.50,width:.8,height:.6,sill:1.35},

          {id:'camera-entry',type:'camera',roomId:'room-sala',wall:'south',offset:.66,width:.35,height:.22,sill:2.25}
        ]
      };
    },
    load(){
      try{
        const raw=localStorage.getItem(KEY());
        const data=raw?JSON.parse(raw):null;
        if(data?.rooms?.length)return data;
      }catch(e){console.warn('CAD load',e);}
      if(CS.ProfileManager?.activeProfile==='main')return this.emptyModel();
      return this.defaultModel();
    },
    save(model){localStorage.setItem(KEY(),JSON.stringify(model));},
    clear(){localStorage.removeItem(KEY());}
  };
})();
