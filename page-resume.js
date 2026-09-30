// Revalidate access without collapsing the document or rebuilding unsaved forms.
export function watchPageResume({getMember,currentMember,onAccessChanged,document:doc=globalThis.document,window:win=globalThis.window}) {
  let checking=false;
  const scope=member=>JSON.stringify([member.user_id,member.team_id,member.role,!!member.is_super_admin,member.active,member.teams?.active]);
  async function resume(){
    const previous=currentMember();
    if(doc.hidden||checking||!previous)return;
    checking=true;
    try{
      const result=await getMember();
      if(result.reason==='network')return;
      if(!result.member||scope(previous)!==scope(result.member))onAccessChanged();
    }catch{
      // Keep the current work during a temporary connection failure.
      // Saving still performs its own access check and server authorization.
    }finally{checking=false;}
  }
  doc.addEventListener('visibilitychange',resume);
  win.addEventListener('pageshow',event=>{if(event.persisted)resume();});
}

