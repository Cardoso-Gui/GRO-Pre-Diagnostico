const form = document.querySelector("#cnpj-form");
const input = document.querySelector("#cnpj-input");
const button = document.querySelector("#search-button");
const message = document.querySelector("#form-message");
const companyCard = document.querySelector("#company-card");
const saveDraftButton = document.querySelector("#save-draft-button");
const loadDraftButton = document.querySelector("#load-draft-button");
const clearDraftButton = document.querySelector("#clear-draft-button");
const dimensionForm = document.querySelector("#dimension-form");
const employeeCountInput = document.querySelector("#employee-count");
const riskGradeOutput = document.querySelector("#risk-grade-output");
const dimensionResults = document.querySelector("#dimension-results");
const sectorOptions = document.querySelector("#sector-options");
const customSectorForm = document.querySelector("#custom-sector-form");
const customSectorInput = document.querySelector("#custom-sector-input");
const selectedSectors = document.querySelector("#selected-sectors");
const selectedSectorList = document.querySelector("#selected-sector-list");
const jobsSection = document.querySelector("#jobs-section");
const jobsGrid = document.querySelector("#jobs-grid");
const riskModeSection = document.querySelector("#risk-mode-section");
const riskModeForm = document.querySelector("#risk-mode-form");
const riskModeSummary = document.querySelector("#risk-mode-summary");
const riskModeTitle = document.querySelector("#risk-mode-title");
const riskModeDescription = document.querySelector("#risk-mode-description");
const riskSelectionSection = document.querySelector("#risk-selection-section");
cots.map((part) => normalizeSectorName(String(part))).join("__");
}

function getSelectableRisks() {
  return occupationalRiskSource;
}

function renderRiskSourceSection() {
  const selections = getRiskSelections().filter(item => item.risk.code !== "09.01.001");
  riskSourceGrid.replaceChildren();riskSourceSection.hidden = selections.length === 0;
  if(selections.length){
    const note=document.createElement('p');note.textContent='Preencha exposição, danos, medidas existentes e melhorias em uma página dedicada.';
    const button=document.createElement('button');button.type='button';button.id='open-risk-details';button.textContent='Preencher detalhes dos riscos';
    button.onclick=async()=>{if(!globalThis.GRO_CLOUD)return;if(!GRO_VALIDATE.show(getReportMissingFields(true).filter(item=>item.section!=='Detalhamento dos riscos').map(item=>({...item,element:document.querySelector(item.destination)}))))return;button.disabled=true;try{const saved=await globalThis.GRO_CLOUD.save(getDraft());if(saved)location.assign('./risk-detail.html?id='+encodeURIComponent(saved.id)+'&target='+encodeURIComponent(button.dataset.target||'')+'&risk='+encodeURIComponent(button.dataset.risk||''));}finally{button.disabled=false}};
    riskSourceGrid.append(note,button);
  }
  renderEpiSection();
}

function getRiskSelections() {
  const targets = getRiskTargets();
  const selectableRisks = getSelectableRisks();

  return targets.flatMap((target) => {
    const selectedCodes = getSelectedRiskCodes(target.id);

    return selectableRisks
      .filter((risk) => selectedCodes.has(risk.code))
      .map((risk) => ({
        targetId: target.id,
        targetTitle: target.title,
        targetContext: target.context,
        risk,
      }));
  });
}

function createRiskSourceCard(selection) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  const meta = document.createElement("small");
  const fields = document.createElement("div");
  const sourceLabel = document.createElement("label");
  const sourceInput = document.createElement("input");
  const noteLabel = document.createElement("label");
  const noteInput = document.createElement("input");
  const measure = document.createElement("div");
  const measureTitle = document.createElement("span");
  const measureOptions = document.createElement("div");
  const sourceData = getRiskSourceData(selection.targetId, selection.risk.code);

  card.className = "risk-source-card";
  fields.className = "risk-source-fields";
  measure.className = "measure-toggle";
  measureOptions.className = "measure-options";

  title.textContent = selection.risk.name;
  meta.textContent = `${selection.risk.code} - ${selection.risk.group}`;

  sourceLabel.textContent = "Fonte geradora / situação";
  sourceInput.type = "text";
  sourceInput.placeholder = "Ex.: headset, máquina, escada, produto de limpeza";
  sourceInput.value = sourceData.source;
  sourceInput.addEventListener("input", () => {
    sourceData.source = sourceInput.value;
  });

  noteLabel.textContent = "Observação";
  noteInput.type = "text";
  noteInput.placeholder = "Ex.: uso diário no atendimento";
  noteInput.value = sourceData.note;
  noteInput.addEventListener("input", () => {
    sourceData.note = noteInput.value;
  });

  measureTitle.textContent = "Precisa medir/avaliar?";
  measureOptions.appendChild(createMeasureOption(selection, "Sim", sourceData));
  measureOptions.appendChild(createMeasureOption(selection, "Não", sourceData));

  sourceLabel.appendChild(sourceInput);
  noteLabel.appendChild(noteInput);
  measure.appendChild(measureTitle);
  measure.appendChild(measureOptions);
  fields.appendChild(sourceLabel);
  fields.appendChild(noteLabel);
  fields.appendChild(measure);
  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(fields);

  return card;
}

