// ══════════════════════════════════════════════════════════════
//  ESTADO GLOBAL
// ══════════════════════════════════════════════════════════════
let dados        = [];          // cargas em expedição
let faturamento  = [];          // CTEs concluídos / entregues
let importHistory = [];         // histórico de importações para o gráfico de evolução
let logEntradas  = [];
let filtroAtivo  = "todos";
let filtroTempo  = "todos";     // filtro de dias parado
let sortCol      = "status";
let sortAsc      = true;
let modalIdx     = -1;
let modalModo    = "ver";       // "ver" | "editar"
let charts       = {};
let contatos     = { emails: [], whatsapp: [] };
let alertConfig  = { auto: false, critico: true, atencao: true, limiar: 4 };

const fmtBRL = v => (isNaN(v) ? 0 : Number(v)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const slugCTE = s => String(s).trim().replace(/\s+/g, "").toUpperCase();

// ── DADOS DE EXEMPLO ─────────────────────────────────────────
dados = [
  { status:"critico", nf:"NF-00341", cte:"CTE-00341", cliente:"Cerâmica Paulista Ltda",  origem:"São Paulo",      destino:"Fortaleza",     bo:"BO-1041", acr:"ACR-201", dataChegada:"08/06/2026", valor:18540, valorMercadoria:166860, dias:14, previsao:"10/06/2026", ocorrencia:"Avaria na carga",       obs:"Aguardando vistoria", peso:1200, volume:18 },
  { status:"critico", nf:"NF-00298", cte:"CTE-00298", cliente:"Metalúrgica Rio Sul",     origem:"Curitiba",       destino:"Manaus",         bo:"BO-1022", acr:"ACR-188", dataChegada:"11/06/2026", valor:32100, valorMercadoria:288900, dias:11, previsao:"15/06/2026", ocorrencia:"Veículo em manutenção", obs:"Troca de transportadora", peso:3400, volume:42 },
  { status:"critico", nf:"NF-00415", cte:"CTE-00415", cliente:"Distribuidora Norte",     origem:"Belo Horizonte", destino:"Belém",          bo:"BO-1078", acr:"ACR-244", dataChegada:"13/06/2026", valor:9870, valorMercadoria:88830,  dias:9,  previsao:"18/06/2026", ocorrencia:"Destinatário ausente",  obs:"3ª tentativa", peso:860,  volume:9  },
  { status:"atencao", nf:"NF-00387", cte:"CTE-00387", cliente:"Supermercados Estrela",   origem:"Campinas",       destino:"Salvador",       bo:"—",       acr:"ACR-099", dataChegada:"15/06/2026", valor:5420, valorMercadoria:48780,  dias:5,  previsao:"20/06/2026", ocorrencia:"Em rota de entrega",    obs:"", peso:540,  volume:6  },
  { status:"atencao", nf:"NF-00402", cte:"CTE-00402", cliente:"Farmacêutica Nacional",   origem:"Porto Alegre",   destino:"Recife",         bo:"BO-1090", acr:"—",       dataChegada:"16/06/2026", valor:41200, valorMercadoria:370800, dias:6,  previsao:"22/06/2026", ocorrencia:"Aguardando coleta",     obs:"Carga refrigerada", peso:2100, volume:27 },
  { status:"atencao", nf:"NF-00356", cte:"CTE-00356", cliente:"Construtora Horizonte",   origem:"Goiânia",        destino:"Rio de Janeiro", bo:"—",       acr:"—",       dataChegada:"17/06/2026", valor:7800, valorMercadoria:70200,  dias:4,  previsao:"24/06/2026", ocorrencia:"Em trânsito",           obs:"", peso:1750, volume:14 },
  { status:"normal",  nf:"NF-00430", cte:"CTE-00430", cliente:"TechParts Eletrônicos",   origem:"São Paulo",      destino:"Curitiba",       bo:"BO-1103", acr:"ACR-310", dataChegada:"18/06/2026", valor:12300, valorMercadoria:110700, dias:1,  previsao:"30/06/2026", ocorrencia:"Coletado na origem",    obs:"", peso:430,  volume:5  },
  { status:"normal",  nf:"NF-00444", cte:"CTE-00444", cliente:"Agro Insumos do Sul",     origem:"Londrina",       destino:"Campo Grande",   bo:"—",       acr:"—",       dataChegada:"19/06/2026", valor:6100, valorMercadoria:54900,  dias:2,  previsao:"05/07/2026", ocorrencia:"Em rota",               obs:"", peso:980,  volume:11 },
  { status:"normal",  nf:"NF-00451", cte:"CTE-00451", cliente:"Moda Brasil Confecções",  origem:"Fortaleza",      destino:"São Paulo",      bo:"—",       acr:"—",       dataChegada:"—",          valor:3250, valorMercadoria:29250,  dias:0,  previsao:"—",          ocorrencia:"Postado",               obs:"", peso:120,  volume:3  },
];

// ══════════════════════════════════════════════════════════════
//  ABAS
// ══════════════════════════════════════════════════════════════
function mudarAba(aba) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  document.getElementById("aba-" + aba).classList.add("active");
  event.currentTarget.classList.add("active");
  if (aba === "graficos") renderGraficos();
  if (aba === "faturamento") renderFaturamentoExecutivo();
  if (aba === "contatos") { renderContatos(); atualizarPreviewAlerta(); }
}

// ══════════════════════════════════════════════════════════════
//  IMPORTAR EXCEL / CSV
// ══════════════════════════════════════════════════════════════
function handleDrop(e) {
  e.preventDefault();
  document.getElementById("upload-zone").classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file) processarArquivo(file);
}

function importarArquivo(input) {
  const file = input.files[0];
  if (file) processarArquivo(file);
  input.value = "";
}

function processarArquivo(file) {
  const logEl = document.getElementById("upload-log");
  logEl.innerHTML = `<span style="color:var(--blue)">⏳ Lendo ${file.name}…</span>`;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      let rows = [];
      if (file.name.endsWith(".csv")) {
        const text = e.target.result;
        const lines = text.split("\n").map(l => l.split(/[,;]/).map(c => c.trim().replace(/^"|"$/g,"")));
        const header = lines[0].map(h => h.toLowerCase());
        rows = lines.slice(1).filter(r => r.length > 1).map(r => {
          const obj = {};
          header.forEach((h, i) => obj[h] = r[i] || "");
          return obj;
        });
      } else {
        const wb = XLSX.read(e.target.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
      }
      processarLinhas(rows, file.name);
    } catch(err) {
      logEl.innerHTML = `<span class="err">❌ Erro ao ler arquivo: ${err.message}</span>`;
    }
  };
  if (file.name.endsWith(".csv"))
    reader.readAsText(file, "UTF-8");
  else
    reader.readAsBinaryString(file);
}

// Converte datas do Excel (serial number ou objeto Date) para string dd/mm/aaaa
function excelDateToStr(v) {
  if (v instanceof Date && !isNaN(v)) {
    return v.toLocaleDateString("pt-BR");
  }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    // Número de série de data do Excel
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d)) return d.toLocaleDateString("pt-BR");
  }
  const s = String(v ?? "").trim();
  return s;
}

// Calcula dias parado SEMPRE a partir da data de chegada na unidade vs hoje.
// Não depende mais de um valor "dias" congelado no momento da importação —
// assim o contador avança dia a dia, mesmo que o item não seja reimportado,
// e permanece correto após recarregar os dados do Firebase.
function calcularDiasParado(d) {
  if (!d.dataChegada || d.dataChegada === "—") return 0;
  const dt = parseDataBR(d.dataChegada);
  if (!dt) return 0;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  dt.setHours(0,0,0,0);
  const diff = Math.floor((hoje - dt) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

// Converte string de data em objeto Date (00:00) — usado no painel de prazos.
// Aceita tanto o formato BR (dd/mm/aaaa, com ou sem hora anexada) quanto o
// formato ISO (aaaa-mm-dd, com ou sem hora anexada). Antes só o formato BR
// era reconhecido — quando a planilha trazia a Previsão já em ISO
// ("2026-06-30"), o regex não batia, a data virava null e o registro caía
// sempre em "Sem Previsão", zerando os demais contadores do painel de prazos.
function parseDataBR(s) {
  if (!s || s === "—") return null;
  const str = String(s).trim();

  // Formato BR: dd/mm/aaaa
  let m = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [, dd, mm, yyyy] = m;
    if (yyyy.length === 2) yyyy = "20" + yyyy;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d) ? null : d;
  }

  // Formato ISO: aaaa-mm-dd
  m = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, yyyy, mm, dd] = m;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return isNaN(d) ? null : d;
  }

  return null;
}

// Mapeamento flexível de colunas
function mapearColunas(row) {
  // Normaliza acentos, underscores, pontos e hífens para espaço único, assim
  // "data_chegada" (planilha) e "data chegada" (candidato) batem corretamente.
  // Antes disso o underscore quebrava o match e "chegada na unidade" nunca era
  // encontrado -> dataChegada ficava sempre "—" -> Dias Parado sempre 0d.
  const normKey = k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[_\-.]+/g," ").replace(/\s+/g," ").trim();
  const keys = Object.keys(row).map(normKey);
  const vals = Object.values(row);
  // Busca por correspondência exata primeiro, depois por inclusão — evita que
  // candidatos genéricos ("prev", "bo") capturem a coluna errada.
  const getRaw = (...candidates) => {
    const cands = candidates.map(normKey);
    for (const c of cands) {
      const idx = keys.findIndex(k => k === c);
      if (idx !== -1) return vals[idx];
    }
    for (const c of cands) {
      const idx = keys.findIndex(k => k.includes(c));
      if (idx !== -1) return vals[idx];
    }
    return "";
  };
  const get = (...candidates) => String(getRaw(...candidates) ?? "").trim();
  return {
    cte:            get("cte","ct-e","numero cte","num cte") || get("nf","nota"),
    nf:             get("nf","nota fiscal","nf-e") || get("cte","ct-e"),
    cliente:        get("destinatario","cliente","dest"),
    remetente:      get("remetente","origem remetente","rem"),
    origem:         get("origem","bairro","municipio orig","cidade orig"),
    destino:        get("destino","municipio dest","cidade dest"),
    bo:             get("b.o","bo","boletim de ocorrencia","boletim"),
    acr:            get("acr"),
    dataChegada:    excelDateToStr(getRaw("data chegada na unidade","data de chegada","data chegada","chegada na unidade","chegada_unidade","chegada unidade")),
    valor:          get("valor_frete","valor frete","frete"),
    valorMercadoria: get("valor_cte","valor cte","valor do cte","valor mercadoria","valor da mercadoria","vlr mercadoria","mercadoria"),
    previsao:       excelDateToStr(getRaw("previsao","previsão","data prevista","data_prevista","prev entrega","prev. entrega")),
    ocorrencia:     get("ocorrencia","ocorrência","ultima ocorrencia","status ocor","manifesto"),
    dias:           get("dias","dias parado","days"),
    peso:           get("peso","weight"),
    volume:         get("volume","volumes","vol"),
  };
}

