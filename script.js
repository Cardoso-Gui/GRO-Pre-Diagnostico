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
const riskSelectionGrid = document.querySelector("#risk-selection-grid");
const gheForm = document.querySelector("#ghe-form");
const gheNameInput = document.querySelector("#ghe-name-input");
const gheAssociationList = document.querySelector("#ghe-association-list");
const riskSourceSection = document.querySelector("#risk-source-section");
const riskSourceGrid = document.querySelector("#risk-source-grid");
const epiSection = document.querySelector("#epi-section");
const epiGrid = document.querySelector("#epi-grid");
const trainingSection = document.querySelector("#training-section");
const trainingGrid = document.querySelector("#training-grid");
const finalReportSection = document.querySelector("#final-report-section");
const generateReportButton = document.querySelector("#generate-report-button");
const printReportButton = document.querySelector("#print-report-button");
const finalReport = document.querySelector("#final-report");
const draftStorageKey = globalThis.GRO_DRAFT_KEY || "sst-questionnaire-draft";
let currentRiskGrade = null;
let currentCompany = null;
const selectedSectorNames = new Set();
const jobsBySector = new Map();
const gheList = [];
const selectedRisksByTarget = new Map();
const riskSourcesBySelection = new Map();
const epiBySelection = new Map();
let selectedRiskMode = "";

const defaultSectors = [
  "Administrativo",
  "Comercial",
  "Financeiro",
  "RH",
  "Produção",
  "Operacional",
  "Logística",
  "Manutenção",
  "Almoxarifado",
  "Limpeza",
  "Portaria",
  "TI",
];

const jobSuggestionsBySector = {
  Administrativo: ["Auxiliar Administrativo", "Assistente Administrativo", "Analista Administrativo", "Recepcionista"],
  Comercial: ["Vendedor", "Consultor Comercial", "Supervisor Comercial", "Atendente"],
  Financeiro: ["Auxiliar Financeiro", "Assistente Financeiro", "Analista Financeiro", "Caixa"],
  RH: ["Auxiliar de RH", "Assistente de RH", "Analista de RH", "Recrutador"],
  Produção: ["Auxiliar de Produção", "Operador de Máquina", "Líder de Produção", "Supervisor de Produção"],
  Operacional: ["Auxiliar Operacional", "Operador", "Encarregado Operacional", "Supervisor Operacional"],
  Logística: ["Auxiliar de Logística", "Conferente", "Estoquista", "Motorista"],
  Manutenção: ["Auxiliar de Manutenção", "Mecânico de Manutenção", "Eletricista de Manutenção", "Técnico de Manutenção"],
  Almoxarifado: ["Almoxarife", "Auxiliar de Almoxarifado", "Estoquista", "Conferente"],
  Limpeza: ["Auxiliar de Limpeza", "Servente de Limpeza", "Encarregado de Limpeza", "Copeira"],
  Portaria: ["Porteiro", "Controlador de Acesso", "Vigia", "Recepcionista"],
  TI: ["Técnico de TI", "Analista de Suporte", "Desenvolvedor", "Analista de Sistemas"],
};

const genericJobSuggestions = [
  "Auxiliar",
  "Assistente",
  "Analista",
  "Operador",
  "Líder",
  "Supervisor",
];

const riskModeDescriptions = {
  ghe: {
    title: "Criar GHEs",
    description:
      "Você vai montar grupos de exposição homogênea e selecionar riscos ocupacionais, incluindo agentes da Tabela 24 do eSocial, ergonômicos e acidentes.",
  },
  job: {
    title: "Riscos por cargo",
    description:
      "Você vai selecionar, para cada cargo cadastrado, os riscos ocupacionais aplicáveis.",
  },
  sector: {
    title: "Riscos por setor com exceções",
    description:
      "Você vai selecionar riscos ocupacionais por setor e poderá criar exceções para cargos específicos.",
  },
};

const occupationalRiskSource = [
  ...ESOCIAL_RISK_TABLE_24.map((risk) => ({
    ...risk,
    source: "eSocial - Tabela 24",
  })),
  ...OCCUPATIONAL_RISK_TABLE.map((risk) => ({
    ...risk,
    source: "Risco ocupacional",
  })),
];

