/*
 * PUNTO 4 — BOTÓN DE PÁNICO
 * Es el único control con color rojo permanente.
 */
(function(){
  'use strict';
  const CS = window.CasaSegura;
  CS.initPoint4 = function(){
    CS.el.panicButton.addEventListener('click',function(){
      CS.triggerAlarm('El usuario activó manualmente el botón de pánico.','panic');
    });
  };
})();