function createMeasureOption(selection, value, sourceData) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const text = document.createElement("span");
  const name = createTargetId("measure", selection.targetId, selection.risk.code);

  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = sourceData.measure === value;
  input.addEventListener("change", () => {
    sourceData.measure = value;
  });
  text.textContent = value;

  label.appendChild(input);
  label.appendChild(text);

  return label;
}

function getRiskSourceData(targetId, riskCode) {
  const key = createTargetId("source", targetId, riskCode);

  if (!riskSourcesBySelection.has(key)) {
    riskSourcesBySelection.set(key, {
      source: "",
      note: "",
      measure: "",
    });
  }

  return riskSourcesBySelection.get(key);
}

function renderGheAssociationOptions() {
  const availableJobs = getAvailableJobsForGhe();
  gheAssociationList.innerHTML = "";

  if (availableJobs.length === 0) {
    const empty = document.createElement("p");
    empty.className = "risk-card-note";
    empty.textContent = "Adicione cargos aos setores antes de criar um GHE.";
    gheAssociationList.appendChild(empty);
    return;
  }

  availableJobs.forEach((job) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");
    const jobName = document.createElement("strong");
    const sectorName = document.createElement("small");

    label.className = "ghe-association-option";
    checkbox.type = "checkbox";
    checkbox.value = job.id;
    checkbox.dataset.sector = job.sectorName;
    checkbox.dataset.job = job.jobName;
    jobName.textContent = job.jobName;
    sectorName.textContent = `${job.sectorName} - ${job.quantity} funcionário(s)`;

    text.appendChild(jobName);
    text.appendChild(sectorName);
    label.appendChild(checkbox);
    label.appendChild(text);
    gheAssociationList.appendChild(label);
  });
}

function getAvailableJobsForGhe() {
  return Array.from(jobsBySector.entries()).flatMap(([sectorName, jobs]) =>
    jobs.map((job) => ({
      id: createTargetId("ghe-link", sectorName, job.name),
      sectorName,
      jobName: job.name,
      quantity: job.quantity,
    }))
  );
}

function getCheckedGheAssociations() {
  return Array.from(gheAssociationList.querySelectorAll("input:checked")).map((checkbox) => ({
    sectorName: checkbox.dataset.sector,
    jobName: checkbox.dataset.job,
  }));
}

function clearGheAssociations() {
  gheAssociationList.querySelectorAll("input:checked").forEach((checkbox) => {
    checkbox.checked = false;
  });
}

function formatGheLinks(linkedJobs) {
  return linkedJobs
    .map((item) => `${item.jobName} (${item.sectorName})`)
    .join(", ");
}

function renderEpiSection() {
  epiGrid.replaceChildren();
  epiSection.hidden = true;
  updateReportAvailability();
}

function createEpiCard(selection) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  const meta = document.createElement("small");
  const toggle = document.createElement("div");
  const toggleTitle = document.createElement("span");
  const toggleOptions = document.createElement("div");
  const form = document.createElement("form");
  const input = document.createElement("input");
  const button = document.createElement("button");
  const list = document.createElement("div");
  const epiData = getEpiData(selection.targetId, selection.risk.code);

  card.className = "epi-card";
  toggle.className = "measure-toggle";
  toggleOptions.className = "measure-options";
  form.className = "epi-form";
  list.className = "epi-list";

  title.textContent = selection.risk.name;
  meta.textContent = `${selection.risk.code} - ${selection.risk.group}`;
  toggleTitle.textContent = "EPI aplicável?";

  toggleOptions.appendChild(createEpiApplicabilityOption(selection, "Sim", epiData, form, list));
  toggleOptions.appendChild(createEpiApplicabilityOption(selection, "Não", epiData, form, list));

  input.type = "text";
  input.placeholder = "Ex.: protetor auditivo, luva nitrílica";
  button.type = "submit";
  button.textContent = "Adicionar EPI";

  form.hidden = epiData.applicable !== "Sim";
  form.appendChild(input);
  form.appendChild(button);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addEpi(selection.targetId, selection.risk.code, input.value);
    input.value = "";
    renderEpiList(epiData, list);
  });

  toggle.appendChild(toggleTitle);
  toggle.appendChild(toggleOptions);
  card.appendChild(title);
  card.appendChild(meta);
  card.appendChild(toggle);
  card.appendChild(form);
  renderEpiList(epiData, list);
  card.appendChild(list);

  return card;
}

function createEpiApplicabilityOption(selection, value, epiData, form, list) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  const text = document.createElement("span");
  const name = createTargetId("epi", selection.targetId, selection.risk.code);

  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = epiData.applicable === value;
  input.addEventListener("change", () => {
    epiData.applicable = value;
    form.hidden = value !== "Sim";

    if (value !== "Sim") {
      epiData.items = [];
      renderEpiList(epiData, list);
    }

    updateReportAvailability();
  });
  text.textContent = value;

  label.appendChild(input);
  label.appendChild(text);

  return label;
}

function renderEpiList(epiData, container) {
  container.innerHTML = "";

  epiData.items.forEach((epi) => {
    const pill = document.createElement("span");
    const removeButton = document.createElement("button");

    pill.className = "epi-pill";
    pill.append(epi);
    removeButton.type = "button";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      epiData.items = epiData.items.filter((item) => item !== epi);
      renderEpiList(epiData, container);
      updateReportAvailability();
    });

    pill.appendChild(removeButton);
    container.appendChild(pill);
  });
}