const hiddenRiskGroups = new Set([
  "Associação de agentes nocivos físicos, químicos e biológicos",
  "Outros agentes nocivos",
  "Ausência de agentes nocivos ou atividades especiais",
]);

const fields = {
  companyName: document.querySelector("#company-name"),
  status: document.querySelector("#company-status"),
  legalName: document.querySelector("#legal-name"),
  tradeName: document.querySelector("#trade-name"),
  mainCnae: document.querySelector("#main-cnae"),
  address: document.querySelector("#address"),
  contact: document.querySelector("#contact"),
};

const dimensionFields = {
  cipaSummary: document.querySelector("#cipa-summary"),
  cipaNote: document.querySelector("#cipa-note"),
  sesmtSummary: document.querySelector("#sesmt-summary"),
  sesmtList: document.querySelector("#sesmt-list"),
};

const cipaRanges = [
  [0, 19],
  [20, 29],
  [30, 50],
  [51, 80],
  [81, 100],
  [101, 120],
  [121, 140],
  [141, 300],
  [301, 500],
  [501, 1000],
  [1001, 2500],
  [2501, 5000],
  [5001, 10000],
];

const cipaTable = {
  1: {
    effective: [0, 0, 0, 0, 1, 1, 1, 1, 2, 4, 5, 6, 8],
    substitutes: [0, 0, 0, 0, 1, 1, 1, 1, 2, 3, 4, 5, 6],
    extra: { effective: 1, substitutes: 1 },
  },
  2: {
    effective: [0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 8, 10],
    substitutes: [0, 0, 0, 1, 1, 1, 1, 2, 3, 4, 5, 6, 8],
    extra: { effective: 1, substitutes: 1 },
  },
  3: {
    effective: [0, 1, 1, 2, 2, 2, 3, 4, 5, 6, 8, 10, 12],
    substitutes: [0, 1, 1, 1, 1, 1, 2, 2, 4, 4, 6, 8, 8],
    extra: { effective: 2, substitutes: 2 },
  },
  4: {
    effective: [0, 1, 2, 3, 3, 4, 4, 4, 5, 6, 9, 11, 13],
    substitutes: [0, 1, 1, 2, 2, 2, 2, 3, 4, 5, 7, 8, 10],
    extra: { effective: 2, substitutes: 2 },
  },
};

const sesmtRanges = [
  [50, 100],
  [101, 250],
  [251, 500],
  [501, 1000],
  [1001, 2000],
  [2001, 3500],
  [3501, 5000],
];

const sesmtTable = {
  1: {
    "Técnico em segurança do trabalho": ["", "", "", "", "1", "1", "2"],
    "Engenheiro de segurança do trabalho": ["", "", "", "", "", "1*", "1"],
    "Auxiliar/Técnico de enfermagem do trabalho": ["", "", "", "1", "", "1***", "1"],
    "Enfermeiro do trabalho": ["", "", "", "", "", "", "1*"],
    "Médico do trabalho": ["", "", "", "", "1*", "1*", "1"],
    extra: {
      "Técnico em segurança do trabalho": "1",
      "Engenheiro de segurança do trabalho": "1*",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1*",
    },
  },
  2: {
    "Técnico em segurança do trabalho": ["", "", "", "", "1", "2", "5"],
    "Engenheiro de segurança do trabalho": ["", "", "", "", "1*", "1", "1"],
    "Auxiliar/Técnico de enfermagem do trabalho": ["", "", "", "1", "1***", "1***", "1"],
    "Enfermeiro do trabalho": ["", "", "", "", "", "", "1"],
    "Médico do trabalho": ["", "", "", "", "1*", "1", "1"],
    extra: {
      "Técnico em segurança do trabalho": "1",
      "Engenheiro de segurança do trabalho": "1*",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1",
    },
  },
  3: {
    "Técnico em segurança do trabalho": ["", "", "", "3", "4", "6", "8"],
    "Engenheiro de segurança do trabalho": ["", "", "", "1*", "1", "1", "2"],
    "Auxiliar/Técnico de enfermagem do trabalho": ["", "1", "2", "", "1***", "1", "1"],
    "Enfermeiro do trabalho": ["", "", "", "", "", "1", "1"],
    "Médico do trabalho": ["", "", "", "1*", "1", "1", "2"],
    extra: {
      "Técnico em segurança do trabalho": "3",
      "Engenheiro de segurança do trabalho": "1",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1",
    },
  },
  4: {
    "Técnico em segurança do trabalho": ["", "2", "3", "4", "5", "8", "10"],
    "Engenheiro de segurança do trabalho": ["1", "1*", "1*", "1", "1", "2", "3"],
    "Auxiliar/Técnico de enfermagem do trabalho": ["", "", "", "1***", "1***", "1", "1"],
    "Enfermeiro do trabalho": ["", "", "", "", "", "1", "1"],
    "Médico do trabalho": ["1*", "1*", "1", "1", "", "2", "3"],
    extra: {
      "Técnico em segurança do trabalho": "3",
      "Engenheiro de segurança do trabalho": "1",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1",
    },
  },
};