function detectarStatus(d) {
  if (Number(d.dias) >= 8) return "critico";
  if (Number(d.dias) >= 4) return "atencao";
  return "normal";
}

// Recalcula "dias parado" (a partir da data de chegada x hoje) e o status
// derivado para TODOS os registros. Deve ser chamada sempre que os dados
// forem carregados/sincronizados (Firebase, importação, ou periodicamente),
// para que o contador de atraso avance mesmo sem novas importações.
// Se o usuário fixou manualmente o campo "dias" (edição manual > 0), esse
// valor é respeitado e não é sobrescrito pelo cálculo automático.
function sincronizarDiasEStatus() {
  dados.forEach(d => {
    const manual = !!(d.diasManual && Number(d.diasManual) > 0);
    d._diasCalc = manual ? Number(d.diasManual) : calcularDiasParado(d);
    d.dias = d._diasCalc;
    if (!manual) {
      d.status = detectarStatus({ dias: d._diasCalc });
    }
  });
}

function processarLinhas(rows, filename) {
  const logEl = document.getElementById("upload-log");
  if (!rows.length) {
    logEl.innerHTML = `<span class="err">❌ Arquivo vazio ou formato não reconhecido.</span>`;
    return;
  }

  // CTEs já existentes no relatório ativo
  const ctesAtivos    = new Set(dados.map(d => slugCTE(d.cte)));
  // CTEs já no faturamento
  const ctesFaturados = new Set(faturamento.map(d => slugCTE(d.cte)));

  // CTEs que estavam ativos mas não aparecem mais no novo relatório → entregues
  const ctesNoRelatorio = new Set(rows.map(r => slugCTE(mapearColunas(r).cte)));
  const entregues = dados.filter(d => !ctesNoRelatorio.has(slugCTE(d.cte)));

  let adicionados = 0, duplicados = 0, atualizados = 0;
  const novos = [];

  for (const row of rows) {
    const m = mapearColunas(row);
    if (!m.cte && !m.nf) continue;
    const cteKey = slugCTE(m.cte || m.nf);

    // Checar duplicidade
    if (ctesFaturados.has(cteKey)) { duplicados++; continue; }

    const existIdx = dados.findIndex(d => slugCTE(d.cte) === cteKey);
    const dataChegada = m.dataChegada || "—";
    // Se a planilha trouxer uma coluna "dias" explícita, ela vira override manual;
    // caso contrário o contador é calculado a partir da data de chegada e mantido
    // sempre atualizado por sincronizarDiasEStatus().
    const diasPlanilha = parseInt(m.dias) || 0;
    const diasCalc = diasPlanilha > 0 ? diasPlanilha : calcularDiasParado({ dataChegada });
    const registro = {
      status:         detectarStatus({ dias: diasCalc }),
      cte:            m.cte || m.nf,
      nf:             m.nf  || m.cte,
      cliente:        m.cliente || m.destinatario || "—",
      remetente:      m.remetente || "—",
      origem:         m.origem || "—",
      destino:        m.destino || "—",
      bo:             m.bo || "—",
      acr:            m.acr || "—",
      dataChegada:    dataChegada,
      valor:          parseFloat(String(m.valor).replace(/[^\d.,]/g,"").replace(",",".")) || 0,
      valorMercadoria: parseFloat(String(m.valorMercadoria).replace(/[^\d.,]/g,"").replace(",",".")) || 0,
      previsao:       m.previsao || "—",
      ocorrencia:     m.ocorrencia || "Em trânsito",
      dias:           diasCalc,
      diasManual:     diasPlanilha > 0 ? diasPlanilha : 0,
      peso:           parseFloat(String(m.peso).replace(/[^\d.,]/g,"").replace(",",".")) || 0,
      volume:         parseInt(m.volume) || 0,
      obs:            "",
    };

    if (existIdx >= 0) {
      // Preserva um override manual já existente (ex.: editado pelo usuário no modal),
      // a menos que a nova planilha traga um valor explícito de "dias".
      if (!registro.diasManual && dados[existIdx].diasManual) {
        registro.diasManual = dados[existIdx].diasManual;
      }
      dados[existIdx] = { ...dados[existIdx], ...registro };
      atualizados++;
    } else {
      novos.push(registro);
      adicionados++;
      duplicados += 0; // não duplicado
    }
  }

  // Mover entregues para faturamento
  let movidos = 0;
  for (const d of entregues) {
    const cteKey = slugCTE(d.cte);
    if (!ctesFaturados.has(cteKey)) {
      faturamento.unshift({ ...d, dataConclusao: new Date().toLocaleDateString("pt-BR") });
      ctesFaturados.add(cteKey);
      movidos++;
    }
  }

  // Registrar no histórico de importações (para o gráfico de evolução)
  const totalNovos = dados.concat(novos).reduce((a, d) => a + d.valor, 0);
  importHistory.push({
    label: filename.substring(0,18) + (filename.length>18?"…":""),
    data: new Date().toLocaleDateString("pt-BR"),
    valor: totalNovos,
    qtd: dados.length + novos.length,
  });

  // Remover entregues dos dados ativos e adicionar novos
  dados = dados.filter(d => !entregues.find(e => slugCTE(e.cte) === slugCTE(d.cte)));
  dados.push(...novos);
  sincronizarDiasEStatus();

  logEl.innerHTML = [
    adicionados > 0 ? `<span class="ok">✅ ${adicionados} novos CTEs adicionados</span>` : "",
    atualizados > 0 ? `<span class="ok"> · ${atualizados} atualizados</span>` : "",
    duplicados  > 0 ? `<span class="warn"> · ${duplicados} duplicados ignorados</span>` : "",
    movidos     > 0 ? `<span style="color:var(--blue)"> · ${movidos} movidos para Faturamento 📊</span>` : "",
  ].filter(Boolean).join("") || `<span class="ok">✅ Relatório processado sem alterações.</span>`;

  atualizarCards();
  renderTabela();
  renderFaturamento();
  atualizarTabBadges();
  adicionarLog("Importação", adicionados + atualizados, dados.reduce((a,d)=>a+d.valor,0), Math.max(0,...dados.map(d=>d.dias)));

  if (movidos > 0) toast(`📊 ${movidos} entrega(s) movida(s) para Gráficos & Faturamento`, "ok");
  toast(`📂 Arquivo importado: ${adicionados} novo(s)${duplicados>0?" · "+duplicados+" ignorado(s)":""}`);

  // Salvar no Firestore
  fbSalvarTudo();
}

// ══════════════════════════════════════════════════════════════
//  EXPORTAR CSV
// ══════════════════════════════════════════════════════════════
function exportarCSV() {
  if (!dados.length) { toast("Sem dados para exportar.", "error"); return; }
  const header = ["CTE","NF","Status","Cliente","Origem","Destino","B.O","ACR","Chegada na Unidade","Valor Frete","Valor Mercadoria","Dias","Previsao","Ocorrencia"];
  const rows = dados.map(d => [d.cte,d.nf,d.status,d.cliente,d.origem,d.destino,d.bo,d.acr,d.dataChegada,d.valor,d.valorMercadoria,d.dias,d.previsao,d.ocorrencia]);
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(";")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "expedicao_" + new Date().toISOString().slice(0,10) + ".csv";
  a.click();
  toast("⬇️ CSV exportado com sucesso!");
}

// ══════════════════════════════════════════════════════════════
//  LIMPAR DADOS
// ══════════════════════════════════════════════════════════════
function limparDados() {
  if (!dados.length && !faturamento.length) { toast("Não há dados para limpar.", "error"); return; }
  if (!confirm("Tem certeza que deseja apagar TODOS os dados (expedição e faturamento)? Esta ação não pode ser desfeita.")) return;
  dados = [];
  faturamento = [];
  importHistory = [];
  atualizarCards();
  renderTabela();
  renderFaturamento();
  renderGraficos();
  atualizarTabBadges();
  document.getElementById("upload-log").innerHTML = "Aguardando importação…";
  adicionarLog("Limpeza", 0, 0, 0);
  toast("🗑️ Todos os dados foram apagados.");
  fbLimpar().then(() => setSyncStatus("ok"));
}

// ══════════════════════════════════════════════════════════════
//  CARDS
// ══════════════════════════════════════════════════════════════
function atualizarCards() {
  const totalCargas   = dados.length;
  const importados    = dados.filter(d => d.cte && d.cte !== "—").length;
  const totalVolumes  = dados.reduce((a,d) => a + (d.volume || 0), 0);
  const pesoTotal     = dados.reduce((a,d) => a + (d.peso || 0), 0);
  const valorTotal    = dados.reduce((a,d) => a + (d.valor || 0), 0);
  const valorMerc     = dados.reduce((a,d) => a + (d.valorMercadoria || 0), 0);

  document.getElementById("cnt-total").textContent      = totalCargas;
  document.getElementById("cnt-importados").textContent = importados;
  document.getElementById("cnt-volumes").textContent    = totalVolumes.toLocaleString("pt-BR");
  document.getElementById("cnt-peso").textContent       = pesoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  document.getElementById("val-total").textContent      = fmtBRL(valorTotal);
  document.getElementById("val-mercadoria").textContent = fmtBRL(valorMerc);

  // Painel de Prazos de Entrega
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em3  = new Date(hoje); em3.setDate(em3.getDate() + 3);
  const em5  = new Date(hoje); em5.setDate(em5.getDate() + 5);

  let vencidas = 0, venceHoje = 0, ate3 = 0, ate5 = 0, dentro = 0, semPrevisao = 0;
  for (const d of dados) {
    const dt = parseDataBR(d.previsao);
    if (!dt) { semPrevisao++; continue; }
    if (dt < hoje) vencidas++;
    else if (dt.getTime() === hoje.getTime()) venceHoje++;
    else if (dt <= em3) ate3++;
    else if (dt <= em5) ate5++;
    else dentro++;
  }

  document.getElementById("cnt-vencidas").textContent     = vencidas;
  document.getElementById("cnt-vencehoje").textContent    = venceHoje;
  document.getElementById("cnt-ate3").textContent         = ate3;
  document.getElementById("cnt-ate5").textContent         = ate5;
  document.getElementById("cnt-dentro").textContent       = dentro;
  document.getElementById("cnt-semprevisao").textContent  = semPrevisao;

  const banner = document.getElementById("alert-banner");
  if (vencidas > 0 || venceHoje > 0) {
    banner.classList.remove("hidden");
    document.getElementById("alert-banner-text").textContent =
      `Existem cargas com prazo vencido ou vencendo hoje. Verifique o painel de prazos. Vencidas: ${vencidas} | Vencem hoje: ${venceHoje}`;
  } else {
    banner.classList.add("hidden");
  }
}

