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
}