input.addEventListener("input", () => {
  input.value = formatCnpj(input.value);
  clearMessage();
});

customSectorForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const sectorName = customSectorInput.value.trim();

  if (!sectorName) {
    return;
  }

  addSectorOption(sectorName, true);
  customSectorInput.value = "";
});

saveDraftButton.addEventListener("click", () => {
  saveDraft();
});

loadDraftButton.addEventListener("click", () => {
  loadDraft();
});

clearDraftButton.addEventListener("click", () => {
  clearDraft();
});

riskModeForm.addEventListener("change", (event) => {
  if (event.target.name !== "risk-mode") {
    return;
  }

  selectedRiskMode = event.target.value;
  renderRiskModeSummary();
  renderRiskSelection();
});

gheForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = gheNameInput.value.trim();
  const linkedJobs = getCheckedGheAssociations();

  if (!name) {
    return;
  }

  if (linkedJobs.length === 0) {
    showMessage("Selecione pelo menos um setor/cargo para criar o GHE.", true);
    return;
  }

  const exists = gheList.some((ghe) => normalizeSectorName(ghe.name) === normalizeSectorName(name));

  if (!exists) {
    gheList.push({ id: createTargetId("ghe", name), name, linkedJobs });
  }

  gheNameInput.value = "";
  clearGheAssociations();
  renderRiskSelection();
});

generateReportButton.addEventListener("click", () => {
  renderFinalReport();
});

printReportButton.addEventListener("click", () => {
  document.body.classList.add("printing-report");
  window.print();
  setTimeout(cleanupPrintMode, 1000);
});

window.addEventListener?.("afterprint", cleanupPrintMode);

dimensionForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const employees = Number(employeeCountInput.value);

  if (!Number.isInteger(employees) || employees < 1) {
    return;
  }

  if (!currentRiskGrade) {
    showMessage("Não foi possível identificar o grau de risco pelo CNAE principal.", true);
    return;
  }

  renderDimension(employees, currentRiskGrade);
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const cnpj = onlyNumbers(input.value);

  if (!isValidCnpj(cnpj)) {
    showMessage("Digite um CNPJ válido para consultar.", true);
    companyCard.hidden = true;
    dimensionResults.hidden = true;
    return;
  }

  setLoading(true);
  showMessage("Consultando dados da empresa...");

  try {
    const company = await fetchCompany(cnpj);
    renderCompany(company);
    showMessage("Dados carregados.");
  } catch (error) {
    companyCard.hidden = true;
    dimensionResults.hidden = true;
    showMessage(error.message, true);
  } finally {
  setLoading(false);
  }
});

defaultSectors.forEach((sector) => addSectorOption(sector));

async function fetchCompany(cnpj) {
  const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);

  if (response.status === 404) {
    throw new Error("CNPJ não encontrado.");
  }

  if (!response.ok) {
    throw new Error("Não foi possível consultar esse CNPJ agora.");
  }

  return response.json();
}

function renderCompany(company) {
  currentCompany = company;
  currentRiskGrade = getRiskGradeByCnae(company.cnae_fiscal);

  fields.companyName.textContent = valueOrFallback(
    company.nome_fantasia || company.razao_social
  );
  fields.status.textContent = valueOrFallback(company.descricao_situacao_cadastral);
  fields.legalName.textContent = valueOrFallback(company.razao_social);
  fields.tradeName.textContent = valueOrFallback(company.nome_fantasia);
  fields.mainCnae.textContent = formatCnae(company);
  fields.address.textContent = formatAddress(company);
  fields.contact.textContent = formatContact(company);
  riskGradeOutput.textContent = currentRiskGrade
    ? `Grau ${currentRiskGrade}`
    : "Não encontrado";
  companyCard.hidden = false;
  dimensionResults.hidden = true;
}