function atualizarTabBadges() {
  document.getElementById("tab-badge-exp").textContent  = dados.filter(d=>d.status==="critico").length;
  document.getElementById("tab-badge-graf").textContent = faturamento.length;
  document.getElementById("tab-badge-contatos").textContent = contatos.emails.length + contatos.whatsapp.length;
  const badgeFatn = document.getElementById("tab-badge-fatn");
  if (badgeFatn) badgeFatn.textContent = getFaturamentoUltimos3Meses().reduce((a, m) => a + m.qtd, 0);
}

// ══════════════════════════════════════════════════════════════
//  TRATATIVAS — registro de acompanhamento de cada carga, para
//  deixar visível se a entrega já está sendo tratada pela equipe.
// ══════════════════════════════════════════════════════════════
function fmtDataHora(dt) {
  return dt.toLocaleDateString("pt-BR") + " " + dt.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" });
}

// Badge exibido na tabela: verde "Tratada" com a última nota, ou amarelo "Pendente"
function tratativaBadgeHTML(d, idx) {
  const trats = d.tratativas || [];
  if (!trats.length) {
    return `<span class="trat-badge pendente" onclick="abrirModal(${idx},'ver')" title="Nenhuma tratativa registrada">⏳ Pendente</span>`;
  }
  const ultima = trats[trats.length - 1];
  const dataStr = ultima.data ? new Date(ultima.data).toLocaleDateString("pt-BR") : "";
  return `<span class="trat-badge tratada" onclick="abrirModal(${idx},'ver')" title="${(ultima.texto||"").replace(/"/g,'&quot;')}">✅ Tratada (${trats.length})${dataStr ? " · " + dataStr : ""}</span>`;
}

// Monta o HTML da seção de tratativas exibida dentro do modal de detalhes
function renderTratativasSection(d) {
  const trats = d.tratativas || [];
  const listaHTML = trats.length
    ? [...trats].reverse().map(t => `
        <div class="trat-item">
          <div class="trat-item-meta">
            <span>${t.data ? fmtDataHora(new Date(t.data)) : "—"}${t.autor ? " · " + t.autor : ""}</span>
          </div>
          <div class="trat-item-txt">${(t.texto || "").replace(/</g,"&lt;")}</div>
        </div>`).join("")
    : `<div class="trat-empty">Nenhuma tratativa registrada ainda para esta carga.</div>`;

  return `
    <div class="trat-section">
      <div class="trat-section-title">
        <span>📋 Tratativas (${trats.length})</span>
      </div>
      <div class="trat-list">${listaHTML}</div>
      <div class="trat-add">
        <textarea class="trat-textarea" id="nova-tratativa" placeholder="Descreva a ação realizada ou o andamento da entrega…"></textarea>
        <button class="btn-trat-add" onclick="adicionarTratativa()">➕ Registrar Tratativa</button>
      </div>
    </div>`;
}

// Adiciona uma nova tratativa ao registro atualmente aberto no modal
function adicionarTratativa() {
  const txt = document.getElementById("nova-tratativa").value.trim();
  if (!txt) { toast("Digite a tratativa antes de registrar.", "error"); return; }
  const d = dados[modalIdx];
  if (!d) return;
  if (!d.tratativas) d.tratativas = [];
  d.tratativas.push({ texto: txt, data: new Date().toISOString() });
  toast("📋 Tratativa registrada com sucesso!");
  abrirModal(modalIdx, "ver"); // re-renderiza o modal com a nova tratativa
  renderTabela();
  fbSalvarTudo();
}

// ══════════════════════════════════════════════════════════════
//  TABELA EXPEDIÇÃO
// ══════════════════════════════════════════════════════════════
function setFiltro(f) {
  filtroAtivo = f;
  document.querySelectorAll(".filter-btn").forEach(b => b.className = "filter-btn");
  const ids = { todos:"btn-todos", critico:"btn-critico", atencao:"btn-atencao", normal:"btn-normal", sem_tratativa:"btn-semtrat" };
  const cls  = { todos:"active", critico:"active", atencao:"active-y", normal:"active-g", sem_tratativa:"active-y" };
  document.getElementById(ids[f]).className = "filter-btn " + cls[f];
  renderTabela();
}

function setFiltroTempo(tipo) {
  filtroTempo = tipo;
  const btns = ["btn-dias-todos","btn-dias-0","btn-dias-4","btn-dias-8","btn-dias-15"];
  const mapa  = { "todos":"btn-dias-todos","0-3":"btn-dias-0","4-7":"btn-dias-4","8-14":"btn-dias-8","15+":"btn-dias-15" };
  btns.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = "filter-btn";
  });
  const activeBtnId = mapa[tipo];
  if (activeBtnId) {
    const el = document.getElementById(activeBtnId);
    if (el) el.className = "filter-btn active";
  }
  const info = document.getElementById("dias-filter-info");
  if (info) {
    const labels = { "todos":"Mostrando todos","0-3":"Filtro: 0–3 dias","4-7":"Filtro: 4–7 dias","8-14":"Filtro: 8–14 dias","15+":"Filtro: 15+ dias","custom":"Filtro personalizado" };
    info.textContent = labels[tipo] || "Filtro personalizado";
  }
  renderTabela();
}

function sortBy(col) {
  if (sortCol === col) sortAsc = !sortAsc; else { sortCol = col; sortAsc = true; }
  renderTabela();
}

function statusLabel(s) {
  if (s === "critico") return { emoji:"🔴", texto:"CRÍTICO", cls:"critico" };
  if (s === "atencao") return { emoji:"🟡", texto:"ATENÇÃO",  cls:"atencao" };
  return                      { emoji:"🟢", texto:"NORMAL",   cls:"normal"  };
}

function diasCls(d) {
  if (d >= 8) return "alto";
  if (d >= 4) return "medio";
  return "baixo";
}

function renderTabela() {
  const q = document.getElementById("search").value.toLowerCase();
  // Auto-calcular dias parado (e status) para cada item, respeitando overrides manuais
  sincronizarDiasEStatus();

  let lista = dados.filter(d => {
    if (filtroAtivo === "sem_tratativa") { if ((d.tratativas || []).length > 0) return false; }
    else if (filtroAtivo !== "todos" && d.status !== filtroAtivo) return false;
    if (q && !`${d.nf} ${d.cte} ${d.cliente} ${d.bo} ${d.acr} ${d.origem} ${d.destino}`.toLowerCase().includes(q)) return false;
    // filtro de tempo
    const dc = d._diasCalc;
    if (filtroTempo === "0-3"  && (dc < 0  || dc > 3))  return false;
    if (filtroTempo === "4-7"  && (dc < 4  || dc > 7))  return false;
    if (filtroTempo === "8-14" && (dc < 8  || dc > 14)) return false;
    if (filtroTempo === "15+"  && dc < 15)               return false;
    if (filtroTempo === "custom") {
      const mn = parseInt(document.getElementById("dias-min").value);
      const mx = parseInt(document.getElementById("dias-max").value);
      if (!isNaN(mn) && dc < mn) return false;
      if (!isNaN(mx) && dc > mx) return false;
    }
    return true;
  });
  lista.sort((a, b) => {
    let va = a[sortCol] ?? "", vb = b[sortCol] ?? "";
    if (sortCol === "status") { const ord={critico:0,atencao:1,normal:2}; va=ord[va]; vb=ord[vb]; }
    if (typeof va === "number") return sortAsc ? va-vb : vb-va;
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });

  const tbody = document.getElementById("tbody");
  document.getElementById("table-count").textContent = lista.length + " registro" + (lista.length !== 1 ? "s" : "");

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="13"><div class="empty"><div class="empty-icon">📭</div><p>Nenhuma carga encontrada.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(d => {
    const s   = statusLabel(d.status);
    const idx = dados.indexOf(d);
    return `
    <tr class="${d.status==="critico"?"row-critical":""}" style="cursor:pointer;" onclick="abrirModal(${idx},'ver')">
      <td><span class="status-badge ${s.cls}">${s.emoji} ${s.texto}</span></td>
      <td><span class="nf-code">${d.cte || d.nf}</span></td>
      <td>${d.cliente}</td>
      <td class="rota">${d.origem}<span class="arrow">→</span>${d.destino}</td>
      <td style="font-size:11px;font-family:var(--mono);color:var(--muted)">${d.bo || "—"}</td>
      <td style="font-size:11px;font-family:var(--mono);color:var(--muted)">${d.acr || "—"}</td>
      <td style="color:var(--muted);font-size:11px;font-family:var(--mono)">${d.dataChegada || "—"}</td>
      <td class="valor">${fmtBRL(d.valor)}</td>
      <td><span class="dias ${diasCls(d._diasCalc)}" title="${d.dataChegada && d.dataChegada !== '—' ? 'Desde: ' + d.dataChegada : 'Dias informados'}">${d._diasCalc}d${d.dataChegada && d.dataChegada !== '—' && !d.dias ? ' ⏱' : ''}</span></td>
      <td style="color:var(--muted);font-size:11px;font-family:var(--mono)">${d.previsao}</td>
      <td style="color:var(--muted);font-size:11px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${d.ocorrencia}">${d.ocorrencia}</td>
      <td onclick="event.stopPropagation()">${tratativaBadgeHTML(d, idx)}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-edit" onclick="abrirModal(${idx},'editar')">✏️ Alterar</button>
        <button class="btn-ghost" onclick="abrirModal(${idx},'ver')">Ver</button>
      </td>
    </tr>`;
  }).join("");
}