function addEpi(targetId, riskCode, epiName) {
  const epiData = getEpiData(targetId, riskCode);
  const cleanName = epiName.trim();

  if (!cleanName) {
    return;
  }

  const exists = epiData.items.some((item) => normalizeSectorName(item) === normalizeSectorName(cleanName));

  if (!exists) {
    epiData.items.push(cleanName);
  }

  updateReportAvailability();
}

function getEpiData(targetId, riskCode) {
  const key = createTargetId("epi-data", targetId, riskCode);

  if (!epiBySelection.has(key)) {
    epiBySelection.set(key, {
      applicable: "",
      items: [],
    });
  }

  return epiBySelection.get(key);
}

function updateReportAvailability() {
  finalReportSection.hidden = getRiskSelections().length === 0;
}

function getTrainingSuggestions(selections) {
  selections = selections.filter(item => item.risk.code !== "09.01.001");
  const suggestions = new Map();

  TRAINING_RULES.forEach((rule) => {
    const matches = getTrainingRuleMatches(rule, selections);

    if (matches.length > 0) {
      suggestions.set(rule.id, {
        title: rule.title,
        reason: rule.reason,
        matches,
      });
    }
  });

  return Array.from(suggestions.values());
}

function getTrainingRuleMatches(rule, selections) {
  const matches = [];
  const cnaeText = getCurrentCnaeText();

  if (rule.cnaePrefixes?.some((prefix) => cnaeText.digits.startsWith(prefix))) {
    matches.push("CNAE da empresa");
  }

  selections.forEach((selection) => {
    const risk = selection.risk;
    const sourceData = getRiskSourceData(selection.targetId, risk.code);
    const epiData = getEpiData(selection.targetId, risk.code);
    const searchableText = normalizeSectorName([
      risk.code,
      risk.group,
      risk.name,
      selection.targetTitle,
      selection.targetContext,
      sourceData.source,
      sourceData.note,
      cnaeText.description,
    ].join(" "));

    if (rule.riskCodes?.includes(risk.code)) {
      matches.push(risk.name);
    }

    if (rule.riskGroups?.includes(risk.group)) {
      matches.push(risk.group);
    }

    if (rule.keywords?.some((keyword) => searchableText.includes(normalizeSectorName(keyword)))) {
      matches.push(risk.name);
    }

    if (rule.requiresEpi && epiData.applicable === "Sim") {
      matches.push("EPI aplicável informado");
    }
  });

  return [...new Set(matches)];
}

function getCurrentCnaeText() {
  return {
    digits: String(currentCompany?.cnae_fiscal || "").replace(/\D/g, ""),
    description: currentCompany?.cnae_fiscal_descricao || "",
  };
}

function getReportMissingFields(detailed = false) {
  const missing = [];
  let section = "Dados da empresa", destination = "#company-card", riskTarget = "", riskCode = "";
  const add = text => missing.push({text, section, destination, riskTarget, riskCode});
  const filled = value => String(value ?? "").trim().length > 0;
  const employees = Number(employeeCountInput.value);
  if (!currentCompany) add("Selecione a empresa.");
  section = "Dimensionamento"; destination = "#employee-count";
  if (!Number.isInteger(employees) || employees < 1) add("Informe o número de funcionários.");
  section = "Setores e cargos"; destination = "#sectors-title";
  if (!selectedSectorNames.size) add("Adicione os setores e cargos.");
  let total = 0;
  selectedSectorNames.forEach(sector => {
    const jobs = jobsBySector.get(sector) || [];
    if (!jobs.length) add(`${sector}: adicione pelo menos um cargo.`);
    jobs.forEach(job => {
      total += Number(job.quantity) || 0;
      if (!filled(job.name) || !Number.isInteger(Number(job.quantity)) || Number(job.quantity) < 1) add(`${sector}: confira nome e quantidade do cargo.`);
      if (!filled(job.activities)) add(`${sector} / ${job.name}: descreva as atividades.`);
      if (selectedRiskMode === "ghe" && !gheList.some(g => g.linkedJobs?.some(j => j.sectorName === sector && j.jobName === job.name))) add(`${sector} / ${job.name}: vincule o cargo a um GHE.`);
    });
  });
  if (total !== employees) add("A quantidade distribuída nos cargos deve corresponder ao total de funcionários.");
  section = "Organização dos riscos"; destination = "#risk-mode-section";
  if (!["ghe", "job"].includes(selectedRiskMode)) add("Escolha a organização por cargo ou GHE.");
  const targets = getRiskTargets();
  if (!targets.length) add("Cadastre os cargos ou GHEs para organizar os riscos.");
  section = "Riscos ocupacionais"; destination = "#risk-selection-section";
  targets.forEach(target => {
    if (!getSelectedRiskCodes(target.id).size) add(`${target.title}: selecione os riscos ou a opção de ausência aplicável.`);
  });
  section = "Dimensionamento"; destination = "#employee-count";
  if (/pendente|necessária/i.test(dimensionFields.cipaSummary.textContent) || /pendente/i.test(dimensionFields.sesmtSummary.textContent)) add("Calcule ou revise o dimensionamento.");
  getRiskSelections().filter(s => s.risk.code !== "09.01.001").forEach(selection => {
    section = "Detalhamento dos riscos"; destination = "#open-risk-details"; riskTarget = selection.targetId; riskCode = selection.risk.code;
    const data = getRiskSourceData(selection.targetId, selection.risk.code);
    const prefix = `${selection.targetTitle} / ${selection.risk.name}`;
    const fields = {source:"fonte ou situação de exposição", frequency:"frequência", duration:"tempo ou circunstância", damage:"possíveis danos ou consequências", measures:"medidas existentes (informe se não houver)"};
    Object.entries(fields).forEach(([key, label]) => { if (!filled(data[key])) add(`${prefix}: ${label}.`); });
    if (!["Sim", "Não"].includes(data.measure)) add(`${prefix}: responda se precisa medir/avaliar.`);
    {
      const epi = getEpiData(selection.targetId, selection.risk.code);
      if (!["Sim", "Não"].includes(epi.applicable)) add(`${prefix}: informe se EPI é aplicável.`);
      if (epi.applicable === "Sim" && !epi.items?.some(filled)) add(`${prefix}: informe quais EPIs.`);
    }
  });
  return detailed ? missing : missing.map(item => item.text);
}