function renderDimension(employees, riskGrade) {
  const cipa = calculateCipa(employees, riskGrade);
  const sesmt = calculateSesmt(employees, riskGrade);
  const hasSesmt = sesmt.length > 0;

  if (cipa.effective === 0 && cipa.substitutes === 0) {
    if (hasSesmt) {
      dimensionFields.cipaSummary.textContent = "Atendido pelo SESMT";
      dimensionFields.cipaNote.textContent =
        "Pelo Quadro I da NR-5 não há CIPA dimensionada. Como há SESMT, ele desempenha as atribuições da CIPA.";
    } else {
      dimensionFields.cipaSummary.textContent = "Representante nomeado da NR-05";
      dimensionFields.cipaNote.textContent =
        "Pelo Quadro I da NR-5 não há CIPA por votação. Como não há SESMT dimensionado, a organização deve nomear um representante entre seus empregados.";
    }
  } else {
    dimensionFields.cipaSummary.textContent =
      `${cipa.effective} efetivo(s) e ${cipa.substitutes} suplente(s)`;
    dimensionFields.cipaNote.textContent =
      `Constituir CIPA: representantes dos empregados eleitos e representantes da organização designados, em composição paritária.`;
  }

  dimensionFields.sesmtList.innerHTML = "";

  if (sesmt.length === 0) {
    dimensionFields.sesmtSummary.textContent = "SESMT não dimensionado";
    addSesmtItem("Pelo Anexo II da NR-4 não há profissionais mínimos para essa faixa.");
  } else {
    dimensionFields.sesmtSummary.textContent = `${sesmt.length} tipo(s) de profissional`;
    sesmt.forEach((item) => addSesmtItem(`${item.quantity} - ${item.role}`));
  }

  dimensionResults.hidden = false;
}

function calculateCipa(employees, riskGrade) {
  const table = cipaTable[riskGrade];

  if (employees > 10000) {
    const extraGroups = Math.ceil((employees - 10000) / 2500);

    return {
      effective: table.effective[12] + extraGroups * table.extra.effective,
      substitutes: table.substitutes[12] + extraGroups * table.extra.substitutes,
    };
  }

  const rangeIndex = cipaRanges.findIndex(([min, max]) => employees >= min && employees <= max);

  return {
    effective: table.effective[rangeIndex],
    substitutes: table.substitutes[rangeIndex],
  };
}

function calculateSesmt(employees, riskGrade) {
  if (employees < 50) {
    return [];
  }

  const table = sesmtTable[riskGrade];
  const entries = Object.entries(table).filter(([role]) => role !== "extra");
  const rangeIndex = sesmtRanges.findIndex(([min, max]) => employees >= min && employees <= max);

  if (rangeIndex >= 0) {
    return entries
      .map(([role, quantities]) => ({ role, quantity: quantities[rangeIndex] }))
      .filter((item) => item.quantity);
  }

  const extraGroups = calculateSesmtExtraGroups(employees);

  return entries
    .map(([role, quantities]) => {
      const base = quantities[6];
      const extra = table.extra[role];

      return {
        role,
        quantity: sumQuantities(base, extra, extraGroups),
      };
    })
    .filter((item) => item.quantity);
}

function calculateSesmtExtraGroups(employees) {
  const extraWorkers = employees - 5000;
  const fullGroups = Math.floor(extraWorkers / 4000);
  const remainder = extraWorkers % 4000;

  return fullGroups + (remainder > 2000 ? 1 : 0);
}

function sumQuantities(base, extra, multiplier) {
  const baseValue = parseQuantity(base);
  const extraValue = parseQuantity(extra) * multiplier;
  const total = baseValue + extraValue;

  if (total === 0) {
    return "";
  }

  return `${total}${baseHasPartialMark(base, extra) ? "*" : ""}`;
}

function parseQuantity(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
}

function baseHasPartialMark(...values) {
  return values.some((value) => String(value || "").includes("*"));
}

function addSesmtItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  dimensionFields.sesmtList.appendChild(item);
}

