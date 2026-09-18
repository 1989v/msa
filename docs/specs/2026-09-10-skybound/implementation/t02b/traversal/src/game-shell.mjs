// Presentation only: the simulation owns pause, progress and all input permissions.
export function createGameShell(doc) {
  const panel=doc.querySelector('#pause-panel'),stage=doc.querySelector('.game-stage');
  const start=doc.querySelector('#start'),ending=doc.querySelector('#ending-panel');
  const summary=doc.querySelector('#journey-summary'),chapter=doc.querySelector('#chapter-label');
  const reload=doc.querySelector('#reload-game');reload.addEventListener('click',()=>doc.defaultView.location.reload());
  let wasPaused=true,started=false;
  const setText=(node,text)=>{if(node.textContent!==text)node.textContent=text;};
  for(const button of doc.querySelectorAll('[data-open]'))button.addEventListener('click',()=>doc.getElementById(button.dataset.open).click());
  panel.addEventListener('keydown',event=>{
    if(event.key!=='Tab')return;
    const buttons=[...panel.querySelectorAll('button:not([disabled]),summary,a[href]')].filter(el=>el.getClientRects().length);
    const first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}
  });
  return {update(state){
    const paused=state.paused || !!state.error,completed=state.snapshot?.progress??{};
    if(!paused)started=true;
    if(stage.inert!==paused)stage.inert=paused;
    const hideMenu=!paused || !ending.hidden;if(panel.hidden!==hideMenu)panel.hidden=hideMenu;
    if(paused!==wasPaused&&paused&&!panel.hidden&&!doc.querySelector('dialog[open]'))start.focus({preventScroll:true});
    wasPaused=paused;
    setText(chapter,started?'잠시 바람을 고르는 중':completed.journeyComplete?'다시 이어가는 나루의 여정':'지도 제작자 나루의 여정');
    const count=['stoneRuinActive','watchRuinActive','windRuinActive'].filter(key=>completed[key]).length;
    setText(summary,completed.archiveComplete?'두 번째 지도 완성 · 아직 못 가 본 풍경을 찾아보세요.':completed.harborAligned?'서부 바늘 정렬 완료 · 기록섬의 세 높이를 관측하세요.':completed.journeyComplete?'첫 지도 완성 · 서부 정박지로 새 항로가 열렸어요.':`깨어난 유적 ${count}/3 · 순서는 자유입니다.`);
    reload.hidden=!state.error;if(state.error)start.disabled=true;
    const status=doc.querySelector('#status');status.hidden=state.ready&&!state.error;
  }};
}