function validateReport() {
  let notice = document.querySelector("#report-validation");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "report-validation";
    notice.setAttribute("role", "alert");
    notice.tabIndex = -1;
    generateReportButton.before(notice);
  }
  notice.replaceChildren();
  const missing = getReportMissingFields(true);
  if(globalThis.GRO_POSTS?.busy())missing.push({text:'Aguarde o envio das fotos terminar.',section:'Postos de trabalho',destination:'#jobs-section'});
  for(const [sector,jobs] of jobsBySector){
    if(!selectedSectorNames.has(sector))continue;
    for(const job of jobs)for(const post of job.workstations||[]){
      const missingName=!post.name?.trim(), missingPhoto=!(post.photoPaths?.length||post.photoPath);
      if(!missingName&&!missingPhoto)continue;
      const instruction=missingName&&missingPhoto
        ? 'informe o nome e adicione a foto do posto de trabalho, ou remova o posto vazio.'
        : missingName ? 'informe o nome do posto de trabalho.' : `adicione a foto do posto de trabalho “${post.name.trim()}”.`;
      missing.push({text:`${sector} / ${job.name}: ${instruction}`,section:'Postos de trabalho',destination:'#jobs-section'});
    }
  }
  notice.hidden = missing.length === 0;
  if (!missing.length) return true;
  finalReport.hidden = true;
  finalReport.replaceChildren();
  printReportButton.hidden = true;
  const title = document.createElement("h3");
  title.textContent = "Preencha os campos obrigatórios para gerar o relatório";
  const list = document.createElement("ul");
  missing.forEach(({text, section, destination, riskTarget, riskCode}) => {
    const item = document.createElement("li");
    const description = document.createElement("span"); description.textContent = text;
    const action = document.createElement("button"); action.type = "button";
    action.textContent = section === "Detalhamento dos riscos" ? "Abrir detalhes dos riscos" : "Ir para " + section.toLowerCase();
    if (section === "Detalhamento dos riscos") {
      action.replaceChildren(document.createTextNode("Abrir detalhes"), document.createElement("br"), document.createTextNode("dos riscos"));
    }
    action.onclick = () => {
      const target = document.querySelector(destination);
      if (!target) return;
      if (destination === "#open-risk-details") { target.dataset.target = riskTarget; target.dataset.risk = riskCode; target.click(); return; }
      const field=target.matches('input,select,textarea')?target:[...target.querySelectorAll('input,select,textarea')].find(el=>el.getClientRects().length&&(!el.validity.valid||!el.value.trim()));if(field){field.scrollIntoView({block:'center',behavior:'smooth'});field.setAttribute('aria-invalid','true');field.focus({preventScroll:true});field.addEventListener('input',()=>field.removeAttribute('aria-invalid'),{once:true});return;}target.scrollIntoView({block:"center",behavior:"smooth"});
      if (!target.matches("input,select,button,a,textarea")) target.tabIndex = -1;
      target.focus({preventScroll:true});
    };
    item.append(action, description); list.appendChild(item);
  });
  notice.append(title, list);
  GRO_VALIDATE.show(missing.map((item,i)=>({text:item.text,go:()=>notice.querySelectorAll('button')[i].click()})));
  return false;
}

async function renderFinalReport() {
  if (!validateReport()) return;
  const selections = getRiskSelections();
  finalReport.innerHTML = "";
  finalReport.hidden = true;
  printReportButton.hidden = true;

  finalReport.appendChild(createReportCover());
  finalReport.appendChild(createCompanyReportBlock());
  finalReport.appendChild(createDimensionReportBlock());
  finalReport.appendChild(createSectorJobReportBlock());
  finalReport.appendChild(createIdentifiedRiskReportBlock(selections));
  finalReport.appendChild(createRiskSourceReportBlock(selections));
  finalReport.appendChild(createEpiTrainingReportBlock(selections));
  finalReport.appendChild(createNrReportBlock(selections));
  finalReport.appendChild(createTechnicalPendingReportBlock(selections));
  const serialize=node=>node.nodeType===3?{text:node.textContent}:{tag:node.tagName.toLowerCase(),className:node.className,children:Array.from(node.childNodes,serialize)};
  const answers=getDraft();
  answers.report_document={version:1,children:Array.from(finalReport.childNodes,serialize)};
  if(globalThis.GRO_CLOUD?.complete)await globalThis.GRO_CLOUD.complete(answers);
}