function addSectorOption(name, shouldCheck = false) {
  const normalizedName = normalizeSectorName(name);
  const existing = findSectorCheckbox(normalizedName);

  if (existing) {
    existing.checked = shouldCheck || existing.checked;
    updateSelectedSectors();
    return;
  }

  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const text = document.createElement("span");

  label.className = "sector-chip";
  checkbox.type = "checkbox";
  checkbox.value = name;
  checkbox.dataset.normalizedName = normalizedName;
  checkbox.checked = shouldCheck;
  text.textContent = name;

  checkbox.addEventListener("change", updateSelectedSectors);

  label.appendChild(checkbox);
  label.appendChild(text);
  sectorOptions.appendChild(label);
  updateSelectedSectors();
}

function updateSelectedSectors() {
  selectedSectorNames.clear();
  selectedSectorList.innerHTML = "";

  const checkedSectors = sectorOptions.querySelectorAll("input:checked");

  checkedSectors.forEach((checkbox) => {
    selectedSectorNames.add(checkbox.value);

    const pill = document.createElement("span");
    pill.className = "selected-sector-pill";
    pill.textContent = checkbox.value;
    selectedSectorList.appendChild(pill);
  });

  selectedSectors.hidden = checkedSectors.length === 0;
  renderJobSections();
}

function findSectorCheckbox(normalizedName) {
  return Array.from(sectorOptions.querySelectorAll("input")).find(
    (checkbox) => checkbox.dataset.normalizedName === normalizedName
  );
}

function normalizeSectorName(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderJobSections() {
  jobsGrid.innerHTML = "";
  jobsSection.hidden = selectedSectorNames.size === 0;

  selectedSectorNames.forEach((sectorName) => {
    if (!jobsBySector.has(sectorName)) {
      jobsBySector.set(sectorName, []);
    }

    jobsGrid.appendChild(createJobCard(sectorName));
  });

  renderRiskModeSection();
}

function createJobCard(sectorName) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  const suggestions = document.createElement("div");
  const form = document.createElement("form");
  const nameLabel = document.createElement("label");
  const quantityLabel = document.createElement("label");
  const nameInput = document.createElement("input");
  const quantityInput = document.createElement("input");
  const addButton = document.createElement("button");
  const jobList = document.createElement("div");

  card.className = "job-card";
  title.textContent = sectorName;
  suggestions.className = "job-suggestions";
  form.className = "job-form";
  jobList.className = "job-list";

  nameLabel.textContent = "Cargo";
  quantityLabel.textContent = "Funcionários";
  nameInput.type = "text";
  nameInput.placeholder = "Ex.: Auxiliar Administrativo";
  quantityInput.type = "number";
  quantityInput.min = "1";
  quantityInput.step = "1";
  quantityInput.placeholder = "Qtd.";
  addButton.type = "submit";
  addButton.textContent = "Adicionar";

  nameLabel.appendChild(nameInput);
  quantityLabel.appendChild(quantityInput);
  form.appendChild(nameLabel);
  form.appendChild(quantityLabel);
  form.appendChild(addButton);

  getJobSuggestions(sectorName).forEach((jobName) => {
    const suggestionButton = document.createElement("button");
    suggestionButton.type = "button";
    suggestionButton.textContent = jobName;
    suggestionButton.addEventListener("click", () => {
      nameInput.value = jobName;
      quantityInput.focus();
    });
    suggestions.appendChild(suggestionButton);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    addJobToSector(sectorName, nameInput.value, Number(quantityInput.value));
    renderJobSections();
  });

  card.appendChild(title);
  card.appendChild(suggestions);
  card.appendChild(form);
  renderJobList(sectorName, jobList);
  card.appendChild(jobList);

  return card;
}

function renderJobList(sectorName, container) {
  const jobs = jobsBySector.get(sectorName) || [];

  jobs.forEach((job) => {
    const row = document.createElement("div");
    const text = document.createElement("span");
    const jobName = document.createElement("strong");
    const removeButton = document.createElement("button");

    row.className = "job-row";
    jobName.textContent = job.name;
    text.appendChild(jobName);
    text.append(` - ${job.quantity} funcionário(s)`);
    removeButton.type = "button";
    removeButton.textContent = "Remover";
    removeButton.addEventListener("click", () => {
      removeJobFromSector(sectorName, job.name);
      renderJobSections();
    });

    row.appendChild(text);
    row.appendChild(removeButton);
    container.appendChild(row);
  });
}