// ══════════════════════════════════════════════════════════════
//  TABELA FATURAMENTO
// ══════════════════════════════════════════════════════════════
function renderFaturamento() {
  const tbody = document.getElementById("tbody-fat");
  document.getElementById("fat-count").textContent = faturamento.length + " registros";
  if (!faturamento.length) {
    tbody.innerHTML = `<tr><td colspan="10"><div class="empty"><div class="empty-icon">📦</div><p>Nenhuma entrega concluída ainda.<br>Importe um novo relatório e os CTEs ausentes serão movidos para cá.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = faturamento.map((d, i) => `
    <tr onclick="abrirModalFat(${i})" style="cursor:pointer;">
      <td><span class="nf-code">${d.cte || d.nf}</span></td>
      <td>${d.cliente}</td>
      <td class="rota">${d.origem}<span class="arrow">→</span>${d.destino}</td>
      <td style="font-size:11px;font-family:var(--mono);color:var(--muted)">${d.bo || "—"}</td>
      <td style="font-size:11px;font-family:var(--mono);color:var(--muted)">${d.acr || "—"}</td>
      <td style="color:var(--muted);font-size:11px;font-family:var(--mono)">${d.dataChegada || "—"}</td>
      <td class="valor">${fmtBRL(d.valor)}</td>
      <td style="color:var(--muted);font-size:11px;font-family:var(--mono)">${d.previsao}</td>
      <td style="color:var(--green);font-size:12px;">${d.dataConclusao}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn-edit" onclick="abrirModalFat(${i})">✏️ Alterar</button>
        <button class="btn-ghost" onclick="reativarCTE(${i})">↩️ Reativar</button>
      </td>
    </tr>`).join("");
}

function reativarCTE(i) {
  const d = faturamento[i];
  dados.push({ ...d, dataConclusao: undefined });
  faturamento.splice(i, 1);
  atualizarCards();
  renderTabela();
  renderFaturamento();
  atualizarTabBadges();
  toast("↩️ CTE " + (d.cte || d.nf) + " reativado na expedição.");
  fbSalvarTudo();
}

// ══════════════════════════════════════════════════════════════
//  MODAL VER / EDITAR (expedição)
// ══════════════════════════════════════════════════════════════
let modalCompartilhar = null; // { d, tipo } — registro atualmente exibido, usado por compartilharCard()

function abrirModal(idx, modo) {
  modalIdx  = idx;
  modalModo = modo;
  const d   = dados[idx];
  sincronizarDiasEStatus(); // garante que "Dias Parado" e status estejam atualizados na hora de abrir
  const s   = statusLabel(d.status);
  modalCompartilhar = { d, tipo: "expedicao" };

  document.getElementById("modal-title").textContent = modo === "editar" ? "✏️ Editar CTE" : d.cliente;
  document.getElementById("modal-sub").textContent   = (d.cte || d.nf) + " • " + (d.dataChegada || "—");

  if (modo === "ver") {
    document.getElementById("modal-body").innerHTML = `
      <div style="margin-bottom:16px;">
        <span class="status-badge ${s.cls}" style="font-size:13px;padding:6px 14px;">${s.emoji} ${s.texto}</span>
      </div>
      <div class="detail-grid">
        <div class="detail-field"><label>CTE / NF</label><div class="val mono">${d.cte || d.nf}</div></div>
        <div class="detail-field"><label>Valor Frete</label><div class="val mono">${fmtBRL(d.valor)}</div></div>
        <div class="detail-field"><label>Valor Mercadoria</label><div class="val mono">${fmtBRL(d.valorMercadoria)}</div></div>
        <div class="detail-field"><label>Origem</label><div class="val">${d.origem}</div></div>
        <div class="detail-field"><label>Destino</label><div class="val">${d.destino}</div></div>
        <div class="detail-field"><label>B.O</label><div class="val">${d.bo || "—"}</div></div>
        <div class="detail-field"><label>ACR</label><div class="val">${d.acr || "—"}</div></div>
        <div class="detail-field"><label>Chegada na Unidade</label><div class="val">${d.dataChegada || "—"}</div></div>
        <div class="detail-field"><label>Previsão</label><div class="val">${d.previsao}</div></div>
        <div class="detail-field"><label>Dias Parado</label><div class="val mono dias ${diasCls(d.dias)}">${d.dias} dias</div></div>
        <div class="detail-field"><label>Última Ocorrência</label><div class="val">${d.ocorrencia || "—"}</div></div>
      </div>
      ${d.obs ? `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px;">
        <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Observações</div>
        <div style="font-size:13px;">${d.obs}</div></div>` : ""}
      ${renderTratativasSection(d)}`;
    document.getElementById("modal-action-btn").textContent = "✅ Fechar";
    document.getElementById("modal-action-btn").onclick = fecharModal;
  } else {
    document.getElementById("modal-body").innerHTML = `
      <div class="detail-grid">
        <div class="detail-field"><label>Status</label>
          <select class="edit-input" id="e-status">
            <option value="critico" ${d.status==="critico"?"selected":""}>🔴 CRÍTICO</option>
            <option value="atencao" ${d.status==="atencao"?"selected":""}>🟡 ATENÇÃO</option>
            <option value="normal"  ${d.status==="normal" ?"selected":""}>🟢 NORMAL</option>
          </select></div>
        <div class="detail-field"><label>Dias Parado</label><input class="edit-input" id="e-dias" type="number" min="0" value="${d.dias}" /></div>
        <div class="detail-field"><label>B.O</label><input class="edit-input" id="e-bo" value="${d.bo || ""}" /></div>
        <div class="detail-field"><label>ACR</label><input class="edit-input" id="e-acr" value="${d.acr || ""}" /></div>
        <div class="detail-field"><label>Chegada na Unidade</label><input class="edit-input" id="e-chegada" value="${d.dataChegada || ""}" /></div>
        <div class="detail-field"><label>Previsão de Entrega</label><input class="edit-input" id="e-prev" value="${d.previsao}" /></div>
        <div class="detail-field"><label>Última Ocorrência</label><input class="edit-input" id="e-ocor" value="${d.ocorrencia}" /></div>
        <div class="detail-field"><label>Valor Frete (R$)</label><input class="edit-input" id="e-valor" type="number" step="0.01" value="${d.valor}" /></div>
        <div class="detail-field"><label>Valor Mercadoria (R$)</label><input class="edit-input" id="e-merc" type="number" step="0.01" value="${d.valorMercadoria || 0}" /></div>
      </div>
      <div class="detail-field" style="margin-top:8px;"><label>Observações</label><input class="edit-input" id="e-obs" value="${d.obs}" /></div>`;
    document.getElementById("modal-action-btn").textContent = "💾 Salvar Alterações";
    document.getElementById("modal-action-btn").onclick = salvarEdicao;
  }

  document.getElementById("modal").classList.add("open");
}

function salvarEdicao() {
  const d = dados[modalIdx];
  d.bo             = document.getElementById("e-bo").value.trim();
  d.acr            = document.getElementById("e-acr").value.trim();
  d.dataChegada    = document.getElementById("e-chegada").value.trim();
  d.previsao       = document.getElementById("e-prev").value.trim();
  d.ocorrencia     = document.getElementById("e-ocor").value.trim();
  d.valor          = parseFloat(document.getElementById("e-valor").value) || 0;
  d.valorMercadoria = parseFloat(document.getElementById("e-merc").value) || 0;
  d.obs            = document.getElementById("e-obs").value.trim();

  // "Dias Parado": se o valor digitado bater com o calculado automaticamente
  // pela data de chegada, o campo volta a ser dinâmico (continua contando
  // sozinho). Se o usuário digitou algo diferente, isso vira um override
  // manual fixo (ex.: correção pontual).
  const diasDigitado = parseInt(document.getElementById("e-dias").value) || 0;
  const diasAuto      = calcularDiasParado(d);
  if (diasDigitado === diasAuto) {
    d.diasManual = 0;
    d.dias = diasAuto;
  } else {
    d.diasManual = diasDigitado;
    d.dias = diasDigitado;
  }

  // Status: se o usuário mudou manualmente no seletor, respeitamos; senão
  // deixamos sincronizarDiasEStatus recalcular a partir dos dias atuais.
  const statusSelecionado = document.getElementById("e-status").value;
  d.status = statusSelecionado;
  const statusAuto = detectarStatus({ dias: d.dias });
  if (!d.diasManual && statusSelecionado === statusAuto) {
    d.status = statusAuto; // mantém coerente e permite recálculo futuro automático
  } else if (!d.diasManual && statusSelecionado !== statusAuto) {
    // usuário forçou um status diferente do que os dias indicam → tratamos
    // como override manual também, para não "voltar sozinho"
    d.diasManual = d.dias || diasAuto || 1;
  }

  fecharModal();
  sincronizarDiasEStatus();
  atualizarCards();
  renderTabela();
  atualizarTabBadges();
  toast("💾 CTE " + (d.cte || d.nf) + " atualizado com sucesso!");
  fbSalvarTudo();
}

// Modal faturamento
function abrirModalFat(i) {
  const d = faturamento[i];
  modalCompartilhar = { d, tipo: "faturamento" };
  document.getElementById("modal-title").textContent = "📦 " + d.cliente;
  document.getElementById("modal-sub").textContent   = (d.cte || d.nf) + " • Entregue em " + d.dataConclusao;
  document.getElementById("modal-body").innerHTML = `
    <div class="detail-grid">
      <div class="detail-field"><label>CTE / NF</label><div class="val mono">${d.cte || d.nf}</div></div>
      <div class="detail-field"><label>Valor Frete</label><div class="val mono">${fmtBRL(d.valor)}</div></div>
      <div class="detail-field"><label>Valor Mercadoria</label><div class="val mono">${fmtBRL(d.valorMercadoria)}</div></div>
      <div class="detail-field"><label>Origem</label><div class="val">${d.origem}</div></div>
      <div class="detail-field"><label>Destino</label><div class="val">${d.destino}</div></div>
      <div class="detail-field"><label>B.O</label><div class="val">${d.bo || "—"}</div></div>
      <div class="detail-field"><label>ACR</label><div class="val">${d.acr || "—"}</div></div>
      <div class="detail-field"><label>Chegada na Unidade</label><div class="val">${d.dataChegada || "—"}</div></div>
      <div class="detail-field"><label>Previsão Original</label><div class="val">${d.previsao}</div></div>
      <div class="detail-field"><label>Data Conclusão</label><div class="val" style="color:var(--green)">${d.dataConclusao}</div></div>
    </div>`;
  document.getElementById("modal-action-btn").textContent = "↩️ Reativar CTE";
  document.getElementById("modal-action-btn").onclick = () => { fecharModal(); reativarCTE(i); };
  document.getElementById("modal").classList.add("open");
}

function fecharModal() {
  document.getElementById("modal").classList.remove("open");
}

// ══════════════════════════════════════════════════════════════
//  COMPARTILHAR CARD
// ══════════════════════════════════════════════════════════════
function montarTextoCompartilhar(d, tipo) {
  const s = statusLabel(d.status);
  const linhas = [
    `📦 *${d.cliente}*`,
    `CTE/NF: ${d.cte || d.nf}`,
    tipo === "expedicao" ? `Status: ${s.emoji} ${s.texto}` : `Status: ✅ Entregue`,
    `Origem: ${d.origem || "—"}  →  Destino: ${d.destino || "—"}`,
    `Valor Frete: ${fmtBRL(d.valor)}`,
    `Valor Mercadoria: ${fmtBRL(d.valorMercadoria)}`,
    d.bo && d.bo !== "—" ? `B.O: ${d.bo}` : "",
    d.acr && d.acr !== "—" ? `ACR: ${d.acr}` : "",
    `Chegada na Unidade: ${d.dataChegada || "—"}`,
  ];
  if (tipo === "expedicao") {
    linhas.push(`Previsão: ${d.previsao || "—"}`);
    linhas.push(`Dias Parado: ${d.dias} dias`);
    linhas.push(`Última Ocorrência: ${d.ocorrencia || "—"}`);
  } else {
    linhas.push(`Concluído em: ${d.dataConclusao || "—"}`);
  }
  linhas.push("", "Angel 2809 — Projetos Logísticos");
  return linhas.filter(Boolean).join("\n");
}

async function compartilharCard() {
  if (!modalCompartilhar) return;
  const { d, tipo } = modalCompartilhar;
  const texto = montarTextoCompartilhar(d, tipo);
  const titulo = `${d.cliente} — ${d.cte || d.nf}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // usuário cancelou o compartilhamento
      // se falhar por outro motivo, cai no fallback de copiar
    }
  }

  try {
    await navigator.clipboard.writeText(texto);
    toast("🔗 Detalhes do CTE copiados! Cole onde quiser enviar.");
  } catch (err) {
    // Fallback final: textarea temporário + execCommand
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("🔗 Detalhes do CTE copiados! Cole onde quiser enviar.");
    } catch (e2) {
      toast("❌ Não foi possível copiar. Copie manualmente.", "error");
    }
    document.body.removeChild(ta);
  }
}