function createCompanyReportBlock() {
  const block = createReportBlock("Dados da empresa");
  const list = document.createElement("ul");

  list.className = "report-list";
  addReportItem(list, `Razão social: ${fields.legalName.textContent}`);
  addReportItem(list, `Nome fantasia: ${fields.tradeName.textContent}`);
  addReportItem(list, `CNAE principal: ${fields.mainCnae.textContent}`);
  addReportItem(list, `Endereço: ${fields.address.textContent}`);
  addReportItem(list, `Contato: ${fields.contact.textContent}`);
  block.appendChild(list);

  return block;
}

function createReportCover() {
  const cover = document.createElement("section");
  const label = document.createElement("span");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const summary = document.createElement("div");

  cover.className = "report-cover";
  summary.className = "report-summary-grid";
  label.textContent = "Levantamento inicial";
  title.textContent = fields.companyName.textContent || "Relatório preliminar de SST";
  description.textContent =
    "Este relatório consolida as informações coletadas no questionário. Ele não substitui PGR, PCMSO, LTCAT, laudos técnicos, avaliações quantitativas ou validação dos responsáveis técnicos.";

  summary.appendChild(createReportSummaryItem("CNPJ", formatCnpj(input.value) || "-"));
  summary.appendChild(createReportSummaryItem("Funcionários", employeeCountInput.value || "-"));
  summary.appendChild(createReportSummaryItem("Grau de risco", riskGradeOutput.textContent || "-"));
  summary.appendChild(createReportSummaryItem("Organização", getRiskModeLabel() || "-"));
  summary.appendChild(createReportSummaryItem("Gerado em", new Date().toLocaleDateString("pt-BR")));

  cover.appendChild(label);
  cover.appendChild(title);
  cover.appendChild(description);
  cover.appendChild(summary);

  return cover;
}

function createReportSummaryItem(label, value) {
  const item = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");

  item.className = "report-summary-item";
  labelElement.textContent = label;
  valueElement.textContent = value;
  item.appendChild(labelElement);
  item.appendChild(valueElement);

  return item;
}

function getRiskModeLabel() {
  const labels = {
    ghe: "Por GHE",
    job: "Por cargo (avulso)",

  };

  return labels[selectedRiskMode] || "";
}

function createDimensionReportBlock() {
  const block = createReportBlock("Dimensionamento CIPA/SESMT");
  const list = document.createElement("ul");

  list.className = "report-list";
  addReportItem(list, `Funcionários informados: ${employeeCountInput.value || "-"}`);
  addReportItem(list, `Grau de risco: ${riskGradeOutput.textContent}`);
  addReportItem(list, `CIPA: ${dimensionFields.cipaSummary.textContent} - ${dimensionFields.cipaNote.textContent}`);
  addReportItem(list, `SESMT: ${dimensionFields.sesmtSummary.textContent}`);
  Array.from(dimensionFields.sesmtList.children).forEach((item) => {
    addReportItem(list, `SESMT: ${item.textContent}`);
  });
  block.appendChild(list);

  return block;
}