function addJobToSector(sectorName, jobName, quantity) {
  const cleanName = jobName.trim();

  if (!cleanName || !Number.isInteger(quantity) || quantity < 1) {
    return;
  }

  const jobs = jobsBySector.get(sectorName) || [];
  const normalizedName = normalizeSectorName(cleanName);
  const existingJob = jobs.find((job) => normalizeSectorName(job.name) === normalizedName);

  if (existingJob) {
    existingJob.quantity = quantity;
  } else {
    jobs.push({ name: cleanName, quantity });
  }

  jobsBySector.set(sectorName, jobs);
  renderRiskModeSection();
}

function removeJobFromSector(sectorName, jobName) {
  const jobs = jobsBySector.get(sectorName) || [];
  jobsBySector.set(
    sectorName,
    jobs.filter((job) => job.name !== jobName)
  );
  renderRiskModeSection();
}

function getJobSuggestions(sectorName) {
  return jobSuggestionsBySector[sectorName] || genericJobSuggestions;
}

function renderRiskModeSection() {
  const hasJobs = Array.from(jobsBySector.values()).some((jobs) => jobs.length > 0);
  riskModeSection.hidden = !hasJobs;

  if (!hasJobs) {
    selectedRiskMode = "";
    riskModeSummary.hidden = true;
    riskSelectionSection.hidden = true;
    riskSourceSection.hidden = true;
    epiSection.hidden = true;
    trainingSection.hidden = true;
    finalReportSection.hidden = true;
    riskModeForm.reset();
  } else if (selectedRiskMode) {
    renderRiskSelection();
  }
}

function renderRiskModeSummary() {
  const content = riskModeDescriptions[selectedRiskMode];

  if (!content) {
    riskModeSummary.hidden = true;
    return;
  }

  riskModeTitle.textContent = content.title;
  riskModeDescription.textContent = content.description;
  riskModeSummary.hidden = false;
}

function renderRiskSelection() {
  riskSelectionGrid.innerHTML = "";
  riskSelectionSection.hidden = !selectedRiskMode;
  riskSourceSection.hidden = !selectedRiskMode;
  gheForm.hidden = selectedRiskMode !== "ghe";

  if (!selectedRiskMode) {
    return;
  }

  if (selectedRiskMode === "ghe") {
    renderGheAssociationOptions();
  }

  const targets = getRiskTargets();

  if (selectedRiskMode === "ghe" && targets.length === 0) {
    const emptyCard = document.createElement("article");
    emptyCard.className = "risk-card";
    emptyCard.innerHTML = "<h3>Nenhum GHE criado</h3><p class=\"risk-card-note\">Crie um GHE para selecionar os riscos ocupacionais aplicáveis.</p>";
    riskSelectionGrid.appendChild(emptyCard);
    return;
  }

  targets.forEach((target) => {
    riskSelectionGrid.appendChild(createRiskCard(target));
  });

  renderRiskSourceSection();
}

function getRiskTargets() {
  if (selectedRiskMode === "ghe") {
    return gheList.map((ghe) => ({
      id: ghe.id,
      title: ghe.name,
      note: `Vínculos: ${formatGheLinks(ghe.linkedJobs)}. Selecione os riscos ocupacionais aplicáveis a este GHE.`,
      context: `GHE: ${ghe.name}`,
    }));
  }

  if (selectedRiskMode === "job") {
    return Array.from(jobsBySector.entries()).flatMap(([sectorName, jobs]) =>
      jobs.map((job) => ({
        id: createTargetId("job", sectorName, job.name),
        title: `${job.name} - ${sectorName}`,
        note: "Selecione os riscos ocupacionais aplicáveis a este cargo.",
        context: `Cargo: ${job.name} | Setor: ${sectorName}`,
      }))
    );
  }

  if (selectedRiskMode === "sector") {
    return Array.from(selectedSectorNames).map((sectorName) => ({
      id: createTargetId("sector", sectorName),
      title: sectorName,
      note: "Selecione os riscos padrão do setor. Exceções por cargo serão tratadas na próxima etapa.",
      context: `Setor: ${sectorName}`,
    }));
  }

  return [];
}

