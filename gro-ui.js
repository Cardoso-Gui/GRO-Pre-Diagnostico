// Presentation-only enhancements; never read or write application records.
// Also clear transient list queries when leaving from another work area.
document.querySelector('#sign-out')?.addEventListener('click',()=>{
  try{
    const storage=globalThis.sessionStorage;
    for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(key?.startsWith('gro-list-v1:'))storage.removeItem(key);}
  }catch{}
});
const header = document.querySelector('header.unified-header');
if (header) {
  const nav = header.querySelector('nav');
  const toggle = header.querySelector('#home-menu-toggle');
  const profile = header.querySelector('#profile-toggle');
  const panel = header.querySelector('#profile-panel');
  const closeNavigation = () => {
    nav?.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (nav?.classList.contains('is-open')) {
      closeNavigation();
      toggle?.focus();
    }
    if (panel && !panel.hidden) {
      panel.hidden = true;
      profile?.setAttribute('aria-expanded', 'false');
      profile?.focus();
    }
  });
  nav?.addEventListener('click', event => {
    if (event.target.closest('a')) closeNavigation();
  });
  // A closed mobile menu must not reappear after resizing to desktop and back.
  const desktop = matchMedia('(min-width: 1101px)');
  desktop.addEventListener('change', closeNavigation);
  const main = document.querySelector('main, .wizard-shell');
  if (main && !document.querySelector('.skip-link')) {
    if (!main.id) main.id = 'main-content';
    const skip = document.createElement('a');
    skip.className = 'skip-link';
    skip.href = '#' + main.id;
    skip.textContent = 'Ir para o conteúdo';
    document.body.prepend(skip);
  }
}

const filter = document.querySelector('#draft-filter');
const list = document.querySelector('#draft-list');
const filterBar = document.querySelector('.draft-filter');
if (filter && list && filterBar) {
  const clear = document.querySelector('#clear-draft-filter');
  const status = document.querySelector('#draft-filter-status');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const applyFilter = () => {
    const rows = [...list.querySelectorAll('.draft-row')];
    filterBar.hidden = rows.length === 0 && !filter.value;
    const query = normalize(filter.value.trim());
    let visible = 0;
    for (const row of rows) {
      row.hidden = query !== '' && !normalize(row.textContent).includes(query);
      if (!row.hidden) visible++;
    }
    clear.hidden = filter.value === '';
    status.textContent = query ? (visible ? `${visible} de ${rows.length} rascunhos exibidos.` : 'Nenhum rascunho corresponde à busca.') : '';
  };
  filter.addEventListener('input', applyFilter);
  clear.addEventListener('click', () => { filter.value = ''; applyFilter(); filter.focus(); });
  new MutationObserver(applyFilter).observe(list, {childList: true, subtree: true, characterData: true});
  applyFilter();
}
