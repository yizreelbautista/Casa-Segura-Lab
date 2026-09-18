/*
 * PUNTO 3 — ALARMA SONORA REALISTA
 * Sirena Web Audio con barrido de frecuencia, doble oscilador y pulsación.
 * Permanece activa hasta validar el PIN.
 */
(function(){
  'use strict';
  const CS = window.CasaSegura;

  CS.alarmSoundNodes=null;
  CS.alarmInterval=null;

  function scheduleSirenCycle(){
    const nodes=CS.alarmSoundNodes;
    const ctx=CS.audioContext;
    if(!nodes||!ctx)return;

    const now=ctx.currentTime+.02;
    const rise=.72,fall=.72,total=rise+fall;

    [nodes.osc1,nodes.osc2].forEach((osc,i)=>{
      const low=i?535:515;
      const high=i?995:965;
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(low,now);
      osc.frequency.exponentialRampToValueAtTime(high,now+rise);
      osc.frequency.exponentialRampToValueAtTime(low,now+total);
    });

    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(.035,now);
    nodes.master.gain.linearRampToValueAtTime(.085,now+.16);
    nodes.master.gain.setValueAtTime(.085,now+rise-.08);
    nodes.master.gain.linearRampToValueAtTime(.050,now+rise+.10);
    nodes.master.gain.linearRampToValueAtTime(.082,now+total-.08);
  }

  CS.startSound = function(){
    if(CS.alarmSoundNodes)return;

    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return;

    if(!CS.audioContext)CS.audioContext=new AC();
    const ctx=CS.audioContext;
    ctx.resume();

    const master=ctx.createGain();
    master.gain.value=.0001;

    const osc1=ctx.createOscillator();
    const osc2=ctx.createOscillator();
    osc1.type='sawtooth';
    osc2.type='square';
    osc1.frequency.value=515;
    osc2.frequency.value=535;

    const tone1=ctx.createGain();
    const tone2=ctx.createGain();
    tone1.gain.value=.68;
    tone2.gain.value=.22;

    // Vibración lenta de una sirena electromecánica.
    const wobble=ctx.createOscillator();
    const wobbleGain=ctx.createGain();
    wobble.type='sine';
    wobble.frequency.value=5.2;
    wobbleGain.gain.value=8;
    wobble.connect(wobbleGain);
    wobbleGain.connect(osc1.frequency);
    wobbleGain.connect(osc2.frequency);

    // Filtro para evitar un pitido digital demasiado agudo.
    const filter=ctx.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=2400;
    filter.Q.value=.8;

    osc1.connect(tone1);osc2.connect(tone2);
    tone1.connect(filter);tone2.connect(filter);
    filter.connect(master);
    master.connect(ctx.destination);

    osc1.start();osc2.start();wobble.start();
    CS.alarmSoundNodes={osc1,osc2,wobble,master,filter,tone1,tone2};

    scheduleSirenCycle();
    CS.alarmInterval=setInterval(scheduleSirenCycle,1440);
  };

  CS.stopSound = function(){
    if(CS.alarmInterval){
      clearInterval(CS.alarmInterval);
      CS.alarmInterval=null;
    }

    const nodes=CS.alarmSoundNodes;
    if(!nodes)return;

    const ctx=CS.audioContext;
    const now=ctx?.currentTime||0;

    try{
      nodes.master.gain.cancelScheduledValues(now);
      nodes.master.gain.setValueAtTime(Math.max(.0001,nodes.master.gain.value||.04),now);
      nodes.master.gain.exponentialRampToValueAtTime(.0001,now+.18);
    }catch{}

    setTimeout(()=>{
      for(const key of ['osc1','osc2','wobble']){
        try{nodes[key]?.stop()}catch{}
        try{nodes[key]?.disconnect()}catch{}
      }
      try{nodes.master?.disconnect()}catch{}
      try{nodes.filter?.disconnect()}catch{}
    },220);

    CS.alarmSoundNodes=null;
  };

  CS.triggerAlarm = function(reason,source='sensor'){
    const first = !CS.state.alarm;
    CS.state.alarm=true;
    CS.state.emergencyReason=reason;
    CS.state.emergencySource=source;
    CS.startSound();
    if(first) CS.notifyAgency();
    CS.addEvent('Emergencia activada',reason,'alarm');
    CS.notify('EMERGENCIA ACTIVA',reason,'alarm');
    CS.openEmergencyScreen();
    CS.render();
  };

  CS.silenceAlarm = function(record=true){
    CS.state.alarm=false;
    CS.state.agency='waiting';
    CS.state.agencyProgress=0;
    clearInterval(CS.agencyInterval);
    CS.agencyInterval=null;
    CS.stopSound();
    if(record){
      CS.addEvent('Emergencia silenciada','El usuario validó correctamente su PIN.','system');
      CS.notify('Alarma silenciada','La identidad fue verificada y la emergencia terminó.');
    }
    CS.render();
  };

  CS.initPoint3 = function(){
    CS.el.silenceButton.addEventListener('click',function(){
      if(!CS.state.alarm){
        CS.showToast('Sin emergencia','La alarma ya está en silencio.');
        return;
      }
      CS.openEmergencyScreen();
    });

    CS.el.emergencyPinForm.addEventListener('submit',function(e){
      e.preventDefault();
      const value = CS.el.emergencyPin.value.trim();
      if(!/^\d{4,8}$/.test(value)){
        CS.el.emergencyPinMessage.textContent='Escribe un PIN válido de 4 a 8 números.';
        CS.el.emergencyPinMessage.classList.remove('is-success');
        return;
      }
      if(!CS.validPinValue(value)){
        CS.el.emergencyPin.value='';
        CS.el.emergencyPinMessage.textContent='PIN incorrecto. La emergencia continúa activa.';
        CS.el.emergencyPinMessage.classList.remove('is-success');
        CS.addEvent('Intento de silenciado rechazado','Se ingresó un PIN incorrecto durante una emergencia.','alarm');
        return;
      }
      CS.el.emergencyPinMessage.textContent='PIN correcto. Silenciando alarma…';
      CS.el.emergencyPinMessage.classList.add('is-success');
      CS.silenceAlarm(true);
      setTimeout(()=>{
        CS.el.emergencyScreen.hidden=true;
        CS.el.emergencyPin.value='';
        CS.el.emergencyPinMessage.textContent='';
        CS.el.emergencyPinMessage.classList.remove('is-success');
        CS.showToast('Emergencia finalizada','El evento quedó registrado en el historial.');
      },650);
    });
  };
})();
