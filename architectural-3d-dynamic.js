
(function(){
  'use strict';
  const CS=window.CasaSegura;

  CS.initArchitectural3D=function(){
    const host=document.querySelector('#security-house-scene');
    if(!host)return;

    host.querySelectorAll('.arch3d-canvas,.arch3d-cadbar,.arch3d-info,.arch3d-scale,.arch3d-legend,.arch3d-fallback').forEach(x=>x.remove());

    const canvas=document.createElement('canvas');
    canvas.className='arch3d-canvas';
    canvas.tabIndex=0;
    host.append(canvas);

    const cad=document.createElement('div');
    cad.className='arch3d-cadbar';
    cad.innerHTML=`
      <button type="button" data-arch-view="perspective" class="is-active">Perspectiva</button>
      <button type="button" data-arch-view="top">Planta</button>
      <button type="button" data-arch-view="roof">Techo</button>`;
    host.append(cad);

    const info=document.createElement('div');
    info.className='arch3d-info';
    host.append(info);

    const scale=document.createElement('div');
    scale.className='arch3d-scale';
    scale.innerHTML='<b>ESCALA DIGITAL</b> · 1 unidad = 1 metro';
    host.append(scale);

    const legend=document.createElement('div');
    legend.className='arch3d-legend';
    legend.innerHTML='<span><i class="ok"></i>Cerrado</span><span><i class="open"></i>Abierto</span><span><i class="alarm"></i>Alarma</span>';
    host.append(legend);

    const gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
    if(!gl){
      const f=document.createElement('div');
      f.className='arch3d-fallback';
      f.textContent='Este navegador no pudo iniciar WebGL.';
      host.append(f);
      return;
    }

    // ---------------- MATEMÁTICAS ----------------
    const V3={
      sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
      cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
      dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
      norm(a){const l=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/l,a[1]/l,a[2]/l]}
    };
    function I(){return new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])}
    function M(a,b){
      const o=new Float32Array(16);
      for(let c=0;c<4;c++)for(let r=0;r<4;r++)
        o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
      return o;
    }
    function T(x,y,z){const m=I();m[12]=x;m[13]=y;m[14]=z;return m}
    function S(x,y,z){const m=I();m[0]=x;m[5]=y;m[10]=z;return m}
    function RX(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[5]=c;m[6]=s;m[9]=-s;m[10]=c;return m}
    function RY(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[0]=c;m[2]=-s;m[8]=s;m[10]=c;return m}
    function RZ(a){const c=Math.cos(a),s=Math.sin(a),m=I();m[0]=c;m[1]=s;m[4]=-s;m[5]=c;return m}
    function perspective(fov,aspect,near,far){
      const f=1/Math.tan(fov/2),m=new Float32Array(16);
      m[0]=f/aspect;m[5]=f;m[10]=(far+near)/(near-far);m[11]=-1;m[14]=(2*far*near)/(near-far);
      return m;
    }
    function lookAt(eye,target,up=[0,1,0]){
      const z=V3.norm(V3.sub(eye,target)),x=V3.norm(V3.cross(up,z)),y=V3.cross(z,x),m=I();
      m[0]=x[0];m[1]=y[0];m[2]=z[0];m[4]=x[1];m[5]=y[1];m[6]=z[1];
      m[8]=x[2];m[9]=y[2];m[10]=z[2];
      m[12]=-V3.dot(x,eye);m[13]=-V3.dot(y,eye);m[14]=-V3.dot(z,eye);
      return m;
    }

    // ---------------- WEBGL ----------------
    const vs=`attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vNormal;void main(){gl_Position=uMVP*vec4(aPos,1.0);vNormal=mat3(uModel)*aNormal;}`;
    const fs=`precision mediump float;varying vec3 vNormal;uniform vec3 uColor;uniform float uAlpha;void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-.42,.82,.38));float d=max(dot(n,light),0.0);float shade=.45+.55*d;gl_FragColor=vec4(uColor*shade,uAlpha);}`;
    function shader(type,src){
      const s=gl.createShader(type);
      gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const prog=gl.createProgram();
    gl.attachShader(prog,shader(gl.VERTEX_SHADER,vs));
    gl.attachShader(prog,shader(gl.FRAGMENT_SHADER,fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const P=[],N=[],face=(a,b,c,d,n)=>[a,b,c,a,c,d].forEach(p=>{P.push(...p);N.push(...n)});
    const v={
      lbf:[-.5,-.5,.5],rbf:[.5,-.5,.5],rtf:[.5,.5,.5],ltf:[-.5,.5,.5],
      lbb:[-.5,-.5,-.5],rbb:[.5,-.5,-.5],rtb:[.5,.5,-.5],ltb:[-.5,.5,-.5]
    };
    face(v.lbf,v.rbf,v.rtf,v.ltf,[0,0,1]);
    face(v.rbb,v.lbb,v.ltb,v.rtb,[0,0,-1]);
    face(v.lbb,v.lbf,v.ltf,v.ltb,[-1,0,0]);
    face(v.rbf,v.rbb,v.rtb,v.rtf,[1,0,0]);
    face(v.ltf,v.rtf,v.rtb,v.ltb,[0,1,0]);
    face(v.lbb,v.rbb,v.rbf,v.lbf,[0,-1,0]);

    const pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(P),gl.STATIC_DRAW);
    const nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(N),gl.STATIC_DRAW);
    const aPos=gl.getAttribLocation(prog,'aPos'),aNormal=gl.getAttribLocation(prog,'aNormal');
    gl.bindBuffer(gl.ARRAY_BUFFER,pb);gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,nb);gl.enableVertexAttribArray(aNormal);gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,0,0);

    const uMVP=gl.getUniformLocation(prog,'uMVP'),uModel=gl.getUniformLocation(prog,'uModel'),
          uColor=gl.getUniformLocation(prog,'uColor'),uAlpha=gl.getUniformLocation(prog,'uAlpha');

    const C={
      ground:[.055,.085,.105],grid:[.14,.20,.25],slab:[.53,.49,.43],
      wall:[.82,.80,.75],trim:[.28,.35,.42],wood:[.34,.19,.10],
      glass:[.21,.55,.77],frame:[.14,.30,.43],roof:[.17,.23,.29],
      bed:[.34,.47,.61],soft:[.52,.47,.43],counter:[.35,.37,.37],
      fixture:[.76,.79,.80],alarm:[.72,.10,.13],open:[.91,.50,.05],
      camera:[.13,.25,.38],lens:[.73,.87,.98],metal:[.48,.54,.60],
      wallCut:[.74,.73,.70]
    };

    let opaque=[],transparent=[],devices=new Map(),roofObjects=[],mode='perspective';
    let roofEnvelope=[],walkObjects=[];
    const walkState={visible:false,current:'exterior',target:'exterior',progress:1,start:[0,0,0],end:[0,0,0],overlay:false,activeDoorId:null,closeTimer:null,route:[],currentStep:null,waiting:false};
    const cam={yaw:.72,pitch:.62,dist:15.8,target:[6,1.0,4]};

    function obj(pos,size,color,opt={}){
      const o={pos:[...pos],size:[...size],color:[...color],rx:opt.rx||0,ry:opt.ry||0,rz:opt.rz||0,alpha:opt.alpha??1,visible:opt.visible!==false,group:opt.group||'static'};
      (o.alpha<1?transparent:opaque).push(o);return o;
    }
    function model(o){
      let m=T(...o.pos);
      if(o.ry)m=M(m,RY(o.ry));
      if(o.rx)m=M(m,RX(o.rx));
      if(o.rz)m=M(m,RZ(o.rz));
      return M(m,S(...o.size));
    }

    function floorColor(t){
      return t==='Baño'?[.54,.62,.65]:
             t==='Cocina'?[.61,.59,.55]:
             t==='Recámara'?[.62,.57,.53]:
             [.68,.61,.53];
    }

    function furniture(r){
      const cx=r.x+r.w/2,cz=r.z+r.d/2;
      if(r.type==='Recámara'){
        const bw=Math.min(2.1,r.w*.62),bd=Math.min(1.9,r.d*.54);
        obj([cx,.30,cz],[bw,.55,bd],C.bed);
        obj([cx,.61,cz-r.d*.18],[Math.min(1.8,bw*.85),.14,.38],[.86,.86,.84]);
        obj([r.x+.32,.29,r.z+r.d-.34],[.45,.58,.45],[.43,.31,.23]);
      }else if(r.type==='Sala'){
        obj([r.x+r.w*.29,.33,r.z+r.d*.59],[Math.min(2.7,r.w*.44),.66,.84],C.soft);
        obj([r.x+r.w*.62,.20,r.z+r.d*.61],[1.08,.40,.66],[.43,.31,.24]);
        obj([r.x+r.w-.32,.56,r.z+r.d*.54],[.10,1.05,1.55],[.13,.17,.20]);
      }else if(r.type==='Cocina'){
        obj([cx,.47,r.z+.38],[Math.max(1,r.w-.65),.93,.56],C.counter);
        obj([r.x+r.w-.38,.47,cz],[.56,.93,Math.max(1,r.d-.65)],C.counter);
        obj([cx,.45,r.z+r.d*.67],[Math.min(2.35,r.w*.52),.88,.90],[.60,.58,.53]);
        obj([r.x+r.w*.35,.95,r.z+.37],[.65,.06,.42],[.10,.11,.12]);
      }else if(r.type==='Baño'){
        obj([r.x+.43,.07,r.z+.55],[.74,.10,.92],[.30,.47,.58],{alpha:.52});
        obj([r.x+r.w-.44,.27,r.z+.75],[.50,.54,.70],C.fixture);
        obj([r.x+r.w-.40,.42,r.z+r.d-.42],[.80,.80,.38],C.fixture);
      }
    }

    function openingPose(r,o){
      const q=Math.min(.95,Math.max(.05,Number(o.offset??.5)));
      if(o.wall==='north')return{x:r.x+r.w*q,z:r.z,wall:'north',axis:'x',yaw:0};
      if(o.wall==='south')return{x:r.x+r.w*q,z:r.z+r.d,wall:'south',axis:'x',yaw:0};
      if(o.wall==='west')return{x:r.x,z:r.z+r.d*q,wall:'west',axis:'z',yaw:Math.PI/2};
      return{x:r.x+r.w,z:r.z+r.d*q,wall:'east',axis:'z',yaw:Math.PI/2};
    }

    // Construye pared con huecos REALES para puertas/ventanas
    function wallWithOpenings(r,wall,H,T,allOpenings){
      const alongX=(wall==='north'||wall==='south');
      const length=alongX?r.w:r.d;
      const base=alongX?r.x:r.z;
      const wallCoord=wall==='north'?r.z:wall==='south'?r.z+r.d:wall==='west'?r.x:r.x+r.w;

      const ops=allOpenings
        .filter(o=>o.roomId===r.id&&o.wall===wall&&['door','window'].includes(o.type))
        .map(o=>{
          const center=(o.offset??.5)*length;
          const width=Math.min(length*.8,o.width||(o.type==='door'?.9:1.2));
          const a=Math.max(0,center-width/2),b=Math.min(length,center+width/2);
          const sill=o.type==='door'?0:(o.sill??.9);
          const top=o.type==='door'?Math.min(H,2.12):Math.min(H,sill+(o.height||1.2));
          return{a,b,sill,top};
        }).sort((a,b)=>a.a-b.a);

      let cur=0;
      for(const q of ops){
        if(q.a>cur){
          const mid=(cur+q.a)/2,span=q.a-cur;
          if(alongX)obj([base+mid,H/2,wallCoord],[span,H,T],C.wall);
          else obj([wallCoord,H/2,base+mid],[T,H,span],C.wall);
        }
        if(q.sill>0){
          const mid=(q.a+q.b)/2,span=q.b-q.a;
          if(alongX)obj([base+mid,q.sill/2,wallCoord],[span,q.sill,T],C.wall);
          else obj([wallCoord,q.sill/2,base+mid],[T,q.sill,span],C.wall);
        }
        if(q.top<H){
          const mid=(q.a+q.b)/2,span=q.b-q.a,hh=H-q.top;
          if(alongX)obj([base+mid,q.top+hh/2,wallCoord],[span,hh,T],C.wall);
          else obj([wallCoord,q.top+hh/2,base+mid],[T,hh,span],C.wall);
        }
        cur=Math.max(cur,q.b);
      }
      if(cur<length){
        const mid=(cur+length)/2,span=length-cur;
        if(alongX)obj([base+mid,H/2,wallCoord],[span,H,T],C.wall);
        else obj([wallCoord,H/2,base+mid],[T,H,span],C.wall);
      }
    }


    function physicalWallWithOpenings(w,H,T){
      const horizontal=w.axis==='x';
      const length=w.b-w.a;
      const base=w.a;
      const wallCoord=w.coord;

      const ops=(w.openings||[]).map(o=>{
        const center=o.physicalCenter-base;
        const width=Math.min(length*.95,o.width||(o.type==='door'?.9:1.2));
        const a=Math.max(0,center-width/2),b=Math.min(length,center+width/2);
        const sill=(o.type==='door'||o.type==='passage')?0:(o.sill??.9);
        const top=o.type==='passage'
          ? H
          : o.type==='door'
            ? Math.min(H,2.12)
            : Math.min(H,sill+(o.height||1.2));
        return{a,b,sill,top};
      }).sort((a,b)=>a.a-b.a);

      let cur=0;
      for(const q of ops){
        if(q.a>cur){
          const mid=(cur+q.a)/2,span=q.a-cur;
          if(horizontal)obj([base+mid,H/2,wallCoord],[span,H,T],C.wall);
          else obj([wallCoord,H/2,base+mid],[T,H,span],C.wall);
        }
        if(q.sill>0){
          const mid=(q.a+q.b)/2,span=q.b-q.a;
          if(horizontal)obj([base+mid,q.sill/2,wallCoord],[span,q.sill,T],C.wall);
          else obj([wallCoord,q.sill/2,base+mid],[T,q.sill,span],C.wall);
        }
        if(q.top<H){
          const mid=(q.a+q.b)/2,span=q.b-q.a,hh=H-q.top;
          if(horizontal)obj([base+mid,q.top+hh/2,wallCoord],[span,hh,T],C.wall);
          else obj([wallCoord,q.top+hh/2,base+mid],[T,hh,span],C.wall);
        }
        cur=Math.max(cur,q.b);
      }

      if(cur<length){
        const mid=(cur+length)/2,span=length-cur;
        if(horizontal)obj([base+mid,H/2,wallCoord],[span,H,T],C.wall);
        else obj([wallCoord,H/2,base+mid],[T,H,span],C.wall);
      }
    }

    function addDoor(o,r){
      const p=openingPose(r,o),w=o.width||.9,h=2.08,leafT=.09;
      if(p.axis==='x'){
        obj([p.x-w/2-.045,h/2,p.z],[.09,h+.16,.14],C.trim);
        obj([p.x+w/2+.045,h/2,p.z],[.09,h+.16,.14],C.trim);
        obj([p.x,h+.04,p.z],[w+.18,.09,.14],C.trim);
      }else{
        obj([p.x,h/2,p.z-w/2-.045],[.14,h+.16,.09],C.trim);
        obj([p.x,h/2,p.z+w/2+.045],[.14,h+.16,.09],C.trim);
        obj([p.x,h+.04,p.z],[.14,.09,w+.18],C.trim);
      }

      const hinge = p.axis==='x' ? [p.x-w/2,p.z] : [p.x,p.z-w/2];
      const leaf=obj([p.x,h/2,p.z],[w,h,leafT],C.wood,{ry:p.yaw,group:'device'});
      const panelA=obj([p.x,1.43,p.z],[Math.max(.22,w*.72),.56,leafT+.01],[.49,.34,.22],{ry:p.yaw,group:'device'});
      const panelB=obj([p.x,.73,p.z],[Math.max(.22,w*.72),.56,leafT+.01],[.49,.34,.22],{ry:p.yaw,group:'device'});
      const knob=obj([p.x,1.02,p.z],[.07,.07,.07],[.68,.54,.28],{group:'device'});

      devices.set(o.id,{type:'door',leaf,panels:[panelA,panelB],knob,baseYaw:p.yaw,p,hinge,w,thickness:leafT});
    }

    function placeDoorDevice(d,angle){
      const total=d.baseYaw+angle;
      const half=d.w/2;
      const cx=d.hinge[0]+Math.cos(total)*half;
      const cz=d.hinge[1]+Math.sin(total)*half;

      d.leaf.pos[0]=cx; d.leaf.pos[2]=cz; d.leaf.ry=total;
      d.panels?.forEach(p=>{p.pos[0]=cx;p.pos[2]=cz;p.ry=total;});

      const knobDx=Math.cos(total)*(d.w*.34)-Math.sin(total)*(.06);
      const knobDz=Math.sin(total)*(d.w*.34)+Math.cos(total)*(.06);
      d.knob.pos[0]=d.hinge[0]+knobDx;
      d.knob.pos[2]=d.hinge[1]+knobDz;
    }

    async function ensureDoorState(doorId,shouldOpen){
      const d=CS.state.devices.find(x=>x.id===doorId);
      if(!d)return;
      const open=d.state==='open';
      if(shouldOpen!==open){
        await CS.toggleAccessDevice?.(doorId);
      }
    }

    function showWalkOverlay(active=true){
      walkState.overlay=active;
      applyViewVisibility();
    }

    function scheduleDoorAutoClose(doorId,delay=900){
      clearTimeout(walkState.closeTimer);
      if(!doorId)return;
      walkState.closeTimer=setTimeout(async()=>{
        const d=CS.state.devices.find(x=>x.id===doorId);
        if(d&&d.state==='open'){
          await CS.toggleAccessDevice?.(doorId);
        }
        if(walkState.activeDoorId===doorId){
          walkState.activeDoorId=null;
        }
      },delay);
    }

    function addWindow(o,r){
      const p=openingPose(r,o),w=o.width||1.2,h=o.height||1.2,sill=o.sill??.9,y=sill+h/2;
      const fw=.075,depth=.13;
      if(p.axis==='x'){
        obj([p.x-w/2-fw/2,y,p.z],[fw,h+.18,depth],C.frame);
        obj([p.x+w/2+fw/2,y,p.z],[fw,h+.18,depth],C.frame);
        obj([p.x,sill-fw/2,p.z],[w+.20,fw,depth],C.frame);
        obj([p.x,sill+h+fw/2,p.z],[w+.20,fw,depth],C.frame);
        obj([p.x,y,p.z],[.035,h-.12,depth+.015],C.frame);
        const a=obj([p.x-w*.25,y,p.z],[w*.47,h-.13,.045],C.glass,{alpha:.72,group:'device'});
        const b=obj([p.x+w*.25,y,p.z],[w*.47,h-.13,.045],C.glass,{alpha:.72,group:'device'});
        devices.set(o.id,{type:'window',axis:'x',parts:[a,b],center:[p.x,y,p.z],w});
      }else{
        obj([p.x,y,p.z-w/2-fw/2],[depth,h+.18,fw],C.frame);
        obj([p.x,y,p.z+w/2+fw/2],[depth,h+.18,fw],C.frame);
        obj([p.x,sill-fw/2,p.z],[depth,fw,w+.20],C.frame);
        obj([p.x,sill+h+fw/2,p.z],[depth,fw,w+.20],C.frame);
        obj([p.x,y,p.z],[depth+.015,h-.12,.035],C.frame);
        const a=obj([p.x,y,p.z-w*.25],[.045,h-.13,w*.47],C.glass,{alpha:.72,group:'device'});
        const b=obj([p.x,y,p.z+w*.25],[.045,h-.13,w*.47],C.glass,{alpha:.72,group:'device'});
        devices.set(o.id,{type:'window',axis:'z',parts:[a,b],center:[p.x,y,p.z],w});
      }
    }

    function addCamera(o,r){
      const p=openingPose(r,o),y=o.sill||2.25;
      const body=obj([p.x,y,p.z],[.34,.22,.38],C.camera,{ry:p.yaw,group:'device'});
      const lens=obj(
        p.axis==='x'?[p.x,y,p.z+(p.wall==='south'?.23:-.23)]:[p.x+(p.wall==='east'?.23:-.23),y,p.z],
        p.axis==='x'?[.14,.14,.08]:[.08,.14,.14],
        C.lens,{group:'device'}
      );
      const mount=obj(
        p.axis==='x'?[p.x,y+.15,p.z+(p.wall==='south'?-.24:.24)]:[p.x+(p.wall==='east'?-.24:.24),y+.15,p.z],
        [.10,.34,.10],C.metal,{group:'device'}
      );
      devices.set(o.id,{type:'camera',body,lens,mount});
    }


    function resolveWalkRoom(target,L){
      if(!target||target==='exterior')return null;
      return L.rooms.find(r=>r.id===target)
        ||L.rooms.find(r=>String(r.name||'').toLowerCase()===String(target).toLowerCase())
        ||null;
    }

    function roomCenterByKey(target,L){
      if(target==='exterior'){
        const structures=CS.CADStructure?.analyze(L)?.components||[];
        if(structures.length){
          const b=structures[0].bounds;
          return[b.x+b.w/2,.03,b.z+b.d+1.25];
        }
        return[(L.width||12)*.50,.03,(L.depth||8)+1.25];
      }
      const r=resolveWalkRoom(target,L);
      return r?[r.x+r.w/2,.03,r.z+r.d/2]:[(L.width||12)*.5,.03,(L.depth||8)*.5];
    }

    function walkLabel(target,L){
      if(target==='exterior')return'Exterior';
      return resolveWalkRoom(target,L)?.name||'Habitación';
    }

    function firstWalkRoom(L){
      return L.rooms.find(r=>/sala|entrada/i.test(`${r.name||''} ${r.type||''}`))
        ||L.rooms[0]
        ||null;
    }

    function addWalkPerson(L){
      walkObjects=[];
      const p=roomCenterByKey('exterior',L);
      const head=obj([p[0],1.70,p[2]],[.28,.28,.28],[.78,.62,.48],{group:'walk'});
      const torso=obj([p[0],1.20,p[2]],[.46,.72,.28],[.16,.42,.68],{group:'walk'});
      const legL=obj([p[0]-.12,.62,p[2]],[.16,.64,.18],[.16,.20,.27],{group:'walk'});
      const legR=obj([p[0]+.12,.62,p[2]],[.16,.64,.18],[.16,.20,.27],{group:'walk'});
      const armL=obj([p[0]-.31,1.22,p[2]],[.13,.62,.14],[.78,.62,.48],{group:'walk'});
      const armR=obj([p[0]+.31,1.22,p[2]],[.13,.62,.14],[.78,.62,.48],{group:'walk'});
      walkObjects=[head,torso,legL,legR,armL,armR];
      walkState.current='exterior';walkState.target='exterior';walkState.progress=1;
      walkState.start=[...p];walkState.end=[...p];
      updateWalkPersonPosition(p);
    }

    function updateWalkPersonPosition(p){
      if(!walkObjects.length)return;
      const [x,,z]=p;
      const ys=[1.70,1.20,.62,.62,1.22,1.22];
      const xs=[0,0,-.12,.12,-.31,.31];
      walkObjects.forEach((o,i)=>{o.pos[0]=x+xs[i];o.pos[1]=ys[i];o.pos[2]=z;o.visible=walkState.visible;});
    }

    function currentWalkPoint(){
      return walkObjects.length
        ? [walkObjects[1].pos[0],0,walkObjects[1].pos[2]]
        : [walkState.start[0],0,walkState.start[2]];
    }

    function finishWalkRoute(){
      walkState.current=walkState.target;
      walkState.progress=1;
      walkState.currentStep=null;
      walkState.route=[];
      const L=CS.CAD?.model||CS.CADStore?.load?.()||CS.CADStore.defaultModel();
      const label=document.querySelector('#sim-person-location');
      if(label)label.textContent=walkLabel(walkState.current,L);
      if(walkState.current!=='exterior'&&CS.state.armed){
        CS.triggerAlarm?.(`Movimiento detectado en ${walkLabel(walkState.current,L)}.`,'sensor');
      }
    }

    function beginNextWalkStep(){
      if(walkState.waiting)return;
      const step=walkState.route.shift();
      if(!step){
        finishWalkRoute();
        return;
      }

      walkState.currentStep=step;
      if(step.openDoorId){
        walkState.activeDoorId=step.openDoorId;
        ensureDoorState(step.openDoorId,true);
      }

      walkState.start=currentWalkPoint();
      walkState.end=[...step.point];
      walkState.progress=0;
    }

    function animateWalk(){
      if(!walkState.currentStep){
        if(walkState.route.length)beginNextWalkStep();
        return;
      }

      walkState.progress=Math.min(1,walkState.progress+.024);
      const t=walkState.progress<.5
        ? 2*walkState.progress*walkState.progress
        : 1-Math.pow(-2*walkState.progress+2,2)/2;

      const p=[
        walkState.start[0]+(walkState.end[0]-walkState.start[0])*t,
        0,
        walkState.start[2]+(walkState.end[2]-walkState.start[2])*t
      ];
      updateWalkPersonPosition(p);

      if(walkState.progress>=1){
        const completed=walkState.currentStep;
        walkState.currentStep=null;

        if(completed.closeDoorId){
          const id=completed.closeDoorId;
          setTimeout(()=>ensureDoorState(id,false),260);
          if(walkState.activeDoorId===id)walkState.activeDoorId=null;
        }

        beginNextWalkStep();
      }
    }

    async function openAccessForDestination(target,L){
      let opening=null;

      if(target==='exterior'){
        const currentRoom=resolveWalkRoom(walkState.current,L);
        opening=currentRoom
          ? L.openings.find(o=>o.type==='door'&&o.roomId===currentRoom.id)
          : null;
        opening=opening||L.openings.find(o=>o.type==='door'&&o.id==='door-main')||L.openings.find(o=>o.type==='door');
      }else{
        const targetRoom=resolveWalkRoom(target,L);
        if(targetRoom){
          opening=L.openings.find(o=>o.type==='door'&&o.roomId===targetRoom.id);
        }
      }

      if(walkState.activeDoorId && (!opening || walkState.activeDoorId!==opening.id)){
        await ensureDoorState(walkState.activeDoorId,false);
        walkState.activeDoorId=null;
      }

      if(opening){
        await ensureDoorState(opening.id,true);
        walkState.activeDoorId=opening.id;
        return opening.id;
      }
      return null;
    }

    async function walkTo(target){
      const L=CS.CAD?.model||CS.CADStore?.load?.()||CS.CADStore.defaultModel();
      if(target!=='exterior'&&!resolveWalkRoom(target,L))return;

      showWalkOverlay(true);
      walkState.visible=true;
      walkObjects.forEach(o=>o.visible=true);

      const from=walkState.current||'exterior';
      const startPoint=currentWalkPoint();
      const plan=CS.CADNavigation?.buildWaypoints(L,from,target,startPoint);

      if(!plan){
        CS.showToast?.(
          'Ruta no disponible',
          'No existe un camino mediante puertas entre esos espacios. Agrega o mueve una puerta en el Editor CAD.'
        );
        return;
      }

      // Close any door left open by a previous interrupted route.
      if(walkState.activeDoorId){
        ensureDoorState(walkState.activeDoorId,false);
        walkState.activeDoorId=null;
      }

      walkState.target=target;
      walkState.route=[...(plan.steps||[])];
      walkState.currentStep=null;
      walkState.progress=1;

      const label=document.querySelector('#sim-person-location');
      if(label)label.textContent=`En camino a ${walkLabel(target,L)}`;

      CS.addEvent?.(
        'Recorrido iniciado',
        `Ruta por puertas hacia ${walkLabel(target,L)}.`,
        'sensor'
      );

      beginNextWalkStep();
    }


    function buildGableRoof(spec,H){
      const {x,z,w,d}=spec;
      const cx=x+w/2,cz=z+d/2;
      const overZ=.48,overX=.36,rise=Math.max(.65,Math.min(1.34,d*.18));
      const eaveY=H+.09,ridgeY=eaveY+rise;
      const run=d/2+overZ;
      const angle=Math.atan2(rise,run);
      const slopeLen=Math.hypot(run,rise);
      const centerY=(eaveY+ridgeY)/2;
      const backCenterZ=(z-overZ+cz)/2;
      const frontCenterZ=(cz+z+d+overZ)/2;

      const back=obj([cx,centerY,backCenterZ],[w+overX*2,.16,slopeLen],C.roof,{rx:-angle,group:'roof'});
      const front=obj([cx,centerY,frontCenterZ],[w+overX*2,.16,slopeLen],C.roof,{rx:angle,group:'roof'});
      const ridge=obj([cx,ridgeY+.055,cz],[w+overX*2+.08,.18,.24],[.12,.17,.23],{group:'roof'});
      const eaveBack=obj([cx,eaveY-.01,z-overZ],[w+overX*2+.04,.22,.16],C.trim,{group:'roof'});
      const eaveFront=obj([cx,eaveY-.01,z+d+overZ],[w+overX*2+.04,.22,.16],C.trim,{group:'roof'});
      const ceiling=obj([cx,H+.055,cz],[w+.04,.10,d+.04],C.wallCut,{group:'roof'});

      const pieces=[back,front,ridge,eaveBack,eaveFront,ceiling];

      const slices=Math.max(8,Math.round(d*2));
      for(const xSide of [x,x+w]){
        for(let i=0;i<slices;i++){
          const zc=z+d*(i+.5)/slices;
          const normalized=Math.abs(zc-cz)/(d/2||1);
          const hh=Math.max(0,rise*(1-normalized));
          if(hh>.02)pieces.push(obj([xSide,H+hh/2,zc],[.20,hh,d/slices+.03],C.wall,{group:'roof'}));
        }
      }

      roofObjects.push(back,front);
      roofEnvelope.push(...pieces);
    }

    function buildShedRoof(spec,H){
      const {x,z,w,d,slope='south'}=spec;
      const cx=x+w/2,cz=z+d/2,over=.30;
      const rise=Math.max(.42,Math.min(.85,Math.min(w,d)*.20));
      const eaveY=H+.10;

      if(slope==='north'||slope==='south'){
        const run=d+over*2,angle=Math.atan2(rise,run);
        const highSouth=slope==='north';
        const plane=obj(
          [cx,eaveY+rise/2,cz],
          [w+over*2,.14,Math.hypot(run,rise)],
          C.roof,{rx:highSouth?angle:-angle,group:'roof'}
        );
        const ceiling=obj([cx,H+.055,cz],[w+.03,.10,d+.03],C.wallCut,{group:'roof'});
        roofObjects.push(plane);roofEnvelope.push(plane,ceiling);
      }else{
        const run=w+over*2,angle=Math.atan2(rise,run);
        const highEast=slope==='west';
        const plane=obj(
          [cx,eaveY+rise/2,cz],
          [Math.hypot(run,rise),.14,d+over*2],
          C.roof,{rz:highEast?-angle:angle,group:'roof'}
        );
        const ceiling=obj([cx,H+.055,cz],[w+.03,.10,d+.03],C.wallCut,{group:'roof'});
        roofObjects.push(plane);roofEnvelope.push(plane,ceiling);
      }
    }

    function rebuild(){
      opaque=[];transparent=[];devices=new Map();roofObjects=[];roofEnvelope=[];walkObjects=[];
      const L=CS.CAD?.model||CS.CADStore?.load?.()||CS.CADStore.defaultModel();
      CS.renderDynamicWalkDestinations?.();
      const W=Math.max(12,L.width||12,...L.rooms.map(r=>r.x+r.w));
      const D=Math.max(8,L.depth||8,...L.rooms.map(r=>r.z+r.d));
      const H=L.wallHeight||2.8,T=.18;

      cam.target=[W/2,1.0,D/2];
      cam.dist=Math.max(14.8,Math.max(W,D)*1.38);

      obj([W/2,-.11,D/2],[W+2,.18,D+2],C.ground);
      // La losa se genera por habitación para que estructuras separadas no queden unidas artificialmente.

      for(let x=0;x<=W;x++)obj([x,-.015,D/2],[.018,.018,D+1],C.grid);
      for(let z=0;z<=D;z++)obj([W/2,-.014,z],[W+1,.018,.018],C.grid);

      // Pisos y mobiliario por habitación.
      for(const r of L.rooms){
        obj([r.x+r.w/2,.02,r.z+r.d/2],[r.w,.14,r.d],C.slab);
        obj([r.x+r.w/2,.09,r.z+r.d/2],[Math.max(.1,r.w-.08),.10,Math.max(.1,r.d-.08)],floorColor(r.type));
        furniture(r);
      }

      // Red física de muros: evita duplicar paredes compartidas.
      // Las puertas interiores dejan de quedar tapadas por el muro del cuarto vecino.
      const physicalWalls=CS.CADWallEngine?.build(L)||[];
      physicalWalls.forEach(w=>physicalWallWithOpenings(w,H,T));

      // Marcos/hojas/cristales/cámaras
      for(const o of L.openings){
        const r=L.rooms.find(x=>x.id===o.roomId);if(!r)continue;
        if(o.type==='door')addDoor(o,r);
        else if(o.type==='window')addWindow(o,r);
        else if(o.type==='camera')addCamera(o,r);
      }

      // Cubierta calculada por la distribución CAD.
      // Rectángulos conectados forman una cubierta; estructuras separadas
      // reciben cubiertas independientes. En formas irregulares se usan
      // cubierta principal + anexos a una agua.
      const roofPlan=CS.CADRoofEngine?.plan(L);
      const planned=roofPlan?.roofs?.length
        ? roofPlan.roofs
        : [{id:'roof-fallback',type:'gable',x:0,z:0,w:W,d:D}];

      for(const spec of planned){
        if(spec.type==='shed')buildShedRoof(spec,H);
        else buildGableRoof(spec,H);
      }

      addWalkPerson(L);
      applyViewVisibility();

      const beds=L.rooms.filter(r=>r.type==='Recámara').length;
      const structures=CS.CADStructure?.analyze(L)?.count||0;
      info.innerHTML=`<strong>MODELO ARQUITECTÓNICO 3D</strong>
        <span>${W.toFixed(2)} m × ${D.toFixed(2)} m · muros ${H.toFixed(2)} m</span>
        <span>${beds} recámara${beds===1?'':'s'} · ${L.rooms.length} espacios · ${structures} estructura${structures===1?'':'s'}</span>
        <span>${L.openings.filter(o=>o.type==='door').length} puertas · ${L.openings.filter(o=>o.type==='window').length} ventanas · ${L.openings.filter(o=>o.type==='camera').length} cámaras</span>`;
    }

    function applyViewVisibility(){
      const roofVisible=(mode==='roof'||mode==='exterior') && !walkState.overlay;
      roofEnvelope.forEach(o=>o.visible=roofVisible);
      walkState.visible=(mode==='walk'||walkState.overlay);
      walkObjects.forEach(o=>o.visible=walkState.visible);
    }

    function updateDeviceVisuals(){
      for(const [id,d] of devices){
        const state=CS.state.devices.find(x=>x.id===id);
        const open=state?.state==='open',alarm=!!CS.state.alarm&&open;
        if(d.type==='door'){
          d.leaf.color=alarm?C.alarm:(open?C.open:C.wood);
          d.panels?.forEach(p=>p.color=alarm?[.70,.18,.20]:[.49,.34,.22]);
          const angle=open?-Math.PI*.46:0;
          placeDoorDevice(d,angle);
          d.knob.color=alarm?[.95,.52,.54]:[.68,.54,.28];
        }else if(d.type==='window'){
          const shift=open?d.w*.18:0;
          if(d.axis==='x'){
            d.parts[0].pos[0]=d.center[0]-d.w*.25-shift;
            d.parts[1].pos[0]=d.center[0]+d.w*.25+shift;
          }else{
            d.parts[0].pos[2]=d.center[2]-d.w*.25-shift;
            d.parts[1].pos[2]=d.center[2]+d.w*.25+shift;
          }
          const color=alarm?C.alarm:(open?C.open:C.glass);
          d.parts.forEach(p=>p.color=[...color]);
        }else{
          const online=state?.state==='online';
          d.body.color=online?[.57,.13,.17]:C.camera;
          d.lens.color=online?[.96,.31,.37]:C.lens;
        }
      }
    }

    function resize(){
      const r=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
      const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
      canvas.style.width=r.width+'px';canvas.style.height=r.height+'px';
      gl.viewport(0,0,w,h);
    }

    function eye(){
      const cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch),cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw);
      return[
        cam.target[0]+cam.dist*cp*sy,
        cam.target[1]+cam.dist*sp,
        cam.target[2]+cam.dist*cp*cy
      ];
    }

    function draw(o,PP,VV){
      if(!o.visible)return;
      const mm=model(o),mvp=M(PP,M(VV,mm));
      gl.uniformMatrix4fv(uModel,false,mm);
      gl.uniformMatrix4fv(uMVP,false,mvp);
      gl.uniform3fv(uColor,new Float32Array(o.color));
      gl.uniform1f(uAlpha,o.alpha);
      gl.drawArrays(gl.TRIANGLES,0,P.length/3);
    }

    function render(){
      resize();updateDeviceVisuals();animateWalk();
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
      gl.clearColor(.025,.045,.065,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

      const PP=perspective(Math.PI/4.0,canvas.width/canvas.height,.1,100);
      const VV=lookAt(eye(),cam.target,[0,1,0]);

      gl.disable(gl.BLEND);gl.depthMask(true);
      opaque.forEach(o=>draw(o,PP,VV));

      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      transparent.forEach(o=>draw(o,PP,VV));
      gl.depthMask(true);gl.disable(gl.BLEND);

      requestAnimationFrame(render);
    }

    let dragging=false,lx=0,ly=0;
    canvas.addEventListener('pointerdown',e=>{
      dragging=true;lx=e.clientX;ly=e.clientY;
      host.classList.add('is-webgl-dragging');
      try{canvas.setPointerCapture(e.pointerId)}catch{}
    });
    canvas.addEventListener('pointermove',e=>{
      if(!dragging)return;
      cam.yaw-=(e.clientX-lx)*.006;
      cam.pitch=Math.max(.22,Math.min(1.30,cam.pitch+(e.clientY-ly)*.005));
      lx=e.clientX;ly=e.clientY;
    });
    const stop=()=>{dragging=false;host.classList.remove('is-webgl-dragging')};
    canvas.addEventListener('pointerup',stop);
    canvas.addEventListener('pointercancel',stop);
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      cam.dist=Math.max(7.5,Math.min(60,cam.dist+e.deltaY*.014));
    },{passive:false});

    function setView(next){
      mode=next;
      cad.querySelectorAll('[data-arch-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.archView===next));

      if(next==='top'){
        cam.yaw=0;cam.pitch=1.46;cam.dist=Math.max(17,cam.dist);
      }else if(next==='roof'){
        cam.yaw=.72;cam.pitch=.72;cam.dist=18.8;
      }else if(next==='exterior'){
        // Vista de fachada/costado semejante a una maqueta arquitectónica real.
        cam.yaw=.69;cam.pitch=.46;cam.dist=17.6;
      }else if(next==='walk'){
        // Recorrido interior: sin techo y cámara más baja.
        cam.yaw=.72;cam.pitch=.32;cam.dist=12.4;
      }else{
        // Interior: techo retirado para inspeccionar habitaciones.
        cam.yaw=.72;cam.pitch=.67;cam.dist=15.8;
      }
      applyViewVisibility();
    }

    cad.querySelectorAll('[data-arch-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.archView)));
    document.querySelector('#sim-rotate-left')?.addEventListener('click',()=>cam.yaw+=.16);
    document.querySelector('#sim-rotate-right')?.addEventListener('click',()=>cam.yaw-=.16);
    document.querySelector('#sim-zoom-in')?.addEventListener('click',()=>cam.dist=Math.max(7.5,cam.dist-1));
    document.querySelector('#sim-zoom-out')?.addEventListener('click',()=>cam.dist=Math.min(60,cam.dist+1));
    document.querySelector('#sim-reset-view')?.addEventListener('click',()=>{showWalkOverlay(false);setView('perspective');});
    document.querySelector('#sim-view-interior')?.addEventListener('click',()=>setView('perspective'));
    document.querySelector('#sim-view-exterior')?.addEventListener('click',()=>{showWalkOverlay(false);setView('exterior');});
    document.querySelector('#sim-view-walk')?.addEventListener('click',()=>{
      // Recorrido = capa sobre la perspectiva actual. La cámara NO se reinicia.
      showWalkOverlay(true);
      document.querySelector('#sim-view-walk')?.classList.add('is-active');
    });

    document.querySelector('#sim-enter-house')?.addEventListener('click',async()=>{
      const L=CS.CAD?.model||CS.CADStore?.load?.()||CS.CADStore.defaultModel();
      if(walkState.current==='exterior'){
        const first=firstWalkRoom(L);
        if(first)await walkTo(first.id);
      }else{
        await walkTo('exterior');
      }
    });

    document.querySelector('#walk-actions')?.addEventListener('click',async e=>{
      const roomButton=e.target.closest('[data-walk-room-id]');
      if(roomButton){
        await walkTo(roomButton.dataset.walkRoomId);
        return;
      }
      if(e.target.closest('#sim-walk-exterior')){
        await walkTo('exterior');
      }
    });

    CS.Architectural3D={rebuild,updateDeviceVisuals,setView,walkTo};
    rebuild();
    setView('perspective');
    requestAnimationFrame(render);
  };
})();