document.getElementById("modal").addEventListener("click", e => {
  if (e.target === document.getElementById("modal")) fecharModal();
});

// ══════════════════════════════════════════════════════════════
//  GRÁFICOS
// ══════════════════════════════════════════════════════════════
function renderGraficos() {
  renderFaturamento();
  buildChartEntregasMes();
  buildChartFaturamento();
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

const chartDefaults = {
  color: "#F0F0F0",
  plugins: { legend: { labels: { color: "#8890AA", font: { family: "Inter" } } } },
  scales: {
    x: { ticks: { color: "#8890AA" }, grid: { color: "#2E3248" } },
    y: { ticks: { color: "#8890AA" }, grid: { color: "#2E3248" } },
  }
};

function buildChartEntregasMes() {
  destroyChart("mes");
  const ctx = document.getElementById("chart-entregas-mes").getContext("2d");
  const all = [...dados, ...faturamento];
  const meses = {};
  for (const d of all) {
    const m = d.previsao ? d.previsao.substring(3,10) : "s/d";
    meses[m] = (meses[m] || 0) + 1;
  }
  const sorted = Object.entries(meses).sort((a,b) => a[0].localeCompare(b[0]));
  charts.mes = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(s=>s[0]),
      datasets: [{ label: "CTEs", data: sorted.map(s=>s[1]), backgroundColor: "#3B82F6", borderRadius: 5 }]
    },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false }
  });
}

