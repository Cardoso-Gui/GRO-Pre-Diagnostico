export function updateHeader(member){
 const nav=document.querySelector('header nav');
 if(nav){nav.replaceChildren();for(const [label,file] of [['Início','inicio.html'],['Clientes','clients.html'],['Relatórios','reports.html'],['Ocorrências','occurrences.html']]){const a=document.createElement('a');a.href='./'+file;a.textContent=label;if(location.pathname.endsWith('/'+file)){a.className='nav-current';a.setAttribute('aria-current','page');}nav.append(a);}}

 if(!document.querySelector('[data-team-link]')){const link=document.createElement('a');link.href='./team.html';link.textContent='Minha equipe';link.dataset.teamLink='true';if(location.pathname.endsWith('/team.html')){link.className='nav-current';link.setAttribute('aria-current','page');}document.querySelector('header nav')?.append(link);}
 if(member.role==='admin' && !document.querySelector('[data-admin-link]')){const link=document.createElement('a');link.href='./admin.html';link.textContent='Administração';link.dataset.adminLink='true';if(location.pathname.endsWith('/admin.html')){link.className='nav-current';link.setAttribute('aria-current','page');}document.querySelector('header nav')?.append(link);}
 const name=member.display_name?.trim() || 'Equipe';
 const el=document.querySelector('#user-name, #session-name');if(el)el.textContent=name;
 const role=document.querySelector('#user-role');if(role)role.textContent=member.is_super_admin?'Administrador geral':member.role==='admin'?'Administrador':'Equipe';
 const avatar=document.querySelector('#user-avatar');if(avatar)avatar.textContent=name.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
}
