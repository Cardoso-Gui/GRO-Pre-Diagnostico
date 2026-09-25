(() => {
// NR-4, Anexo II; NR-5, Quadro I. Tabelas oficiais conferidas em 25/09/2026.
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
  "1": {
    "Técnico em segurança do trabalho": [
      "",
      "",
      "",
      "1",
      "1",
      "1",
      "2"
    ],
    "Engenheiro de segurança do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "1*",
      "1"
    ],
    "Auxiliar/Técnico de enfermagem do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "1***",
      "1"
    ],
    "Enfermeiro do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "",
      "1*"
    ],
    "Médico do trabalho": [
      "",
      "",
      "",
      "",
      "1*",
      "1*",
      "1"
    ],
    "extra": {
      "Técnico em segurança do trabalho": "1",
      "Engenheiro de segurança do trabalho": "1*",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1*"
    }
  },
  "2": {
    "Técnico em segurança do trabalho": [
      "",
      "",
      "",
      "1",
      "1",
      "2",
      "5"
    ],
    "Engenheiro de segurança do trabalho": [
      "",
      "",
      "",
      "",
      "1*",
      "1",
      "1"
    ],
    "Auxiliar/Técnico de enfermagem do trabalho": [
      "",
      "",
      "",
      "",
      "1***",
      "1***",
      "1"
    ],
    "Enfermeiro do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "",
      "1"
    ],
    "Médico do trabalho": [
      "",
      "",
      "",
      "",
      "1*",
      "1",
      "1"
    ],
    "extra": {
      "Técnico em segurança do trabalho": "1",
      "Engenheiro de segurança do trabalho": "1*",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1"
    }
  },
  "3": {
    "Técnico em segurança do trabalho": [
      "",
      "1",
      "2",
      "3",
      "4",
      "6",
      "8"
    ],
    "Engenheiro de segurança do trabalho": [
      "",
      "",
      "",
      "1*",
      "1",
      "1",
      "2"
    ],
    "Auxiliar/Técnico de enfermagem do trabalho": [
      "",
      "",
      "",
      "",
      "1***",
      "1",
      "1"
    ],
    "Enfermeiro do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "1",
      "1"
    ],
    "Médico do trabalho": [
      "",
      "",
      "",
      "1*",
      "1",
      "1",
      "2"
    ],
    "extra": {
      "Técnico em segurança do trabalho": "3",
      "Engenheiro de segurança do trabalho": "1",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1"
    }
  },
  "4": {
    "Técnico em segurança do trabalho": [
      "1",
      "2",
      "3",
      "4",
      "5",
      "8",
      "10"
    ],
    "Engenheiro de segurança do trabalho": [
      "",
      "1*",
      "1*",
      "1",
      "1",
      "2",
      "3"
    ],
    "Auxiliar/Técnico de enfermagem do trabalho": [
      "",
      "",
      "",
      "1***",
      "1***",
      "1",
      "1"
    ],
    "Enfermeiro do trabalho": [
      "",
      "",
      "",
      "",
      "",
      "1",
      "1"
    ],
    "Médico do trabalho": [
      "",
      "1*",
      "1*",
      "1",
      "1",
      "2",
      "3"
    ],
    "extra": {
      "Técnico em segurança do trabalho": "3",
      "Engenheiro de segurança do trabalho": "1",
      "Auxiliar/Técnico de enfermagem do trabalho": "1",
      "Médico do trabalho": "1"
    }
  }
};
function validateDimension(n,g) { if (!Number.isSafeInteger(n) || n < 1 || ![1,2,3,4].includes(g)) throw new RangeError("Dados inválidos para dimensionamento"); }
function calculateCipa(employees, riskGrade) {
  validateDimension(employees, riskGrade);
  const table = cipaTable[riskGrade];

  if (employees > 10000) {
    return { effective: null, substitutes: null };

  }

  const rangeIndex = cipaRanges.findIndex(([min, max]) => employees >= min && employees <= max);

  return {
    effective: table.effective[rangeIndex],
    substitutes: table.substitutes[rangeIndex],
  };
}

function calculateSesmt(employees, riskGrade) {
  validateDimension(employees, riskGrade);
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
  if (!multiplier || !extra) return base || '';
  const a = parseQuantity(base), b = parseQuantity(extra) * multiplier;
  const partialA = String(base).endsWith('*') && !String(base).endsWith('***');
  const partialB = String(extra).endsWith('*') && !String(extra).endsWith('***');
  if (partialA !== partialB && a && b) return a + (partialA ? '*':'') + ' + ' + b + (partialB ? '*':'');
  return String(a+b) + (partialA || partialB ? '*' : '');
}

function parseQuantity(value) {
  return Number(String(value || "").replace(/\D/g, "")) || 0;
}

function baseHasPartialMark(...values) {
  return values.some((value) => String(value || "").includes("*"));
}


globalThis.GRO_DIMENSION = {calculateCipa, calculateSesmt};

})();