function buildChartFaturamento() {
  destroyChart("fat");
  const ctx = document.getElementById("chart-faturamento").getContext("2d");
  const labels = importHistory.length
    ? importHistory.map(h => h.label)
    : ["Relatório 1"];
  const values = importHistory.length
    ? importHistory.map(h => h.valor)
    : [dados.reduce((a,d)=>a+d.valor,0)];
  charts.fat = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Faturamento Total (R$)",
        data: values,
        borderColor: "#22C55E",
        backgroundColor: "rgba(34,197,94,.08)",
        pointBackgroundColor: "#22C55E",
        tension: .35,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: { callbacks: { label: ctx => " " + fmtBRL(ctx.raw) } }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  FATURAMENTO EXECUTIVO — últimos 3 meses + entregas por origem
// ══════════════════════════════════════════════════════════════
const NOMES_MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// Converte "DD/MM/AAAA" (formato usado em dataConclusao) em {dia,mes,ano}, ou null se inválido
// RENOMEADA (era parseDataBR): havia duas funções chamadas parseDataBR no arquivo.
// Como declarações "function" com mesmo nome se sobrescrevem no mesmo escopo, esta
// versão (que retorna {dia,mes,ano}) sobrescrevia a de cima (que retorna um Date),
// fazendo calcularDiasParado() e o painel de prazos receberem um objeto sem
// .setHours()/.getTime() -> "dt.setHours is not a function" ao importar planilha.
function parseMesAnoBR(str) {
  if (!str || str === "—") return null;
  const partes = String(str).split("/");
  if (partes.length !== 3) return null;
  const dia = parseInt(partes[0], 10), mes = parseInt(partes[1], 10) - 1, ano = parseInt(partes[2], 10);
  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
  return { dia, mes, ano };
}

// Monta os 3 últimos meses (mês atual + 2 anteriores) com o faturamento real
// (soma de d.valor dos CTEs concluídos com dataConclusao naquele mês) e a
// projeção de 25% da unidade sobre esse valor real.
function getFaturamentoUltimos3Meses() {
  const hoje = new Date();
  const meses = [];
  for (let i = 2; i >= 0; i--) {
    const ref = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push({ mes: ref.getMonth(), ano: ref.getFullYear() });
  }
  return meses.map(m => {
    const registros = faturamento.filter(f => {
      const dt = parseMesAnoBR(f.dataConclusao);
      return dt && dt.mes === m.mes && dt.ano === m.ano;
    });
    const real = registros.reduce((a, r) => a + (r.valor || 0), 0);
    return {
      label: `${NOMES_MESES[m.mes]} / ${m.ano}`,
      labelCurto: `${NOMES_MESES[m.mes].substring(0,3)}/${String(m.ano).slice(-2)}`,
      real,
      unidade25: real * 0.25,
      qtd: registros.length,
      ticketMedio: registros.length ? real / registros.length : 0,
    };
  });
}

// Conta entregas (ativas + concluídas) agrupadas por município/origem
function getEntregasPorOrigem(limite = 10) {
  const all = [...dados, ...faturamento];
  const contagem = {};
  for (const d of all) {
    const key = (d.origem && d.origem !== "—") ? d.origem.trim() : "Não informado";
    contagem[key] = (contagem[key] || 0) + 1;
  }
  return Object.entries(contagem).sort((a, b) => b[1] - a[1]).slice(0, limite);
}

function renderFaturamentoExecutivo() {
  renderFaturamentoKPIs();
  buildChartFaturamento3Meses();
  buildChartEntregasOrigem();
  buildChartTicketMedio();
  buildChartOrigemPizza();
}

function renderFaturamentoKPIs() {
  const grid = document.getElementById("fat-kpi-grid");
  if (!grid) return;
  const mesesData = getFaturamentoUltimos3Meses();
  const totalReal  = mesesData.reduce((a, m) => a + m.real, 0);
  const total25    = mesesData.reduce((a, m) => a + m.unidade25, 0);
  const totalQtd   = mesesData.reduce((a, m) => a + m.qtd, 0);

  const cardsHTML = mesesData.map((m, i) => {
    const anterior = i > 0 ? mesesData[i - 1].real : null;
    let trendHTML = `<span class="fat-kpi-trend flat">— sem hist.</span>`;
    if (anterior !== null) {
      if (anterior === 0 && m.real > 0) {
        trendHTML = `<span class="fat-kpi-trend up">▲ novo</span>`;
      } else if (anterior > 0) {
        const variacao = ((m.real - anterior) / anterior) * 100;
        const seta = variacao > 0 ? "▲" : variacao < 0 ? "▼" : "▬";
        const classe = variacao > 0 ? "up" : variacao < 0 ? "down" : "flat";
        trendHTML = `<span class="fat-kpi-trend ${classe}">${seta} ${Math.abs(variacao).toFixed(1)}%</span>`;
      }
    }
    return `
      <div class="fat-kpi-card">
        <div class="fat-kpi-month">${m.label} ${trendHTML}</div>
        <div class="fat-kpi-chips">
          <div class="fat-kpi-chip">
            <span class="fat-kpi-chip-label">💰 Real Faturado</span>
            <span class="fat-kpi-chip-value">${fmtBRL(m.real)}</span>
          </div>
          <div class="fat-kpi-chip">
            <span class="fat-kpi-chip-label">📦 25% da Unidade</span>
            <span class="fat-kpi-chip-value">${fmtBRL(m.unidade25)}</span>
          </div>
        </div>
        <div class="fat-kpi-sub">${m.qtd} entrega${m.qtd === 1 ? "" : "s"} concluída${m.qtd === 1 ? "" : "s"} · ticket médio ${fmtBRL(m.ticketMedio)}</div>
      </div>`;
  }).join("");

  const totalHTML = `
    <div class="fat-kpi-card total">
      <div class="fat-kpi-month">Total do Trimestre</div>
      <div class="fat-kpi-chips">
        <div class="fat-kpi-chip">
          <span class="fat-kpi-chip-label">💰 Real Faturado</span>
          <span class="fat-kpi-chip-value">${fmtBRL(totalReal)}</span>
        </div>
        <div class="fat-kpi-chip">
          <span class="fat-kpi-chip-label">📦 25% da Unidade</span>
          <span class="fat-kpi-chip-value">${fmtBRL(total25)}</span>
        </div>
      </div>
      <div class="fat-kpi-sub">${totalQtd} entregas concluídas nos últimos 3 meses</div>
    </div>`;

  grid.innerHTML = cardsHTML + totalHTML;

  // Banner de insight executivo
  const banner = document.getElementById("fat-insight-banner");
  if (banner) {
    const mesAtual = mesesData[mesesData.length - 1];
    const mesAnterior = mesesData[mesesData.length - 2];
    let variacaoTxt = "sem dados suficientes para comparação";
    if (mesAnterior && mesAnterior.real > 0) {
      const variacao = ((mesAtual.real - mesAnterior.real) / mesAnterior.real) * 100;
      variacaoTxt = variacao >= 0
        ? `alta de <b>${variacao.toFixed(1)}%</b> em relação ao mês anterior`
        : `queda de <b>${Math.abs(variacao).toFixed(1)}%</b> em relação ao mês anterior`;
    }
    const top = getEntregasPorOrigem(1)[0];
    const topTxt = top ? ` · origem líder em volume: <b>${top[0]}</b> (${top[1]} entregas)` : "";
    banner.innerHTML = `📊 Faturamento de <b>${mesAtual.label}</b>: <b>${fmtBRL(mesAtual.real)}</b> (${variacaoTxt})${topTxt}`;
  }

  const badge = document.getElementById("tab-badge-fatn");
  if (badge) badge.textContent = totalQtd;
}

function buildChartFaturamento3Meses() {
  destroyChart("fat3m");
  const canvas = document.getElementById("chart-fat-3meses");
  if (!canvas) return;
  const mesesData = getFaturamentoUltimos3Meses();
  charts.fat3m = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: mesesData.map(m => m.label),
      datasets: [
        { label: "Real Faturado", data: mesesData.map(m => m.real), backgroundColor: "#22C55E", borderRadius: 6, maxBarThickness: 52 },
        { label: "25% da Unidade", data: mesesData.map(m => m.unidade25), backgroundColor: "rgba(34,197,94,.35)", borderRadius: 6, maxBarThickness: 52 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtBRL(ctx.raw)}` } }
      }
    }
  });
}

function buildChartEntregasOrigem() {
  destroyChart("origem");
  const canvas = document.getElementById("chart-entregas-origem");
  if (!canvas) return;
  const top = getEntregasPorOrigem(10);
  const badge = document.getElementById("fat-top-origem-badge");
  if (badge) badge.textContent = top.length ? `🏆 ${top[0][0]} — ${top[0][1]} entregas` : "Sem dados";
  charts.origem = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: top.map(t => t[0]),
      datasets: [{ label: "Entregas", data: top.map(t => t[1]), backgroundColor: "#E6A817", borderRadius: 6, maxBarThickness: 26 }]
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      ...chartDefaults,
      plugins: { ...chartDefaults.plugins, legend: { display: false } }
    }
  });
}

function buildChartTicketMedio() {
  destroyChart("ticket");
  const canvas = document.getElementById("chart-ticket-medio");
  if (!canvas) return;
  const mesesData = getFaturamentoUltimos3Meses();
  charts.ticket = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: mesesData.map(m => m.labelCurto),
      datasets: [{
        label: "Ticket Médio (R$)",
        data: mesesData.map(m => m.ticketMedio),
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59,130,246,.08)",
        pointBackgroundColor: "#3B82F6",
        tension: .35,
        fill: true,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      ...chartDefaults,
      plugins: {
        ...chartDefaults.plugins,
        tooltip: { callbacks: { label: ctx => " " + fmtBRL(ctx.raw) } }
      }
    }
  });
}

function buildChartOrigemPizza() {
  destroyChart("origemPizza");
  const canvas = document.getElementById("chart-origem-pizza");
  if (!canvas) return;
  const top = getEntregasPorOrigem(6);
  const cores = ["#E6A817", "#22C55E", "#3B82F6", "#A855F7", "#FF4444", "#8890AA"];
  charts.origemPizza = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: top.map(t => t[0]),
      datasets: [{ data: top.map(t => t[1]), backgroundColor: cores, borderColor: "#1A1D27", borderWidth: 2 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#8890AA", font: { family: "Inter", size: 11 }, boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, v) => a + v, 0);
              const pct = total ? ((ctx.raw / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════
//  CONTATOS & CONFIGURAÇÃO
// ══════════════════════════════════════════════════════════════
function adicionarContato(tipo) {
  const nomeId  = tipo === "email" ? "email-nome" : "wa-nome";
  const valorId = tipo === "email" ? "email-valor" : "wa-valor";
  const nome  = document.getElementById(nomeId).value.trim();
  const valor = document.getElementById(valorId).value.trim();
  if (!valor) { toast("Preencha o " + (tipo === "email" ? "e-mail" : "WhatsApp") + ".", "error"); return; }
  const lista = tipo === "email" ? contatos.emails : contatos.whatsapp;
  if (lista.find(c => c.valor === valor)) { toast("Contato já cadastrado.", "warn"); return; }
  lista.push({ nome: nome || "—", valor, tipo, id: Date.now() });
  document.getElementById(nomeId).value  = "";
  document.getElementById(valorId).value = "";
  salvarContatosFirebase();
  renderContatos();
  atualizarTabBadges();
  toast((tipo === "email" ? "📧 E-mail" : "📱 WhatsApp") + " cadastrado com sucesso!");
}

function removerContato(tipo, id) {
  if (tipo === "email") contatos.emails    = contatos.emails.filter(c => c.id !== id);
  else                  contatos.whatsapp  = contatos.whatsapp.filter(c => c.id !== id);
  salvarContatosFirebase();
  renderContatos();
  atualizarTabBadges();
  toast("Contato removido.");
}

function renderContatos() {
  const renderLista = (lista, elId, tipo) => {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!lista.length) {
      el.innerHTML = `<div class="empty" style="padding:24px;"><div class="empty-icon">${tipo === "email" ? "📭" : "📵"}</div><p>Nenhum contato cadastrado.</p></div>`;
      return;
    }
    el.innerHTML = lista.map(c => `
      <div class="contact-item">
        <div>
          <div class="contact-name">${c.nome}</div>
          <span class="contact-value">${c.valor}</span>
          <span class="contact-tag ${tipo === "whatsapp" ? "whatsapp" : ""}">${tipo === "email" ? "E-mail" : "WhatsApp"}</span>
        </div>
        <button class="contact-del" onclick="removerContato('${tipo}', ${c.id})">🗑 Remover</button>
      </div>`).join("");
  };
  renderLista(contatos.emails,    "lista-emails",    "email");
  renderLista(contatos.whatsapp,  "lista-whatsapp",  "whatsapp");
}

function salvarConfig() {
  alertConfig.auto    = document.getElementById("cfg-auto")?.checked    ?? false;
  alertConfig.critico = document.getElementById("cfg-critico")?.checked ?? true;
  alertConfig.atencao = document.getElementById("cfg-atencao")?.checked ?? true;
  alertConfig.limiar  = parseInt(document.getElementById("cfg-limiar")?.value) || 4;
  salvarContatosFirebase();
}

function carregarConfig() {
  if (document.getElementById("cfg-auto"))    document.getElementById("cfg-auto").checked    = alertConfig.auto;
  if (document.getElementById("cfg-critico")) document.getElementById("cfg-critico").checked = alertConfig.critico;
  if (document.getElementById("cfg-atencao")) document.getElementById("cfg-atencao").checked = alertConfig.atencao;
  if (document.getElementById("cfg-limiar"))  document.getElementById("cfg-limiar").value    = alertConfig.limiar;
}

function atualizarPreviewAlerta() {
  const limiar  = alertConfig.limiar;
  const criticos = dados.filter(d => d.status === "critico" && (d._diasCalc || calcularDiasParado(d)) >= limiar);
  const atencao  = dados.filter(d => d.status === "atencao"  && (d._diasCalc || calcularDiasParado(d)) >= limiar);
  const totalContatos = contatos.emails.length + contatos.whatsapp.length;
  const el = document.getElementById("alert-preview");
  if (!el) return;
  if (!dados.length) { el.textContent = "Importe dados para ver o preview do alerta."; return; }
  const linhas = [];
  linhas.push("🚨 ALERTA DE CARGAS PARADAS — " + new Date().toLocaleDateString("pt-BR"));
  linhas.push("─────────────────────────────────────");
  if (alertConfig.critico && criticos.length) {
    linhas.push("🔴 CRÍTICOS (" + criticos.length + "):");
    criticos.slice(0,5).forEach(d => linhas.push("  • " + (d.cte||d.nf) + " | " + d.cliente + " | " + (d._diasCalc||d.dias) + "d parado"));
    if (criticos.length > 5) linhas.push("  ... e mais " + (criticos.length-5));
  }
  if (alertConfig.atencao && atencao.length) {
    linhas.push("🟡 ATENÇÃO (" + atencao.length + "):");
    atencao.slice(0,3).forEach(d => linhas.push("  • " + (d.cte||d.nf) + " | " + d.cliente + " | " + (d._diasCalc||d.dias) + "d parado"));
    if (atencao.length > 3) linhas.push("  ... e mais " + (atencao.length-3));
  }
  if (!criticos.length && !atencao.length) linhas.push("✅ Nenhuma carga acima do limiar de " + limiar + " dias parado.");
  linhas.push("─────────────────────────────────────");
  linhas.push("Destinatários: " + totalContatos + " contato(s) cadastrado(s)");
  linhas.push("  Emails: " + contatos.emails.map(c=>c.valor).join(", ") || "(nenhum)");
  linhas.push("  WhatsApp: " + contatos.whatsapp.map(c=>c.valor).join(", ") || "(nenhum)");
  el.textContent = linhas.join("\n");
}

async function salvarContatosFirebase() {
  if (!window._fbReady) return;
  const { db, fs } = { db: window._db, fs: window._fs };
  try {
    await fs.setDoc(fs.doc(db, "meta", "contatos"), { contatos, alertConfig, _ts: fs.serverTimestamp() });
  } catch(e) { console.warn("salvarContatosFirebase:", e); }
}

async function carregarContatosFirebase() {
  if (!window._fbReady) return;
  const { db, fs } = { db: window._db, fs: window._fs };
  try {
    const snap = await fs.getDoc(fs.doc(db, "meta", "contatos"));
    if (snap.exists()) {
      const data = snap.data();
      if (data.contatos)   contatos    = data.contatos;
      if (data.alertConfig) alertConfig = data.alertConfig;
    }
  } catch(e) { console.warn("carregarContatosFirebase:", e); }
  carregarConfig();
  renderContatos();
  atualizarTabBadges();
}

// ══════════════════════════════════════════════════════════════
//  ALERTAS / LOG / TRIGGERS
// ══════════════════════════════════════════════════════════════
function montarMensagemAlerta() {
  const limiar   = alertConfig.limiar || 4;
  // Recalcula dias/status para todos
  sincronizarDiasEStatus();
  const criticos = alertConfig.critico ? dados.filter(d => d.status === "critico" && d._diasCalc >= limiar) : [];
  const atencao  = alertConfig.atencao ? dados.filter(d => d.status === "atencao"  && d._diasCalc >= limiar) : [];
  const todos    = [...criticos, ...atencao];
  if (!todos.length) return null;

  const hoje = new Date().toLocaleDateString("pt-BR");
  let msg = `🚨 ALERTA DE CARGAS PARADAS — ${hoje}
`;
  msg += `${"─".repeat(45)}
`;
  if (criticos.length) {
    msg += `
🔴 CRÍTICOS (${criticos.length}):
`;
    criticos.forEach(d => {
      msg += `  • ${d.cte||d.nf} | ${d.cliente}
`;
      msg += `    Rota: ${d.origem} → ${d.destino}
`;
      msg += `    Dias parado: ${d._diasCalc}d | Previsão: ${d.previsao}
`;
      msg += `    Última ocorrência: ${d.ocorrencia||"—"}
`;
    });
  }
  if (atencao.length) {
    msg += `
🟡 ATENÇÃO (${atencao.length}):
`;
    atencao.forEach(d => {
      msg += `  • ${d.cte||d.nf} | ${d.cliente}
`;
      msg += `    Rota: ${d.origem} → ${d.destino}
`;
      msg += `    Dias parado: ${d._diasCalc}d | Previsão: ${d.previsao}
`;
    });
  }
  msg += `
${"─".repeat(45)}
`;
  msg += `Total alertas: ${todos.length} | Valor total: ${fmtBRL(todos.reduce((a,d)=>a+d.valor,0))}
`;
  msg += `Sistema Angel 2809 — ${new Date().toLocaleString("pt-BR")}`;
  return { texto: msg, criticos, atencao, todos };
}

async function enviarAlertas() {
  const payload = montarMensagemAlerta();
  if (!payload) { toast("Nenhuma carga acima do limiar para alertar.", "error"); return; }
  const { texto, todos } = payload;
  const resultados = [];

  // ── 1. E-MAILS via EmailJS ─────────────────────────────────
  const ejsKey  = (document.getElementById("ejs-public-key")?.value  || window.EMAILJS_PUBLIC_KEY || "").trim();
  const ejsSvc  = (document.getElementById("ejs-service-id")?.value  || window.EMAILJS_SERVICE_ID || "").trim();
  const ejsTpl  = (document.getElementById("ejs-template-id")?.value || window.EMAILJS_TEMPLATE_ID || "").trim();
  const ejsName = (document.getElementById("ejs-sender-name")?.value || "Angel 2809").trim();

  const emailsParaEnviar = contatos.emails;
  if (emailsParaEnviar.length && ejsKey && ejsSvc && ejsTpl) {
    try {
      emailjs.init({ publicKey: ejsKey });
      for (const c of emailsParaEnviar) {
        try {
          await emailjs.send(ejsSvc, ejsTpl, {
            to_email:    c.valor,
            to_name:     c.nome || c.valor,
            subject:     `🚨 Alerta Cargas Paradas — ${new Date().toLocaleDateString("pt-BR")} (${todos.length} cargas)`,
            message:     texto,
            from_name:   ejsName,
            reply_to:    c.valor,
          });
          resultados.push({ tipo:"email", valor:c.valor, nome:c.nome, ok:true });
        } catch(err) {
          resultados.push({ tipo:"email", valor:c.valor, nome:c.nome, ok:false, erro:err.text||String(err) });
        }
      }
    } catch(err) {
      emailsParaEnviar.forEach(c => resultados.push({ tipo:"email", valor:c.valor, nome:c.nome, ok:false, erro:"EmailJS não inicializado: "+err }));
    }
  } else if (emailsParaEnviar.length && (!ejsKey || !ejsSvc || !ejsTpl)) {
    // Fallback: abre mailto com todos os emails
    const assunto = encodeURIComponent(`🚨 Alerta Cargas Paradas — ${new Date().toLocaleDateString("pt-BR")}`);
    const corpo   = encodeURIComponent(texto);
    const bcc     = emailsParaEnviar.map(c=>c.valor).join(",");
    window.open(`mailto:${bcc}?subject=${assunto}&body=${corpo}`, "_blank");
    emailsParaEnviar.forEach(c => resultados.push({ tipo:"email", valor:c.valor, nome:c.nome, ok:"mailto" }));
    toast("📧 EmailJS não configurado — abrindo cliente de e-mail (mailto).", "warn");
  }

  // ── 2. WHATSAPP via wa.me ──────────────────────────────────
  const waMensagem = encodeURIComponent(texto);
  for (const c of contatos.whatsapp) {
    const numero = c.valor.replace(/\D/g,"");
    const url = `https://wa.me/${numero}?text=${waMensagem}`;
    window.open(url, "_blank");
    resultados.push({ tipo:"whatsapp", valor:c.valor, nome:c.nome, ok:"aberto" });
  }

  // ── 3. LOG & feedback ─────────────────────────────────────
  const okCount  = resultados.filter(r => r.ok === true).length;
  const waCount  = resultados.filter(r => r.tipo === "whatsapp").length;
  const errCount = resultados.filter(r => r.ok === false).length;
  adicionarLog("Enviado", todos.length, todos.reduce((a,d)=>a+d.valor,0), Math.max(0,...todos.map(d=>d._diasCalc)));

  // Mostra resultado no preview
  mostrarResultadosEnvio(resultados);

  if (errCount) toast(`⚠️ ${errCount} e-mail(s) falharam. Verifique o log.`, "error");
  else if (okCount) toast(`✅ ${okCount} e-mail(s) enviados com sucesso!`);
  if (waCount) toast(`📱 ${waCount} WhatsApp(s) aberto(s) no navegador!`);
}

function mostrarResultadosEnvio(resultados) {
  const el = document.getElementById("alert-preview");
  if (!el) return;
  const linhas = resultados.map(r => {
    const icon = r.ok === true ? "✅" : r.ok === "mailto" ? "📨" : r.ok === "aberto" ? "📱" : "❌";
    const tipoLabel = r.tipo === "email" ? "E-mail" : "WhatsApp";
    const detalhe   = r.ok === false ? ` — Erro: ${r.erro}` : r.ok === "mailto" ? " — via cliente de e-mail" : r.ok === "aberto" ? " — janela aberta" : " — enviado";
    return `${icon} [${tipoLabel}] ${r.nome} &lt;${r.valor}&gt;${detalhe}`;
  });
  const payload = montarMensagemAlerta();
  const preview = payload ? payload.texto : "";
  el.innerHTML = `<div style="margin-bottom:12px;font-weight:600;color:var(--text);">📤 Resultado do Envio</div>` +
    linhas.map(l => `<div style="margin-bottom:6px;">${l}</div>`).join("") +
    `<hr style="border-color:var(--border);margin:12px 0;" /><pre style="font-size:11px;color:var(--muted);white-space:pre-wrap;">${preview}</pre>`;
}

async function testarEmailJS() {
  const ejsKey = (document.getElementById("ejs-public-key")?.value || "").trim();
  const ejsSvc = (document.getElementById("ejs-service-id")?.value || "").trim();
  const ejsTpl = (document.getElementById("ejs-template-id")?.value || "").trim();
  if (!ejsKey || !ejsSvc || !ejsTpl) { toast("Preencha Public Key, Service ID e Template ID antes de testar.", "error"); return; }
  const primeiroEmail = contatos.emails[0];
  if (!primeiroEmail) { toast("Cadastre pelo menos um e-mail para testar.", "error"); return; }
  toast("⏳ Testando conexão EmailJS…", "warn");
  try {
    emailjs.init({ publicKey: ejsKey });
    await emailjs.send(ejsSvc, ejsTpl, {
      to_email:  primeiroEmail.valor,
      to_name:   primeiroEmail.nome || primeiroEmail.valor,
      subject:   "🧪 Teste de conexão — Angel 2809",
      message:   `Este é um e-mail de teste do sistema Angel 2809 Logística.

Se você recebeu isto, a configuração está correta! ✅`,
      from_name: "Angel 2809",
      reply_to:  primeiroEmail.valor,
    });
    document.getElementById("emailjs-status-badge").className = "send-status ok";
    document.getElementById("emailjs-status-badge").textContent = "✅ Conectado";
    document.getElementById("emailjs-setup-banner").className = "setup-banner ok";
    document.getElementById("emailjs-setup-banner").textContent = "✅ EmailJS configurado e funcionando! E-mails reais serão enviados.";
    toast("✅ Teste enviado! Verifique a caixa de entrada de " + primeiroEmail.valor);
  } catch(err) {
    document.getElementById("emailjs-status-badge").className = "send-status erro";
    document.getElementById("emailjs-status-badge").textContent = "❌ Erro";
    toast("❌ Falha no EmailJS: " + (err.text || String(err)), "error");
  }
}

function salvarEmailJSConfig() {
  const cfg = {
    publicKey:  document.getElementById("ejs-public-key")?.value  || "",
    serviceId:  document.getElementById("ejs-service-id")?.value  || "",
    templateId: document.getElementById("ejs-template-id")?.value || "",
    senderName: document.getElementById("ejs-sender-name")?.value || "",
  };
  localStorage.setItem("emailjs_config", JSON.stringify(cfg));
  // Atualiza badge
  const ok = cfg.publicKey && cfg.serviceId && cfg.templateId;
  const badge = document.getElementById("emailjs-status-badge");
  if (badge) {
    badge.className = ok ? "send-status ok" : "send-status wait";
    badge.textContent = ok ? "✅ Configurado" : "⏳ Incompleto";
  }
}

function carregarEmailJSConfig() {
  try {
    const raw = localStorage.getItem("emailjs_config");
    if (!raw) return;
    const cfg = JSON.parse(raw);
    if (document.getElementById("ejs-public-key"))  document.getElementById("ejs-public-key").value  = cfg.publicKey  || "";
    if (document.getElementById("ejs-service-id"))  document.getElementById("ejs-service-id").value  = cfg.serviceId  || "";
    if (document.getElementById("ejs-template-id")) document.getElementById("ejs-template-id").value = cfg.templateId || "";
    if (document.getElementById("ejs-sender-name")) document.getElementById("ejs-sender-name").value = cfg.senderName || "";
    const ok = cfg.publicKey && cfg.serviceId && cfg.templateId;
    const badge = document.getElementById("emailjs-status-badge");
    if (badge) { badge.className = ok ? "send-status ok" : "send-status wait"; badge.textContent = ok ? "✅ Configurado" : "⏳ Não configurado"; }
    if (ok) { emailjs.init({ publicKey: cfg.publicKey }); }
  } catch(e) {}
}

function adicionarLog(status, qtd, valor, dias) {
  logEntradas.unshift({ hora: new Date().toLocaleString("pt-BR"), status, qtd, valor, dias });
  if (logEntradas.length > 100) logEntradas.pop();
  renderLog();
}

function renderLog() {
  const el = document.getElementById("log-list");
  if (!logEntradas.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>Nenhum envio registrado ainda.</p></div>`;
    return;
  }
  el.innerHTML = logEntradas.map(l => `
    <div class="log-item">
      <span class="log-time">${l.hora}</span>
      <span class="${l.qtd > 0 ? "log-status-ok":"log-status-skip"}">${l.status}</span>
      <span style="font-family:var(--mono);font-size:12px;color:var(--red-light);">${l.qtd} reg.</span>
      <span class="log-detail">${fmtBRL(l.valor)} · max ${l.dias}d</span>
    </div>`).join("");
}

function limparLog() { logEntradas = []; renderLog(); toast("Log limpo."); }

function renderTriggers() {
  const horas = [8,12,16,20];
  const agora = new Date();
  const horaAtual = agora.getHours();
  const proxima = horas.find(h => h > horaAtual) ?? horas[0];
  document.getElementById("trigger-row").innerHTML = horas.map(h => `
    <div class="trigger-chip ${h===proxima?"next":""}">
      <span class="hour">${String(h).padStart(2,"0")}:00</span>
      <span class="label">${h===proxima?"próximo disparo":"automático"}</span>
    </div>`).join("");
}

// ══════════════════════════════════════════════════════════════
//  TOAST / RELÓGIO
// ══════════════════════════════════════════════════════════════
function toast(msg, tipo = "ok") {
  const c  = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast" + (tipo === "error" ? " error" : tipo === "warn" ? " warn" : "");
  el.innerHTML = `<span>${tipo==="error"?"⚠️":tipo==="warn"?"⚡":"✅"}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function atualizarRelogio() {
  document.getElementById("clock").textContent = new Date().toLocaleTimeString("pt-BR");
}

// ══════════════════════════════════════════════════════════════
//  FIREBASE / FIRESTORE  (persistência na nuvem)
// ══════════════════════════════════════════════════════════════

// ── Indicador de sincronização ────────────────────────────────
function setSyncStatus(status) {
  // status: "syncing" | "ok" | "error" | "offline"
  let el = document.getElementById("sync-indicator");
  if (!el) return;
  const map = {
    syncing: { text:"⏳ Sincronizando…",  color:"var(--yellow)" },
    ok:      { text:"☁️ Sincronizado",     color:"var(--green)"  },
    error:   { text:"⚠️ Erro ao salvar",   color:"var(--red)"    },
    offline: { text:"🔌 Offline",          color:"var(--muted)"  },
  };
  const s = map[status] || map.offline;
  el.textContent  = s.text;
  el.style.color  = s.color;
}

// ── Salvar TODOS os dados no Firestore ────────────────────────
// Grava em lotes de até 400 operações (limite do Firestore: 500 por batch)
// e só apaga documentos que deixaram de existir.
async function fbCommitEmLotes(db, fs, ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const batch = fs.writeBatch(db);
    ops.slice(i, i + 400).forEach(op => op(batch));
    await batch.commit();
  }
}

async function fbSalvarTudo() {
  if (!window._fbReady) { setSyncStatus("offline"); return; }
  const { db, fs } = { db: window._db, fs: window._fs };
  setSyncStatus("syncing");
  try {
    const ops = [];
    const limpo = (x) => JSON.parse(JSON.stringify(x)); // remove undefined/NaN
    const sincronizar = async (colecao, lista) => {
      const snap = await fs.getDocs(fs.collection(db, colecao));
      const ids = new Set(lista.map((_, i) => `item_${i}`));
      snap.docs.forEach(d => { if (!ids.has(d.id)) ops.push(b => b.delete(d.ref)); });
      lista.forEach((item, i) => {
        const ref = fs.doc(db, colecao, `item_${i}`);
        ops.push(b => b.set(ref, { ...limpo(item), _ts: fs.serverTimestamp() }));
      });
    };
    await sincronizar("expedicao", dados);
    await sincronizar("faturamento", faturamento);
    ops.push(b => b.set(fs.doc(db, "meta", "importHistory"), { history: limpo(importHistory), _ts: fs.serverTimestamp() }));

    await fbCommitEmLotes(db, fs, ops);
    setSyncStatus("ok");
  } catch (err) {
    console.error("Firestore save error:", err);
    setSyncStatus("error");
    toast("⚠️ Erro ao salvar no Firebase: " + err.message, "error");
  }
}

// ── Carregar dados do Firestore na inicialização ──────────────
async function fbCarregarDados() {
  if (!window._fbReady) { setSyncStatus("offline"); iniciarUI(); return; }
  const { db, fs } = { db: window._db, fs: window._fs };
  setSyncStatus("syncing");
  try {
    const [snapExp, snapFat, snapMeta] = await Promise.all([
      fs.getDocs(fs.collection(db, "expedicao")),
      fs.getDocs(fs.collection(db, "faturamento")),
      fs.getDoc(fs.doc(db, "meta", "importHistory")),
    ]);

    if (!snapExp.empty) {
      dados = snapExp.docs
        .sort((a,b) => a.id.localeCompare(b.id))
        .map(d => { const x = d.data(); delete x._ts; return x; });
    }
    if (!snapFat.empty) {
      faturamento = snapFat.docs
        .sort((a,b) => a.id.localeCompare(b.id))
        .map(d => { const x = d.data(); delete x._ts; return x; });
    }
    if (snapMeta.exists()) {
      importHistory = snapMeta.data().history || [];
    }

    setSyncStatus("ok");
    toast("☁️ Dados carregados do Firebase!", "ok");
    await carregarContatosFirebase();
  } catch(err) {
    console.warn("Firestore load error:", err);
    setSyncStatus("error");
    toast("⚠️ Não foi possível carregar do Firebase. Usando dados locais.", "warn");
  }
  iniciarUI();
}

// ── Limpar Firestore também ────────────────────────────────────
async function fbLimpar() {
  if (!window._fbReady) return;
  const { db, fs } = { db: window._db, fs: window._fs };
  try {
    const [s1, s2] = await Promise.all([
      fs.getDocs(fs.collection(db, "expedicao")),
      fs.getDocs(fs.collection(db, "faturamento")),
    ]);
    const ops = [];
    [...s1.docs, ...s2.docs].forEach(d => ops.push(b => b.delete(d.ref)));
    ops.push(b => b.delete(fs.doc(db, "meta", "importHistory")));
    await fbCommitEmLotes(db, fs, ops);
  } catch(err) { console.warn("fbLimpar error:", err); }
}

// ── Salvar após processarLinhas ───────────────────────────────
const _origProcessarLinhas = processarLinhas;
// (patch abaixo no bloco de init)

// ══════════════════════════════════════════════════════════════
//  ARRASTAR PARA O LADO (drag-to-scroll horizontal nas tabelas)
//  Resolve a necessidade de descer a página até achar a barra de
//  rolagem: agora basta clicar e arrastar em qualquer ponto da
//  tabela para movê-la para os lados (funciona junto com o scroll
//  interno vertical/horizontal já habilitado no CSS).
// ══════════════════════════════════════════════════════════════
function habilitarArrastarTabelas() {
  document.querySelectorAll(".table-scroll").forEach(el => {
    if (el._dragHabilitado) return; // evita registrar 2x
    el._dragHabilitado = true;
    let isDown = false, startX = 0, startY = 0, scrollLeftInicio = 0, scrollTopInicio = 0, moveu = false;

    el.addEventListener("mousedown", (e) => {
      // Ignora clique em botões/links dentro da tabela (Alterar, Ver, ordenar coluna continua funcionando)
      if (e.target.closest("button, a")) return;
      isDown = true; moveu = false;
      el.classList.add("dragging");
      startX = e.pageX; startY = e.pageY;
      scrollLeftInicio = el.scrollLeft; scrollTopInicio = el.scrollTop;
    });
    window.addEventListener("mouseup", () => { isDown = false; el.classList.remove("dragging"); });
    window.addEventListener("mouseleave", () => { isDown = false; el.classList.remove("dragging"); });
    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX, dy = e.pageY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moveu = true;
      if (!moveu) return;
      e.preventDefault();
      el.scrollLeft = scrollLeftInicio - dx;
      el.scrollTop  = scrollTopInicio - dy;
    });
    // Evita que o "arraste" dispare clique/ordenação acidental no cabeçalho
    el.addEventListener("click", (e) => { if (moveu) { e.stopPropagation(); moveu = false; } }, true);
  });
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
function iniciarUI() {
  sincronizarDiasEStatus(); // recalcula dias parado/status a partir da data de chegada, já sincronizado com o Firebase
  atualizarCards();
  renderTabela();
  renderGraficos();
  renderTriggers();
  atualizarTabBadges();
  habilitarArrastarTabelas();
  // Carrega config EmailJS do localStorage (não sai do Firebase por segurança)
  setTimeout(carregarEmailJSConfig, 300);

  // Mantém o contador de dias parado em dia mesmo com a página aberta por
  // longos períodos (ex.: virada do dia), sem precisar de nova importação.
  setInterval(() => {
    sincronizarDiasEStatus();
    atualizarCards();
    renderTabela();
    atualizarTabBadges();
  }, 5 * 60 * 1000); // a cada 5 minutos
}

atualizarRelogio();
setInterval(atualizarRelogio, 1000);

// O Firebase só fica pronto depois do login (firebase-init.js dispara "fb-ready").
// Antes disso a tela de login cobre o app; nenhum dado é carregado ou salvo.
if (window._fbReady) {
  fbCarregarDados();
} else {
  window.addEventListener("fb-ready", fbCarregarDados, { once: true });
}
