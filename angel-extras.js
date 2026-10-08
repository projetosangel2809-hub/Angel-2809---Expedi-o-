/* ============================================================
   Angel 2809 — Projetos Logísticos · angel-extras.js
   Carregar DEPOIS de app.js.
   1) Regra anti-repetição   2) Filtro pelos cards de prazo
   3) Log de auditoria       4) Pop-up "sem tratativa"
   ------------------------------------------------------------
   ÚNICO PONTO DE INTEGRAÇÃO (coloque no fim do app.js):
     window.AngelData = {
       get:  () => cargas,            // <- nome real do array de cargas
       set:  v  => { cargas = v; },
       save: () => salvarDados()      // <- opcional: função que persiste
     };
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Configuração / adaptador ---------- */
  const ALIASES = {
    status: ['status'], cte: ['cte', 'nf', 'nfcte', 'nf_cte'],
    cliente: ['cliente'], rota: ['rota'], bo: ['bo', 'b.o', 'b_o'],
    acr: ['acr'], chegada: ['dataChegada', 'chegada', 'dataChegadaUnidade'],
    valor: ['valor', 'valorFrete'], dias: ['dias', 'diasParado'],
    previsao: ['previsao', 'previsão'], ocorrencia: ['ultimaOcorrencia', 'ocorrencia', 'ultima'],
    tratativa: ['tratativa']
  };
  const NOMES_GLOBAIS = ['cargas', 'dados', 'registros', 'ctes', 'rows', 'data', 'expedicao'];

  const Data = {
    get() {
      if (window.AngelData && window.AngelData.get) return window.AngelData.get() || [];
      for (const n of NOMES_GLOBAIS) if (Array.isArray(window[n])) return window[n];
      return [];
    },
    set(v) {
      if (window.AngelData && window.AngelData.set) return window.AngelData.set(v);
      for (const n of NOMES_GLOBAIS) if (Array.isArray(window[n])) { window[n] = v; return; }
    },
    save() { try { window.AngelData && window.AngelData.save && window.AngelData.save(); } catch (e) {} }
  };

  const pick = (c, campo) => {
    for (const k of ALIASES[campo]) if (c && c[k] !== undefined && c[k] !== null && c[k] !== '') return c[k];
    return '';
  };
  const norm = v => String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const $ = id => document.getElementById(id);

  /* ============================================================
     1) REGRA ANTI-REPETIÇÃO
     Identidade da carga = nº do CT-e (sem zeros à esquerda).
     Sem CT-e legível, usa a combinação dos campos estáveis:
     NF + Cliente + Rota + B.O + ACR + Chegada + Valor.
     (Status, Dias Parado, Previsão, Ocorrência, Tratativa e Ações
      mudam com o tempo, por isso NÃO entram na chave — senão uma
      reimportação do mesmo CT-e seria tratada como carga nova.)
     ============================================================ */
  function chave(c) {
    const bruto = String(pick(c, 'cte'));
    const m = bruto.match(/CT-?E\D*0*(\d+)/i);
    const digitos = m ? m[1] : bruto.replace(/\D/g, '').replace(/^0+/, '');
    if (digitos) return 'CTE:' + digitos;
    return 'ROW:' + ['cte', 'cliente', 'rota', 'bo', 'acr', 'chegada', 'valor']
      .map(k => norm(pick(c, k))).join('|');
  }

  function deduplicar(lista) {
    const vistos = new Map(), unicos = [];
    let removidos = 0;
    for (const c of lista) {
      const k = chave(c);
      if (!vistos.has(k)) { vistos.set(k, c); unicos.push(c); continue; }
      removidos++;
      // preserva trabalho manual: se o registro mantido está sem tratativa e o duplicado tem, aproveita
      const base = vistos.get(k);
      for (const campo of ['tratativa']) {
        const alvo = ALIASES[campo].find(a => a in base) || ALIASES[campo][0];
        if (!norm(pick(base, campo)) && norm(pick(c, campo))) base[alvo] = pick(c, campo);
      }
    }
    return { unicos, removidos };
  }

  let dedupTimer;
  function rodarDedup(origem) {
    const lista = Data.get();
    if (!lista.length) return;
    const { unicos, removidos } = deduplicar(lista);
    if (!removidos) return;
    Data.set(unicos); Data.save();
    if (typeof window.renderTabela === 'function') window.renderTabela();
    toast(`♻️ ${removidos} registro(s) repetido(s) removido(s)`);
    Audit.log('duplicatas_removidas', `${removidos} registro(s) repetido(s) descartado(s) (${origem})`);
  }
  const agendarDedup = origem => { clearTimeout(dedupTimer); dedupTimer = setTimeout(() => rodarDedup(origem), 400); };

  /* ============================================================
     2) FILTRO PELOS CARDS DE PRAZO
     ============================================================ */
  const PRAZOS = {
    vencidas:    { card: 'cnt-vencidas',    nome: 'Vencidas' },
    hoje:        { card: 'cnt-vencehoje',   nome: 'Vencem hoje' },
    ate3:        { card: 'cnt-ate3',        nome: 'Até 3 dias' },
    ate5:        { card: 'cnt-ate5',        nome: 'Até 5 dias' },
    dentro:      { card: 'cnt-dentro',      nome: 'Dentro do prazo' },
    semprevisao: { card: 'cnt-semprevisao', nome: 'Sem previsão' }
  };
  let filtroPrazo = null;

  function parseData(v) {
    if (!v) return null;
    if (v instanceof Date) return isNaN(v) ? null : v;
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);
    if (m) { const a = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(a, +m[2] - 1, +m[1]); }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  }
  function classePrazo(c) {
    const p = parseData(pick(c, 'previsao'));
    if (!p) return 'semprevisao';
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0); p.setHours(0, 0, 0, 0);
    const d = Math.round((p - hoje) / 86400000);
    if (d < 0) return 'vencidas';
    if (d === 0) return 'hoje';
    if (d <= 3) return 'ate3';
    if (d <= 5) return 'ate5';
    return 'dentro';
  }
  function chaveDaLinha(tr) {
    const td = tr.children[1];
    return td ? chave({ cte: td.textContent }) : '';
  }
  function aplicarFiltroPrazo() {
    const tbody = $('tbody'); if (!tbody) return;
    const mapa = new Map(Data.get().map(c => [chave(c), classePrazo(c)]));
    let visiveis = 0;
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.querySelector('.empty') || tr.children.length < 3) return;
      const ok = !filtroPrazo || mapa.get(chaveDaLinha(tr)) === filtroPrazo;
      tr.style.display = ok ? '' : 'none';
      if (ok) visiveis++;
    });
    const cnt = $('table-count');
    if (cnt && filtroPrazo) cnt.textContent = `${visiveis} registros · prazo: ${PRAZOS[filtroPrazo].nome}`;
    Object.entries(PRAZOS).forEach(([k, p]) => {
      const el = $(p.card); if (el && el.closest('.card')) el.closest('.card').classList.toggle('card-selected', k === filtroPrazo);
    });
    const chip = $('angel-chip-prazo');
    if (chip) {
      chip.style.display = filtroPrazo ? 'inline-flex' : 'none';
      if (filtroPrazo) chip.querySelector('span').textContent = 'Filtrando: ' + PRAZOS[filtroPrazo].nome;
    }
  }
  function setFiltroPrazo(k) {
    filtroPrazo = (filtroPrazo === k) ? null : k;   // clicar de novo limpa
    aplicarFiltroPrazo();
    if (filtroPrazo) { const t = document.querySelector('.table-wrap'); t && t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }
  function iniciarCards() {
    Object.entries(PRAZOS).forEach(([k, p]) => {
      const el = $(p.card), card = el && el.closest('.card');
      if (!card) return;
      card.classList.add('card-clicavel');
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.title = 'Clique para filtrar a tabela';
      card.addEventListener('click', () => setFiltroPrazo(k));
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFiltroPrazo(k); } });
    });
    const bar = document.querySelector('.table-header-bar');
    if (bar && !$('angel-chip-prazo')) {
      const chip = document.createElement('button');
      chip.id = 'angel-chip-prazo'; chip.className = 'angel-chip'; chip.style.display = 'none';
      chip.innerHTML = '<span></span> ✕'; chip.onclick = () => setFiltroPrazo(filtroPrazo);
      bar.appendChild(chip);
    }
  }

  /* ============================================================
     3) LOG DE AUDITORIA (quem fez o quê)
     ============================================================ */
  const Audit = {
    KEY: 'angel_audit_log', MAX: 2000,
    usuario() {
      const el = $('user-email');
      return (el && el.textContent.trim()) ||
        (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.email) || 'desconhecido';
    },
    todos() { try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch (e) { return []; } },
    log(acao, detalhe) {
      const reg = { ts: new Date().toISOString(), usuario: this.usuario(), acao, detalhe: String(detalhe || '').slice(0, 500) };
      try {
        const l = this.todos(); l.push(reg);
        localStorage.setItem(this.KEY, JSON.stringify(l.slice(-this.MAX)));
      } catch (e) {}
      // Envio opcional para Firestore: defina window.AngelAuditSink = reg => addDoc(collection(db,'auditoria'), reg)
      try { window.AngelAuditSink && window.AngelAuditSink(reg); } catch (e) {}
    },
    abrir() {
      const l = this.todos().reverse();
      const usuarios = [...new Set(l.map(r => r.usuario))];
      const box = modal('angel-audit-modal', '🧾 Log de Auditoria', `
        <div class="angel-row">
          <select id="angel-audit-user"><option value="">Todos os usuários</option>${usuarios.map(u => `<option>${esc(u)}</option>`).join('')}</select>
          <input id="angel-audit-q" placeholder="Filtrar ação / detalhe…" />
          <button class="btn-ghost" id="angel-audit-csv">⬇️ CSV</button>
        </div>
        <div class="angel-scroll"><table class="angel-table"><thead><tr><th>Data/hora</th><th>Usuário</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody id="angel-audit-body"></tbody></table></div>`);
      const pintar = () => {
        const u = $('angel-audit-user').value, q = norm($('angel-audit-q').value);
        $('angel-audit-body').innerHTML = l.filter(r => (!u || r.usuario === u) && (!q || norm(r.acao + ' ' + r.detalhe).includes(q)))
          .slice(0, 500).map(r => `<tr><td>${new Date(r.ts).toLocaleString('pt-BR')}</td><td>${esc(r.usuario)}</td><td>${esc(r.acao)}</td><td>${esc(r.detalhe)}</td></tr>`).join('')
          || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Nenhum registro.</td></tr>';
      };
      $('angel-audit-user').onchange = pintar; $('angel-audit-q').oninput = pintar; pintar();
      $('angel-audit-csv').onclick = () => {
        const linhas = [['data', 'usuario', 'acao', 'detalhe'], ...l.map(r => [r.ts, r.usuario, r.acao, r.detalhe])]
          .map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['\ufeff' + linhas], { type: 'text/csv;charset=utf-8' }));
        a.download = 'auditoria_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
      };
      return box;
    }
  };

  // Funções do app.js que serão auditadas (só as que existirem são envolvidas)
  const AUDITADAS = {
    importarArquivo: 'importou_relatorio', limparDados: 'limpou_dados', exportarCSV: 'exportou_csv',
    enviarAlertas: 'enviou_alertas', limparLog: 'limpou_log_envios', adicionarContato: 'adicionou_contato',
    removerContato: 'removeu_contato', salvarConfig: 'alterou_config_alertas',
    salvarEdicao: 'editou_carga', salvarCarga: 'editou_carga', salvarTratativa: 'alterou_tratativa',
    atualizarTratativa: 'alterou_tratativa', excluirCarga: 'excluiu_carga', removerCarga: 'excluiu_carga',
    concluirCarga: 'concluiu_carga'
  };
  const snap = () => new Map(Data.get().map(c => [chave(c), JSON.stringify(c)]));
  function diffSnap(antes, depois) {
    const out = [];
    const atual = new Map(Data.get().map(c => [chave(c), c]));
    atual.forEach((c, k) => {
      const a = antes.get(k);
      if (a === undefined) return;
      if (a !== JSON.stringify(c)) {
        const o = JSON.parse(a), mud = [];
        Object.keys(c).forEach(f => { if (JSON.stringify(o[f]) !== JSON.stringify(c[f])) mud.push(`${f}: "${o[f] ?? ''}" → "${c[f] ?? ''}"`); });
        out.push(`${k.replace('CTE:', 'CTE ')} [${mud.join('; ').slice(0, 300)}]`);
      }
    });
    antes.forEach((_, k) => { if (!atual.has(k)) out.push(`${k.replace('CTE:', 'CTE ')} removido`); });
    return out;
  }
  function envolverFuncoes() {
    Object.entries(AUDITADAS).forEach(([nome, acao]) => {
      const orig = window[nome];
      if (typeof orig !== 'function' || orig.__angel) return;
      const w = function () {
        const antes = snap(), args = [...arguments];
        const r = orig.apply(this, args);
        Promise.resolve(r).then(() => setTimeout(() => {
          const d = diffSnap(antes);
          Audit.log(acao, d.length ? d.slice(0, 5).join(' | ') : nome);
        }, 350));
        return r;
      };
      w.__angel = true; window[nome] = w;
    });
  }

  /* ============================================================
     4) POP-UP: CTEs SEM TRATATIVA
     ============================================================ */
  function semTratativa() { return Data.get().filter(c => !norm(pick(c, 'tratativa'))); }
  function mostrarPopupTratativa(forcar) {
    const lista = semTratativa();
    if (!lista.length) return;
    const sig = String(lista.length);
    if (!forcar && sessionStorage.getItem('angel_popup_sig') === sig) return;
    sessionStorage.setItem('angel_popup_sig', sig);
    const linhas = lista.slice(0, 10).map(c => `<tr><td>${esc(pick(c, 'cte'))}</td><td>${esc(pick(c, 'cliente'))}</td><td>${esc(pick(c, 'rota'))}</td><td>${esc(pick(c, 'dias'))}</td></tr>`).join('');
    modal('angel-popup-trat', '⚠️ CTEs sem tratativa', `
      <p style="margin:0 0 10px"><b>${lista.length}</b> CT-e(s) ainda estão sem status de tratativa.</p>
      <div class="angel-scroll"><table class="angel-table"><thead><tr><th>NF / CTE</th><th>Cliente</th><th>Rota</th><th>Dias</th></tr></thead><tbody>${linhas}</tbody></table></div>
      ${lista.length > 10 ? `<p style="font-size:12px;color:var(--muted)">… e mais ${lista.length - 10}.</p>` : ''}
      <div class="angel-row" style="justify-content:flex-end;margin-top:14px">
        <button class="btn-ghost" data-fechar>Depois</button>
        <button class="btn-primary" id="angel-ver-sem-trat">Ver todos</button>
      </div>`);
    $('angel-ver-sem-trat').onclick = () => {
      fecharModal('angel-popup-trat');
      filtroPrazo = null; aplicarFiltroPrazo();
      typeof window.setFiltro === 'function' && window.setFiltro('sem_tratativa');
    };
    Audit.log('alerta_sem_tratativa', `${lista.length} CTE(s) sem tratativa exibidos no pop-up`);
  }
  function loginConcluido() {
    const o = $('login-overlay');
    return !o || o.style.display === 'none' || !document.body.contains(o) || getComputedStyle(o).display === 'none';
  }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    const c = $('toast-container'); if (!c) return;
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; c.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }
  function modal(id, titulo, html) {
    fecharModal(id);
    const ov = document.createElement('div'); ov.id = id; ov.className = 'angel-overlay';
    ov.innerHTML = `<div class="angel-box"><div class="angel-head"><b>${titulo}</b><button class="modal-close" data-fechar>✕</button></div><div class="angel-body">${html}</div></div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.hasAttribute('data-fechar')) fecharModal(id); });
    document.body.appendChild(ov); return ov;
  }
  function fecharModal(id) { const e = $(id); e && e.remove(); }

  /* ---------- Inicialização ---------- */
  function init() {
    // render com filtro de prazo
    const r0 = window.renderTabela;
    if (typeof r0 === 'function' && !r0.__angel) {
      window.renderTabela = function () { const r = r0.apply(this, arguments); aplicarFiltroPrazo(); return r; };
      window.renderTabela.__angel = true;
    }
    iniciarCards();
    envolverFuncoes();
    // reimportações: o app escreve em #upload-log ao terminar
    const ul = $('upload-log');
    if (ul) new MutationObserver(() => agendarDedup('importação')).observe(ul, { childList: true, characterData: true, subtree: true });
    // login/logout
    const lo = $('btn-logout'); lo && lo.addEventListener('click', () => Audit.log('logout', ''), true);
    let logou = false;
    setInterval(() => {
      if (!loginConcluido()) { logou = false; return; }
      if (!logou) { logou = true; Audit.log('login', ''); }
      if (Data.get().length) { rodarDedupUmaVez(); mostrarPopupTratativa(false); }
    }, 2500);
  }
  let dedupInicial = false;
  function rodarDedupUmaVez() { if (!dedupInicial) { dedupInicial = true; rodarDedup('carga inicial'); } }

  window.AngelExtras = { chave, deduplicar, classePrazo, setFiltroPrazo, mostrarPopupTratativa: () => mostrarPopupTratativa(true) };
  window.AngelAudit = Audit;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