function createRiskCard(target) {
  const card = document.createElement("article");
  const title = document.createElement("h3");
  const note = document.createElement("p");
  const tools = document.createElement("div");
  const searchInput = document.createElement("input");
  const groupSelect = document.createElement("select");
  const riskList = document.createElement("div");
  const selectedList = document.createElement("div");

  card.className = "risk-card";
  note.className = "risk-card-note";
  tools.className = "risk-tools";
  riskList.className = "risk-list";
  selectedList.className = "selected-risk-list";

  title.textContent = target.title;
  note.textContent = target.note;
  searchInput.type = "search";
  searchInput.placeholder = "Buscar risco ou código";

  buildRiskGroupOptions(groupSelect);
  renderRiskOptions(target.id, riskList, selectedList, searchInput.value, groupSelect.value);

  searchInput.addEventListener("input", () => {
    renderRiskOptions(target.id, riskList, selectedList, searchInput.value, groupSelect.value);
  });

  groupSelect.addEventListener("change", () => {
    renderRiskOptions(target.id, riskList, selectedList, searchInput.value, groupSelect.value);
  });

  tools.appendChild(searchInput);
  tools.appendChild(groupSelect);
  card.appendChild(title);
  card.appendChild(note);
  card.appendChild(tools);
  card.appendChild(riskList);
  card.appendChild(selectedList);

  return card;
}

function buildRiskGroupOptions(select) {
  const groups = [...new Set(getSelectableRisks().map((risk) => risk.group))];
  const allOption = document.createElement("option");

  allOption.value = "";
  allOption.textContent = "Todos os grupos";
  select.appendChild(allOption);

  groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group;
    option.textContent = group;
    select.appendChild(option);
  });
}

function renderRiskOptions(targetId, container, selectedList, searchTerm, group) {
  const selectedCodes = getSelectedRiskCodes(targetId);
  const normalizedSearch = normalizeSectorName(searchTerm);
  const filteredRisks = getSelectableRisks().filter((risk) => {
    const matchesGroup = !group || risk.group === group;
    const matchesSearch = !normalizedSearch ||
      normalizeSectorName(`${risk.code} ${risk.name} ${risk.group} ${risk.source}`).includes(normalizedSearch);

    return matchesGroup && matchesSearch;
  });

  container.innerHTML = "";

  filteredRisks.forEach((risk) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");

    label.className = "risk-option";
    checkbox.type = "checkbox";
    checkbox.checked = selectedCodes.has(risk.code);
    name.textContent = risk.name;
    meta.textContent = `${risk.code} - ${risk.group} - ${risk.source}`;

    checkbox.addEventListener("change", () => {
      toggleRiskSelection(targetId, risk.code, checkbox.checked);
      renderSelectedRisks(targetId, selectedList);
      renderRiskSourceSection();
    });

    text.appendChild(name);
    text.appendChild(meta);
    label.appendChild(checkbox);
    label.appendChild(text);
    container.appendChild(label);
  });

  if (filteredRisks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "risk-card-note";
    empty.textContent = "Nenhum risco ocupacional encontrado para esse filtro.";
    container.appendChild(empty);
  }

  renderSelectedRisks(targetId, selectedList);
}

function renderSelectedRisks(targetId, container) {
  const selectedCodes = getSelectedRiskCodes(targetId);
  const selectedRisks = getSelectableRisks().filter((risk) => selectedCodes.has(risk.code));

  container.innerHTML = "";

  selectedRisks.forEach((risk) => {
    const pill = document.createElement("span");
    pill.className = "selected-risk-pill";
    pill.textContent = `${risk.code} - ${risk.name}`;
    container.appendChild(pill);
  });
}

function toggleRiskSelection(targetId, riskCode, checked) {
  const selectedCodes = getSelectedRiskCodes(targetId);

  if (checked) {
    selectedCodes.add(riskCode);
  } else {
    selectedCodes.delete(riskCode);
  }

  selectedRisksByTarget.set(targetId, selectedCodes);
}

function getSelectedRiskCodes(targetId) {
  if (!selectedRisksByTarget.has(targetId)) {
    selectedRisksByTarget.set(targetId, new Set());
  }

  return selectedRisksByTarget.get(targetId);
}

