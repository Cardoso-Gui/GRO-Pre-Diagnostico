const header=document.querySelector('header.unified-header');
if(header&&!header.querySelector('#profile-toggle')){
 const nav=header.querySelector('nav'),menu=header.querySelector('.user-menu');
 nav.id='home-navigation';
 const toggle=document.createElement('button');toggle.id='home-menu-toggle';toggle.className='home-menu-toggle';toggle.type='button';toggle.textContent='☰ Menu';toggle.setAttribute('aria-controls',nav.id);toggle.setAttribute('aria-expanded','false');nav.before(toggle);
 const profile=document.createElement('button');profile.id='profile-toggle';profile.className='profile-toggle';profile.type='button';profile.setAttribute('aria-label','Abrir perfil');profile.setAttribute('aria-controls','profile-panel');profile.setAttribute('aria-expanded','false');
 const avatar=menu.querySelector('.avatar');if(avatar)profile.append(avatar);
 const short=document.createElement('span');short.id='profile-short-name';profile.append(short);
 const chevron=document.createElement('span');chevron.className='profile-chevron';chevron.setAttribute('aria-hidden','true');profile.append(chevron);
 const panel=document.createElement('div');panel.id='profile-panel';panel.className='profile-panel';panel.hidden=true;panel.append(...menu.childNodes);menu.append(profile,panel);
 const name=panel.querySelector('#user-name, #session-name');
 const syncName=()=>{short.textContent=name?.textContent.trim().split(/\s+/)[0]||'Perfil';};syncName();if(name)new MutationObserver(syncName).observe(name,{childList:true,subtree:true,characterData:true});
 const closeNav=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');};
 const closeProfile=()=>{panel.hidden=true;profile.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',()=>{const open=!nav.classList.contains('is-open');closeProfile();nav.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));});
 profile.addEventListener('click',()=>{const open=panel.hidden;closeNav();panel.hidden=!open;profile.setAttribute('aria-expanded',String(open));});
 document.addEventListener('click',e=>{if(!menu.contains(e.target))closeProfile();if(!nav.contains(e.target)&&!toggle.contains(e.target))closeNav();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!panel.hidden){closeProfile();profile.focus();}else if(nav.classList.contains('is-open')){closeNav();toggle.focus();}}});
}
