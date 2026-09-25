export function updateHeader(member){
 const name=member.display_name?.trim() || 'Equipe';
 const el=document.querySelector('#user-name, #session-name');if(el)el.textContent=name;
 const role=document.querySelector('#user-role');if(role)role.textContent=member.role==='admin'?'Administrador':'Equipe';
 const avatar=document.querySelector('#user-avatar');if(avatar)avatar.textContent=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
}
