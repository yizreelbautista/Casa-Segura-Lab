/*
 * PUNTO 5 — AVISO AUTOMÁTICO SIMULADO A VIGILANCIA
 */
(function(){
  'use strict';
  const CS = window.CasaSegura;

  CS.notifyAgency = function(){
    CS.state.agency='contacting';
    CS.state.agencyProgress=0;
    clearInterval(CS.agencyInterval);

    CS.agencyInterval=setInterval(function(){
      CS.state.agencyProgress=Math.min(100,CS.state.agencyProgress+8);
      if(CS.state.agencyProgress>=100){
        clearInterval(CS.agencyInterval);
        CS.agencyInterval=null;
        CS.state.agency='notified';
        CS.addEvent('Aviso de vigilancia enviado','La central simulada recibió la señal de emergencia.','agency');
        CS.notify('Aviso enviado','La central de vigilancia simulada confirmó la señal.');
      }
      CS.render();
    },120);
    CS.render();
  };
})();