function createTargetId(...parts) {
  return parts.map((part) => normalizeSectorName(String(part))).join("__");
}

function getSelectableRisks() {
  return occupationalRiskSource.filter((risk) => !hiddenRiskGroups.has(risk.group));
}

function renderRiskSourceSection() {
  const selections = getRiskSelections();
  riskSourceGrid.innerHTML = "";
  riskSourceSection.hidden = selections.length === 0;
  renderEpiSection();

  groupSelectionsByTarget(selections).forEach((group) => {
    riskSourceGrid.appendChild(createRiskSourceGroup(group, createRiskSourceCard));
  });
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
  const selections = getRiskSelections();
  epiGrid.innerHTML = "";
  epiSection.hidden = selections.length === 0;
  renderTrainingSection();

  groupSelectionsByTarget(selections).forEach((group) => {
    epiGrid.appendChild(createRiskSourceGroup(group, createEpiCard, "epi-group"));
  });
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

    renderTrainingSection();
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
      renderTrainingSection();
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

  renderTrainingSection();
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

function renderTrainingSection() {
  const selections = getRiskSelections();
  trainingGrid.innerHTML = "";
  trainingSection.hidden = selections.length === 0;
  finalReportSection.hidden = selections.length === 0;

  groupSelectionsByTarget(selections).forEach((group) => {
    trainingGrid.appendChild(createTrainingGroup(group));
  });
}

function createTrainingGroup(group) {
  const wrapper = document.createElement("section");
  const title = document.createElement("h3");
  const suggestions = getTrainingSuggestions(group.selections);

  wrapper.className = "training-group";
  title.textContent = group.title;
  wrapper.appendChild(title);

  if (suggestions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "training-empty";
    empty.textContent = "Nenhum treinamento pré-cadastrado foi sugerido para os riscos informados.";
    wrapper.appendChild(empty);
    return wrapper;
  }

  suggestions.forEach((training) => {
    wrapper.appendChild(createTrainingCard(training));
  });

  return wrapper;
}

function createTrainingCard(training) {
  const card = document.createElement("article");
  const title = document.createElement("strong");
  const reason = document.createElement("p");
  const source = document.createElement("small");

  card.className = "training-card";
  title.textContent = training.title;
  reason.textContent = training.reason;
  source.textContent = `Sugerido por: ${training.matches.join(", ")}`;

  card.appendChild(title);
  card.appendChild(reason);
  card.appendChild(source);

  return card;
}

function getTrainingSuggestions(selections) {
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

function renderFinalReport() {
  const selections = getRiskSelections();
  finalReport.innerHTML = "";
  finalReport.hidden = false;
  printReportButton.hidden = false;

  finalReport.appendChild(createReportCover());
  finalReport.appendChild(createCompanyReportBlock());
  finalReport.appendChild(createDimensionReportBlock());
  finalReport.appendChild(createSectorJobReportBlock());
  finalReport.appendChild(createIdentifiedRiskReportBlock(selections));
  finalReport.appendChild(createRiskSourceReportBlock(selections));
  finalReport.appendChild(createEpiTrainingReportBlock(selections));
  finalReport.appendChild(createNrReportBlock(selections));
  finalReport.appendChild(createTechnicalPendingReportBlock(selections));
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

  summary.appendChild(createReportSummaryItem("CNPJ", input.value || "-"));
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
    job: "Por cargo",
    sector: "Por setor",
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
      jobs.map((job) => `${job.name} - ${job.quantity} funcionário(s)`)
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
  const block = createReportBlock("Matriz preliminar de NRs");
  const container = document.createElement("div");

  container.className = "report-card-list";
  getNrReportItems(selections)
    .filter((item) => item.status !== "Não identificado" && item.status !== "Revogada")
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
    return { ...rule, status: rule.mode === "verify" ? "Verificar" : "Aplicável provável", reason: `Critérios encontrados: ${matches.join(", ")}` };
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
    const sourceData = getRiskSourceData(selection.targetId, risk.code);
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

  selectedRiskMode = draft.selectedRiskMode || "";
  setRiskModeInput(selectedRiskMode);

  renderJobSections();
  renderRiskModeSummary();

  if (selectedRiskMode) {
    renderRiskSelection();
  }

  if (employeeCountInput.value && currentRiskGrade) {
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


