export function updateHeader(member){
 const name=member.display_name?.trim() || 'Equipe';
 const el=document.querySelector('#user-name, #session-name');if(el)el.textContent=name;
 document.querySelector('#user-role').textContent=member.role==='admin'?'Administrador':'Equipe';
 document.querySelector('#user-avatar').textContent=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
}