function createSectorJobReportBlock() {
  const block = createReportBlock("Setores e cargos");
  const container = document.createElement("div");

  container.className = "report-card-list";

  Array.from(selectedSectorNames).forEach((sectorName) => {
    const jobs = jobsBySector.get(sectorName) || [];
    const card = createReportMiniCard(
      sectorName,
      jobs.length ? `${jobs.length} cargo(s) cadastrado(s)` : "Nenhum cargo cadastrado",
      jobs.map((job) => `${job.name} - ${job.quantity} funcionário(s)${job.activities ? " — Atividades: " + job.activities : ""}${job.foodHandling === true ? " — Condição da atividade: Manipulação de alimentos — controle sanitário" : ""}`)
    );
    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.appendChild(createReportMiniCard("Nenhum setor informado", "", ["Preencha os setores para consolidar esta seção."]));
  }

  block.appendChild(container);

  return block;
}

function createIdentifiedRiskReportBlock(selections) {
  const block = createReportBlock("Riscos identificados");
  const container = document.createElement("div");

  container.className = "report-card-list";
  groupSelectionsByTarget(selections).forEach((group) => {
    const risks = group.selections.map((selection) => `${selection.risk.code} - ${selection.risk.name}`);
    container.appendChild(createReportMiniCard(group.title, `${risks.length} risco(s) selecionado(s)`, risks));
  });

  if (container.children.length === 0) {
    container.appendChild(createReportMiniCard("Nenhum risco informado", "", ["Selecione riscos para consolidar esta seção."]));
  }

  block.appendChild(container);

  return block;
}

function createRiskSourceReportBlock(selections) {
  const block = createReportBlock("Fontes geradoras");
  const container = document.createElement("div");

  container.className = "report-card-list";
  groupSelectionsByTarget(selections).forEach((group) => {
    const groupTitle = document.createElement("h4");
    groupTitle.textContent = group.title;
    container.appendChild(groupTitle);

    group.selections.forEach((selection) => {
      const sourceData = getRiskSourceData(selection.targetId, selection.risk.code);
      const card = createReportMiniCard(
        selection.risk.name,
        `${selection.risk.code} - ${selection.risk.group}`,
        [
          `Fonte/situação: ${sourceData.source || "-"}`,
          `Observação: ${sourceData.note || "-"}`,
          `Frequência: ${sourceData.frequency || "-"}`,
          `Tempo/circunstância: ${sourceData.duration || "-"}`,
          `Possíveis danos/consequências: ${sourceData.damage || "-"}`,
          `Medidas existentes: ${sourceData.measures || "-"}`,
          `Tipos de proteção: ${["Proteção coletiva", "Procedimentos e organização", "EPI"].filter((_, index) => sourceData.controls?.[index]).join(", ") || "Não informados"}`,
          `Melhorias propostas: ${sourceData.improve || "-"}`,
          `Precisa medir/avaliar: ${sourceData.measure || "-"}`,
        ]
      );
      container.appendChild(card);
    });
  });
  block.appendChild(container);

  return block;
}

function createTechnicalPendingReportBlock(selections) {
  const block = createReportBlock("Pendências para validação técnica");
  const list = document.createElement("ul");
  const pending = selections.filter((selection) => {
    const sourceData = getRiskSourceData(selection.targetId, selection.risk.code);
    return sourceData.measure === "Sim";
  });

  list.className = "report-list";

  if (pending.length === 0) {
    addReportItem(list, "Nenhuma medição/avaliação marcada como necessária neste levantamento.");
  } else {
    pending.forEach((selection) => {
      const sourceData = getRiskSourceData(selection.targetId, selection.risk.code);
      addReportItem(list, `${formatTargetGroupTitle(selection)} - ${selection.risk.name}: ${sourceData.source || "fonte não informada"}`);
    });
  }

  block.appendChild(list);

  return block;
}

function createEpiTrainingReportBlock(selections) {
  const block = createReportBlock("EPIs e treinamentos sugeridos");
  const container = document.createElement("div");

  container.className = "report-card-list";
  groupSelectionsByTarget(selections).forEach((group) => {
    const title = document.createElement("h4");
    const suggestions = getTrainingSuggestions(group.selections);
    const epiLines = getEpiReportLines(group.selections);

    title.textContent = group.title;
    container.appendChild(title);

    container.appendChild(createReportMiniCard(
      "EPIs",
      epiLines.length ? "EPIs informados no levantamento" : "Nenhum EPI aplicável informado",
      epiLines.length ? epiLines : ["Validar necessidade de EPI com o responsável técnico."]
    ));

    if (suggestions.length === 0) {
      container.appendChild(createReportMiniCard("Treinamentos", "Sem sugestão pré-cadastrada", ["Validar necessidade com o responsável técnico."]));
      return;
    }

    suggestions.forEach((training) => {
      container.appendChild(createReportMiniCard(`Treinamento: ${training.title}`, training.reason, [`Sugerido por: ${training.matches.join(", ")}`]));
    });
  });
  block.appendChild(container);

  return block;
}

function getEpiReportLines(selections) {
  return selections.flatMap((selection) => {
    const epiData = getEpiData(selection.targetId, selection.risk.code);

    if (epiData.applicable !== "Sim") {
      return [];
    }

    return [`${selection.risk.name}: ${epiData.items.join(", ") || "EPI aplicável, mas não informado"}`];
  });
}

function createNrReportBlock(selections) {
  const block = createReportBlock("NRs identificadas no levantamento");
  const note = document.createElement("p");
  note.textContent = "Normas gerais e normas com critérios identificados nos dados informados. Confirme o enquadramento e os requisitos com o responsável técnico; a ausência nesta lista não representa dispensa.";
  block.appendChild(note);
  const container = document.createElement("div");

  container.className = "report-card-list";
  getNrReportItems(selections)
    .filter((item) => ["Aplicável geral", "Aplicável", "Critério identificado"].includes(item.status))
    .forEach((item) => {
      const card = createReportMiniCard(`${item.nr} - ${item.title}`, item.reason, []);
      const status = document.createElement("span");
      status.className = "nr-status";
      if (item.status === "Verificar") {
        status.classList.add("is-warning");
      } else if (item.status === "Não dimensionado") {
        status.classList.add("is-neutral");
      } else {
        status.classList.add("is-ok");
      }
      status.textContent = item.status;
      card.prepend(status);
      container.appendChild(card);
    });

  if (container.children.length === 0) {
    container.appendChild(createReportMiniCard("Nenhuma NR aplicável identificada", "", ["Revise o levantamento ou valide com o responsável técnico."]));
  }

  block.appendChild(container);

  return block;
}

function getNrReportItems(selections) {
  return NR_REPORT_RULES.map((rule) => evaluateNrRule(rule, selections));
}

function evaluateNrRule(rule, selections) {
  if (rule.mode === "revoked") {
    return { ...rule, status: "Revogada", reason: "Norma revogada. Não considerar como obrigação vigente." };
  }

  if (rule.mode === "general") {
    return { ...rule, status: "Aplicável geral", reason: rule.note || "Aplicável de forma geral à organização." };
  }

  if (rule.mode === "sesmt") {
    return {
      ...rule,
      status: dimensionFields.sesmtSummary.textContent.includes("não") ? "Não dimensionado" : "Aplicável",
      reason: dimensionFields.sesmtSummary.textContent,
    };
  }

  if (rule.mode === "cipa") {
    return {
      ...rule,
      status: "Aplicável",
      reason: dimensionFields.cipaSummary.textContent,
    };
  }

  if (rule.mode === "epi") {
    const hasEpi = selections.some((selection) => getEpiData(selection.targetId, selection.risk.code).applicable === "Sim");
    return {
      ...rule,
      status: hasEpi ? "Aplicável" : "Não identificado",
      reason: hasEpi ? "Há EPI aplicável informado no levantamento." : "Nenhum EPI aplicável foi informado.",
    };
  }

  const matches = getGenericRuleMatches(rule, selections);

  if (matches.length > 0) {
    return { ...rule, status: rule.mode === "verify" ? "Verificar" : "Critério identificado", reason: `Critérios encontrados: ${matches.join(", ")}${rule.nr === "NR-35" ? ". Confirmar atividade com diferença de nível acima de 2 m e risco de queda." : ""}` };
  }

  return { ...rule, status: "Não identificado", reason: "Não houve indício no levantamento inicial." };
}

function getGenericRuleMatches(rule, selections) {
  const matches = [];
  const cnaeText = getCurrentCnaeText();

  if (rule.cnaePrefixes?.some((prefix) => cnaeText.digits.startsWith(prefix))) {
    matches.push("CNAE da empresa");
  }

  selections.forEach((selection) => {
    const risk = selection.risk;
    if (risk.code === "09.01.001") return;

    if (rule.riskCodes?.includes(risk.code)) {
      matches.push(risk.name);
    }

    if (rule.riskGroups?.includes(risk.group)) {
      matches.push(risk.group);
    }

  });

  return [...new Set(matches)];
}

function createReportBlock(titleText) {
  const block = document.createElement("section");
  const title = document.createElement("h3");

  block.className = "report-block";
  title.textContent = titleText;
  block.appendChild(title);

  return block;
}

function createReportMiniCard(titleText, subtitle, lines) {
  const card = document.createElement("article");
  const title = document.createElement("strong");

  card.className = "report-mini-card";
  title.textContent = titleText;
  card.appendChild(title);

  if (subtitle) {
    const subtitleElement = document.createElement("span");
    subtitleElement.textContent = subtitle;
    card.appendChild(subtitleElement);
  }

  lines.forEach((line) => {
    const item = document.createElement("small");
    item.textContent = line;
    card.appendChild(item);
  });

  return card;
}

function addReportItem(list, text) {
  const item = document.createElement("li");
  item.textContent = text;
  list.appendChild(item);
}

function cleanupPrintMode() {
  document.body.classList.remove("printing-report");
}

function getDraft() {
  const draft = {
    cnpj: input.value,
    currentCompany,
    employees: employeeCountInput.value,
    dimensionOptions: {preponderantRisk: document.querySelector("#preponderant-risk").value, health: document.querySelector("#health-establishment").checked},
    selectedSectors: Array.from(selectedSectorNames),
    jobsBySector: Array.from(jobsBySector.entries()),
    selectedRiskMode,
    gheList,
    selectedRisksByTarget: mapOfSetsToArray(selectedRisksByTarget),
    riskSourcesBySelection: Array.from(riskSourcesBySelection.entries()),
    epiBySelection: Array.from(epiBySelection.entries()),
  };

  return draft;
}

function saveDraft() {
  const draft = getDraft();
  if (globalThis.GRO_CLOUD) { globalThis.GRO_CLOUD.save(draft); return; }
  localStorage.setItem(draftStorageKey, JSON.stringify(draft));
  showMessage("Rascunho salvo neste navegador.");
}

function loadDraft() {
  if (globalThis.GRO_CLOUD) { globalThis.GRO_CLOUD.reload(); return; }
  const rawDraft = localStorage.getItem(draftStorageKey);

  if (!rawDraft) {
    showMessage("Nenhum rascunho salvo neste navegador.", true);
    return;
  }

  try {
    const draft = JSON.parse(rawDraft);
    restoreDraft(draft);
    showMessage("Rascunho carregado.");
  } catch (error) {
    showMessage("Não foi possível carregar o rascunho salvo.", true);
  }
}

function clearDraft() {
  localStorage.removeItem(draftStorageKey);
  showMessage("Rascunho removido deste navegador.");
}

function restoreDraft(draft) {
  input.value = draft.cnpj || "";
  employeeCountInput.value = draft.employees || "";
  currentCompany = draft.currentCompany || null;

  if (currentCompany) {
    renderCompany(currentCompany);
  }

  clearCheckboxes(sectorOptions);
  selectedSectorNames.clear();
  (draft.selectedSectors || []).forEach((sectorName) => addSectorOption(sectorName, true));

  jobsBySector.clear();
  (draft.jobsBySector || []).forEach(([sectorName, jobs]) => {
    jobsBySector.set(sectorName, jobs);
  });

  gheList.length = 0;
  (draft.gheList || []).forEach((ghe) => gheList.push(ghe));

  selectedRisksByTarget.clear();
  restoreMapOfSets(selectedRisksByTarget, draft.selectedRisksByTarget || []);

  riskSourcesBySelection.clear();
  (draft.riskSourcesBySelection || []).forEach(([key, value]) => {
    riskSourcesBySelection.set(key, value);
  });

  epiBySelection.clear();
  (draft.epiBySelection || []).forEach(([key, value]) => {
    epiBySelection.set(key, value);
  });

  selectedRiskMode = ["ghe", "job"].includes(draft.selectedRiskMode) ? draft.selectedRiskMode : "";
  if (draft.selectedRiskMode === "sector") {
    riskModeTitle.textContent = "Escolha GHE ou cargo";
    riskModeDescription.textContent = "Este rascunho usa o modelo antigo por setor. Escolha uma das opções para reorganizar os riscos.";
  }
  setRiskModeInput(selectedRiskMode);

  renderJobSections();
  renderRiskModeSummary();

  if (selectedRiskMode) {
    renderRiskSelection();
  }

  document.querySelector("#preponderant-risk").value = draft.dimensionOptions?.preponderantRisk || "";
  document.querySelector("#health-establishment").checked = draft.dimensionOptions?.health ?? String(currentCompany?.cnae_fiscal || "").startsWith("86");
  if (Number.isSafeInteger(Number(employeeCountInput.value)) && Number(employeeCountInput.value) > 0 && currentRiskGrade) {
    renderDimension(Number(employeeCountInput.value), currentRiskGrade);
  }
}

function setRiskModeInput(value) {
  riskModeForm.querySelectorAll("input").forEach((radio) => {
    radio.checked = radio.value === value;
  });
}

function clearCheckboxes(container) {
  container.querySelectorAll("input").forEach((checkbox) => {
    checkbox.checked = false;
  });
}

function mapOfSetsToArray(map) {
  return Array.from(map.entries()).map(([key, value]) => [key, Array.from(value)]);
}

function restoreMapOfSets(map, entries) {
  entries.forEach(([key, values]) => {
    map.set(key, new Set(values));
  });
}

function groupSelectionsByTarget(selections) {
  const groups = new Map();

  selections.forEach((selection) => {
    if (!groups.has(selection.targetId)) {
      groups.set(selection.targetId, {
        title: formatTargetGroupTitle(selection),
        selections: [],
      });
    }

    groups.get(selection.targetId).selections.push(selection);
  });

  return Array.from(groups.values());
}

function createRiskSourceGroup(group, createCard, className = "risk-source-group") {
  const wrapper = document.createElement("section");
  const title = document.createElement("h3");

  wrapper.className = className;
  title.textContent = group.title;
  wrapper.appendChild(title);

  group.selections.forEach((selection) => {
    wrapper.appendChild(createCard(selection));
  });

  return wrapper;
}

function formatTargetGroupTitle(selection) {
  if (selection.targetContext.startsWith("GHE: ")) {
    return selection.targetContext.replace("GHE: ", "GHE - ");
  }

  if (selection.targetContext.startsWith("Cargo: ")) {
    return selection.targetContext.replace("Cargo: ", "Cargo - ");
  }

  if (selection.targetContext.startsWith("Setor: ")) {
    return selection.targetContext.replace("Setor: ", "Setor - ");
  }

  return selection.targetContext;
}

function formatCnpj(value) {
  const digits = onlyNumbers(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function isValidCnpj(cnpj) {
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
    return false;
  }

  const digits = cnpj.split("").map(Number);
  const firstCheck = calculateCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondCheck = calculateCheckDigit(digits.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return firstCheck === digits[12] && secondCheck === digits[13];
}

function calculateCheckDigit(numbers, weights) {
  const total = numbers.reduce((sum, number, index) => sum + number * weights[index], 0);
  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

function formatCnae(company) {
  const raw = String(company.cnae_fiscal || '').replace(/\D/g, '');
  const digits = raw ? raw.padStart(7, '0') : '';
  const code = digits.length === 7 ? digits.replace(/^(\d{4})(\d)(\d{2})$/, '$1-$2/$3') : company.cnae_fiscal;
  const description = company.cnae_fiscal_descricao || globalThis.GRO_CNAE_DESCRIPTIONS?.[digits];

  if (!code && !description) {
    return "-";
  }

  return [code, description].filter(Boolean).join(" - ");
}

function getRiskGradeByCnae(cnae) {
  const code = formatCnaeClassCode(cnae);

  if (!code || typeof CNAE_RISK_GRADES === "undefined") {
    return null;
  }

  return CNAE_RISK_GRADES[code] || null;
}

function formatCnaeClassCode(cnae) {
  const digits = String(cnae || "").replace(/\D/g, "").padStart(7, "0");

  if (digits.length < 5) {
    return "";
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}-${digits.slice(4, 5)}`;
}

function formatAddress(company) {
  const street = [company.descricao_tipo_de_logradouro, company.logradouro]
    .filter(Boolean)
    .join(" ");
  const cityState = [company.municipio, company.uf].filter(Boolean).join(" - ");

  return [
    [street, company.numero].filter(Boolean).join(", "),
    company.complemento,
    company.bairro,
    company.cep ? `CEP ${company.cep}` : "",
    cityState,
  ]
    .filter(Boolean)
    .join(" | ") || "-";
}

function formatContact(company) {
  return [
    company.ddd_telefone_1,
    company.ddd_telefone_2,
    company.email,
  ]
    .filter(Boolean)
    .join(" | ") || "-";
}

function valueOrFallback(value) {
  return value || "-";
}

function onlyNumbers(value) {
  return value.replace(/\D/g, "");
}

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("is-error", isError);
}

function clearMessage() {
  showMessage("");
}

function setLoading(isLoading) {
  button.disabled = isLoading;
  button.textContent = isLoading ? "Consultando..." : "Consultar";
}

globalThis.GRO_FORM = { restore: restoreDraft, snapshot: getDraft };

