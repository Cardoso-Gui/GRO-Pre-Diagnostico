// Screen controls operate on existing form events; application code still owns
// validation, access checks, saving and queries.
export function initScreenUX(doc = document) {
  const win = doc.defaultView;
  const make = (tag, text, cls) => {
    const el = doc.createElement(tag); el.textContent = text;
    if (cls) el.className = cls;
    return el;
  };
  const riskHelp=doc.querySelector('#risk-selection-section .dimension-intro');
  if(riskHelp&&!riskHelp.closest('details')){
    const detail=make('details','','quick-help');const summary=make('summary','Saiba mais sobre os critérios dos riscos');
    const intro=make('p','Selecione os riscos de cada grupo. A opção de ausência do eSocial não significa ausência de todos os riscos.','risk-selection-help');
    riskHelp.before(intro,detail);detail.append(summary,riskHelp);
  }
  for (const [container, ids] of [
    ['.team-filters', ['member-search', 'role-filter', 'status-filter', 'team-filter']],
    ['#users-section .access-filters', ['user-search', 'user-team-filter', 'user-role-filter', 'user-status-filter']],
    ['#teams-section .access-filters', ['team-search', 'team-status-filter']]
  ]) {
    const root = doc.querySelector(container); if (!root || root.querySelector('.filter-tools')) continue;
    const fields = ids.map(id => doc.getElementById(id)).filter(Boolean);
    const tools = make('div', '', 'filter-tools');
    const count = make('span', '', 'filter-count');
    const clear = make('button', 'Limpar filtros', 'secondary-button');clear.type = 'button';clear.hidden = true;
    const sync = () => {
      const active = fields.filter(field => field.value.trim()).length;
      count.textContent = active ? `${active} ${active === 1 ? 'filtro ativo' : 'filtros ativos'}` : 'Todos os registros carregados';
      clear.hidden = !active;
    };
    clear.addEventListener('click', () => {
      // Skip disabled controls; never alter role or membership edit forms.
      for (const field of fields) if (!field.disabled && field.value) {
        field.value = '';field.dispatchEvent(new win.Event(field.tagName === 'SELECT' ? 'change' : 'input', {bubbles:true}));
      }
      sync();fields.find(field => !field.disabled)?.focus();
    });
    fields.forEach(field => {field.addEventListener('input', sync);field.addEventListener('change', sync);});
    doc.addEventListener('gro:list-restored',sync);
    tools.append(count,clear);root.append(tools);sync();
  }

  const search = doc.querySelector('#report-search-form');
  if (search && !doc.querySelector('#report-filter-feedback')) {
    const feedback = make('p', '', 'filter-feedback');feedback.id = 'report-filter-feedback';feedback.setAttribute('role','status');search.after(feedback);
    const pending = () => {feedback.textContent = 'Filtros alterados. Clique em Pesquisar para atualizar a lista.';};
    search.addEventListener('input', pending);search.addEventListener('change', pending);
    search.addEventListener('submit', () => {feedback.textContent='';});
    doc.querySelector('#clear-filters')?.addEventListener('click', () => {feedback.textContent='';});
  }

  const editor = doc.querySelector('.risk-editor-page #editor');
  const riskNav = doc.querySelector('#risk-nav');
  if (editor && riskNav && !doc.querySelector('#risk-pending-tools')) {
    const tools = make('div', '', 'risk-pending-tools');tools.id='risk-pending-tools';
    const count = make('p', '', 'risk-pending-count');count.setAttribute('role','status');
    const next = make('button', 'Ir ao próximo pendente', 'secondary-button');next.type='button';
    const label = make('label', '', 'risk-pending-filter');
    const onlyPending = make('input','');onlyPending.type='checkbox';
    label.append(onlyPending,doc.createTextNode('Mostrar apenas pendentes'));
    tools.append(count,next,label);riskNav.before(tools);
    const sync = () => {
      const buttons = [...riskNav.querySelectorAll('button[data-risk-index]')];
      const remaining = buttons.filter(button => button.dataset.complete !== 'true');
      count.textContent = buttons.length ? `${remaining.length} de ${buttons.length} riscos ainda não preenchidos neste grupo` : '';
      next.disabled = remaining.length === 0;
      for (const button of buttons) button.hidden = onlyPending.checked && button.dataset.complete === 'true' && button.getAttribute('aria-current') !== 'true';
      for (const section of riskNav.querySelectorAll('section')) section.hidden = ![...section.querySelectorAll('button')].some(button=>!button.hidden);
    };
    onlyPending.addEventListener('change', sync);
    next.addEventListener('click', () => {
      const buttons = [...riskNav.querySelectorAll('button[data-risk-index]')];
      const active = buttons.findIndex(button=>button.getAttribute('aria-current')==='true');
      const ordered = [...buttons.slice(active+1), ...buttons.slice(0,active+1)];
      const pending = ordered.find(button=>button.dataset.complete!=='true'&&!button.disabled);
      if(pending){pending.click();doc.querySelector('#cards h2')?.focus();}
    });
    new win.MutationObserver(sync).observe(riskNav,{childList:true,subtree:true,attributes:true,attributeFilter:['data-complete','aria-current']});
    sync();
    const cards = doc.querySelector('#cards');
    const outline = make('nav', '', 'risk-form-outline');outline.setAttribute('aria-label','Seções do risco atual');cards.before(outline);
    const outlineSync = () => {
      outline.replaceChildren();
      cards.querySelectorAll('article > .section').forEach((section,i)=>{
        const title=section.querySelector('h3');if(!title)return;
        section.id=`risk-section-${i+1}`;
        const link=make('a',title.textContent.trim().replace(/^\d+\s*/,''));link.href='#'+section.id;
        link.addEventListener('click',()=>{title.tabIndex=-1;title.focus({preventScroll:true});});outline.append(link);
      });
    };
    new win.MutationObserver(outlineSync).observe(cards,{childList:true});outlineSync();
  }

  const description = doc.querySelector('#occ-form textarea[name="description"]');
  if(description && !doc.querySelector('#occ-description-count')) {
    const counter=make('small','','occ-description-count');counter.id='occ-description-count';
    const hint=make('p','Inclua o local, o que aconteceu e as providências tomadas.','occ-description-hint');hint.id='occ-description-hint';
    description.setAttribute('aria-describedby', [description.getAttribute('aria-describedby'),hint.id,counter.id].filter(Boolean).join(' '));
    description.after(counter,hint);
    const sync=()=>{counter.textContent=`${description.value.length} / ${description.maxLength} caracteres`;};
    description.addEventListener('input',sync);description.form.addEventListener('reset',()=>win.queueMicrotask(sync));sync();
  }
}
if (typeof document !== 'undefined') initScreenUX(document);
