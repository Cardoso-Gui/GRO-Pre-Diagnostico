export function organizeReport(content, answers) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const blocks = Array.from(content.querySelectorAll('.report-block'));
  const sectors = blocks.find(block => block.querySelector('h3')?.textContent.trim() === 'Setores e cargos');
  if (sectors && Array.isArray(answers.jobsBySector) && Array.isArray(answers.selectedSectors)) {
    const active = new Set(answers.selectedSectors);
    const container = make('div', 'report-sector-list');
    for (const [sector, jobs] of answers.jobsBySector) {
      if (!active.has(sector)) continue;
      const group = make('section', 'report-sector');
      group.append(make('h4', 'report-sector-title', sector));
      for (const job of jobs) {
        const card = make('article', 'report-job');
        const heading = make('div', 'report-job-heading');
        heading.append(make('strong', '', job.name), make('span', 'report-job-count', `${job.quantity} funcionário(s)`));
        card.append(heading, make('span', 'report-field-label', 'Atividades desenvolvidas'), make('p', '', job.activities || 'Não informadas'));
        if (job.foodHandling) card.append(make('p', '', 'Condição da atividade: Manipulação de alimentos — controle sanitário'));
        group.append(card);
      }
      container.append(group);
    }
    if (container.children.length) {
      sectors.querySelector('.report-card-list')?.replaceWith(container);
    }
  }
  const details = blocks.find(block => ['Fontes geradoras', 'Detalhamento dos riscos'].includes(block.querySelector('h3')?.textContent.trim()));
  if (details) {
    const recommendations = make('section', 'report-block report-recommendations');
    recommendations.append(make('h3', '', 'Pendências e recomendações'));
    const measurements = make('div', 'report-recommendation-group');
    const improvements = make('div', 'report-recommendation-group');
    measurements.append(make('h4', '', 'Medições e avaliações necessárias'));
    improvements.append(make('h4', '', 'Melhorias propostas na visita'));
    let target = '';
    for (const item of details.querySelector('.report-card-list')?.children || []) {
      if (item.tagName === 'H4') { target = item.textContent; continue; }
      if (!item.classList.contains('report-mini-card')) continue;
      const values = new Map(Array.from(item.querySelectorAll('small')).map(line => {
        const index = line.textContent.indexOf(':');
        return [line.textContent.slice(0,index),line.textContent.slice(index+1).trim()];
      }));
      const risk = item.querySelector('strong')?.textContent || 'Risco';
      const add = (group, text) => {
        const card = make('article','report-mini-card');
        card.append(make('strong','',risk),make('span','',target),make('p','',text));
        group.append(card);
      };
      if (values.get('Precisa medir/avaliar') === 'Sim') add(measurements,values.get('Fonte/situação') || 'Medição/avaliação indicada no levantamento.');
      const improvement = values.get('Melhorias propostas');
      if (improvement && improvement !== '-') add(improvements,improvement);
    }
    if (measurements.children.length === 1) measurements.append(make('p','','Nenhuma medição ou avaliação marcada como necessária.'));
    if (improvements.children.length === 1) improvements.append(make('p','','Nenhuma melhoria registrada no levantamento.'));
    recommendations.append(measurements,improvements);
    const pending = blocks.find(block => block.querySelector('h3')?.textContent.trim() === 'Pendências para validação técnica');
    if (pending) pending.replaceWith(recommendations); else details.after(recommendations);
    details.querySelector('h3').textContent = 'Detalhamento dos riscos';
    for (const card of details.querySelectorAll('.report-mini-card')) {
      card.classList.add('report-risk-detail');
      for (const line of Array.from(card.children).filter(child => child.tagName === 'SMALL')) {
        const text = line.textContent;
        const separator = text.indexOf(':');
        if (separator < 0) continue;
        const field = make('div', 'report-detail-field');
        field.append(make('strong', 'report-field-label', text.slice(0, separator)), make('p', '', text.slice(separator + 1).trim()));
        line.replaceWith(field);
      }
    }
  }
  const combined = blocks.find(block => block.querySelector('h3')?.textContent.trim() === 'EPIs e treinamentos sugeridos');
  if (combined) {
    const training = make('section','report-block');
    training.append(make('h3','','Treinamentos sugeridos'),make('p','','Sugestões conforme os dados do levantamento, sujeitas à validação do responsável técnico.'));
    const list = make('div','report-card-list');
    let target = '',lastTarget = null;
    for (const item of Array.from(combined.querySelector('.report-card-list')?.children || [])) {
      if (item.tagName === 'H4') { target = item.textContent; continue; }
      if (item.querySelector('strong')?.textContent === 'EPIs') continue;
      if (lastTarget !== target) {list.append(make('h4','',target));lastTarget=target;}
      list.append(item);
    }
    combined.querySelector('h3').textContent='EPIs informados';
    if (!list.children.length) list.append(make('p','','Nenhum treinamento sugerido neste levantamento.'));
    training.append(list);combined.after(training);
  }
}
