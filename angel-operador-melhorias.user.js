// ==UserScript==
// @name         Angel 2809 — Operador de Melhorias
// @namespace    angel2809.projetos
// @version      1.0.0
// @description  Agente auditor: analisa o portal Cargas-Pendentes e aponta falhas de segurança, código, desempenho, acessibilidade, PWA e integridade dos dados.
// @match        https://projetosangel2809-hub.github.io/Cargas-Pendentes/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  if (window.__angelOperador) return;
  window.__angelOperador = true;

  /* ───────── Captura em tempo real (desde o início da página) ───────── */
  const RT = { erros: [], rejeicoes: [], consoleErr: [], consoleWarn: [], recursos: [], fetchFalhos: [], longtasks: [] };
  window.addEventListener('error', e => {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) RT.recursos.push(e.target.src || e.target.href);
    else RT.erros.push(`${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
  }, true);
  window.addEventListener('unhandledrejection', e => RT.rejeicoes.push(String(e.reason && e.reason.message || e.reason)));
  ['error', 'warn'].forEach(t => {
    const o = console[t];
    console[t] = function () {
      try { (t === 'error' ? RT.consoleErr : RT.consoleWarn).push([...arguments].map(a => String(a && a.message || a)).join(' ').slice(0, 200)); } catch (e) {}
      return o.apply(this, arguments);
    };
  });
  const f0 = window.fetch;
  if (f0) window.fetch = function () {
    const url = String(arguments[0] && arguments[0].url || arguments[0]);
    return f0.apply(this, arguments).then(r => { if (!r.ok) RT.fetchFalhos.push(`${r.status} ${url}`); return r; },
      err => { RT.fetchFalhos.push(`FALHA ${url}`); throw err; });
  };
  try { new PerformanceObserver(l => l.getEntries().forEach(x => RT.longtasks.push(x.duration))).observe({ entryTypes: ['longtask'] }); } catch (e) {}

  /* ───────── Utilidades ───────── */
  const SEV = { critico: ['🔴', 'Crítico', 0], alto: ['🟠', 'Alto', 1], medio: ['🟡', 'Médio', 2], baixo: ['🔵', 'Baixo', 3], info: ['⚪', 'Info', 4] };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const mask = s => String(s).slice(0, 6) + '***';
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  let F = [];
  const add = (sev, cat, titulo, detalhe, correcao) => F.push({ sev, cat, titulo, detalhe, correcao });

  async function baixar(url) {
    try { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? await r.text() : null; } catch (e) { return null; }
  }
  async function existe(url) {
    try { const r = await fetch(url, { method: 'GET', cache: 'no-store' }); return r.ok; } catch (e) { return false; }
  }

  /* ───────── Análise ───────── */
  async function analisar() {
    F = [];
    const scriptsEl = $$('script');
    const externos = scriptsEl.filter(s => s.src);
    const mesmaOrigem = externos.filter(s => new URL(s.src, location.href).origin === location.origin);
    const textos = [];                       // código-fonte próprio para varredura
    scriptsEl.filter(s => !s.src && s.textContent.trim()).forEach(s => textos.push({ nome: 'inline', txt: s.textContent }));
    await Promise.all(mesmaOrigem.map(async s => {
      const t = await baixar(s.src); const nome = new URL(s.src).pathname.split('/').pop();
      if (t == null) add('alto', 'Código', `Script não carregou: ${nome}`, s.src, 'Confira o caminho/maiúsculas e se o arquivo foi enviado ao repositório (GitHub Pages diferencia maiúsculas).');
      else textos.push({ nome, txt: t });
    }));
    const todo = textos.map(t => t.txt).join('\n');

    /* ── SEGURANÇA ── */
    const inl = []; $$('*').forEach(el => [...el.attributes].forEach(a => { if (/^on/i.test(a.name)) inl.push({ el, nome: a.name, val: a.value }); }));
    if (inl.length) add('medio', 'Segurança', `${inl.length} manipuladores inline (onclick=…) no HTML`,
      'Impedem o uso de Content-Security-Policy restritiva e misturam lógica com marcação.', 'Trocar por addEventListener / delegação de eventos em app.js.');

    const semSRI = externos.filter(s => new URL(s.src, location.href).origin !== location.origin && !s.integrity);
    if (semSRI.length) add('medio', 'Segurança', `${semSRI.length} script(s) de CDN sem SRI (integrity)`,
      semSRI.map(s => s.src.replace(/^https?:\/\//, '').slice(0, 70)).join('\n'), 'Adicionar integrity="sha384-…" e crossorigin="anonymous" (gere em srihash.org) ou hospedar os arquivos no repositório.');
    const solto = externos.filter(s => /@latest|\/latest\//.test(s.src) || /@\d+\/dist/.test(s.src) && !/@\d+\.\d+/.test(s.src));
    if (solto.length) add('medio', 'Segurança', 'Biblioteca de CDN sem versão fixa', solto.map(s => s.src).join('\n'), 'Fixar versão exata (ex.: @4.1.3).');

    const segredos = [
      [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'critico', 'Chave privada no código'],
      [/Bearer\s+[A-Za-z0-9._-]{20,}/, 'critico', 'Token Bearer no código'],
      [/(client_secret|api[_-]?secret|private_key|secret[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/i, 'critico', 'Segredo hardcoded'],
      [/(password|senha)\s*[:=]\s*['"][^'"\s]{4,}['"]/i, 'alto', 'Senha hardcoded (confirme se não é placeholder)']
    ];
    segredos.forEach(([re, sev, t]) => { const m = todo.match(re); if (m) add(sev, 'Segurança', t, 'Trecho: ' + mask(m[0]), 'Remover do front-end; usar backend/Cloud Function e revogar a credencial exposta.'); });
    const fb = todo.match(/AIza[0-9A-Za-z_-]{35}/);
    if (fb) add('medio', 'Segurança', 'Firebase apiKey visível (normal, mas exige proteção)', 'Chave: ' + mask(fb[0]),
      'No Console Firebase: (1) regras do Firestore/Storage exigindo request.auth != null e papéis por usuário; (2) restringir a chave por domínio no Google Cloud; (3) ativar App Check.');
    if (/service_[a-z0-9]{5,}|template_[a-z0-9]{5,}/i.test(todo) || $$('input[id^="ejs-"]').some(i => i.value))
      add('medio', 'Segurança', 'IDs/chave do EmailJS expostos no navegador', 'Qualquer visitante pode usar sua cota (200 e-mails/mês) e disparar e-mails em seu nome.',
        'No painel EmailJS: restringir por domínio (Allowed Origins) e ativar reCAPTCHA; ideal mover o envio para backend.');

    const ov = document.getElementById('login-overlay');
    const ovVisivel = ov && getComputedStyle(ov).display !== 'none';
    if (ov) {
      add('alto', 'Segurança', 'Login só esconde a tela (CSS) — dados acessíveis no cliente',
        'Todo o HTML do sistema está carregado atrás do overlay; qualquer pessoa pode remover o overlay no DevTools. A proteção real depende só das regras do Firebase.',
        'Renderizar o app somente após onAuthStateChanged confirmar o usuário e garantir regras de leitura/escrita por uid no Firestore.');
      if (ovVisivel && $$('#tbody tr').some(tr => tr.children.length > 3)) add('critico', 'Segurança', 'Dados renderizados com o login ainda aberto', 'A tabela já tem linhas visíveis no DOM antes da autenticação.', 'Limpar o DOM/estado ao deslogar e só carregar dados após autenticar.');
    }
    let lsBytes = 0, lsGrandes = [], lsDados = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), v = localStorage.getItem(k) || '', b = (k.length + v.length) * 2; lsBytes += b; lsGrandes.push([k, b]);
        if (!lsDados && /"cliente"|"cte"|"nf"/i.test(v)) lsDados = true;
      }
    } catch (e) {}
    if (lsDados) add('medio', 'Segurança', 'Dados de clientes/CT-es guardados no localStorage sem criptografia', 'Ficam legíveis no navegador e persistem após o logout.', 'Limpar ao sair e priorizar o Firestore como fonte única de dados.');
    if (lsBytes > 3e6) add('alto', 'Desempenho', `localStorage em ${(lsBytes / 1e6).toFixed(1)} MB (limite típico ≈ 5 MB)`,
      lsGrandes.sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => `${x[0]}: ${(x[1] / 1024).toFixed(0)} KB`).join('\n'), 'Migrar o histórico para Firestore/IndexedDB; o setItem vai falhar silenciosamente ao estourar a cota.');
    $$('a[target="_blank"]').filter(a => !/noopener/.test(a.rel)).length && add('baixo', 'Segurança', 'Links target="_blank" sem rel="noopener noreferrer"', '', 'Adicionar rel="noopener noreferrer".');
    if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) add('baixo', 'Segurança', 'Sem Content-Security-Policy', 'GitHub Pages não permite cabeçalhos; use <meta http-equiv="Content-Security-Policy">.', 'Definir CSP por meta tag (exige remover os onclick inline).');
    if (/\bhttp:\/\/(?!localhost)/.test(document.documentElement.innerHTML)) add('medio', 'Segurança', 'Recurso http:// (conteúdo misto)', '', 'Trocar por https://.');

    /* ── CÓDIGO ── */
    const innerHTML = (todo.match(/\.innerHTML\s*[+]?=/g) || []).length;
    const temEsc = /function\s+(esc|escape\w*|sanitiz\w*)\b|(const|let|var)\s+(esc|escape\w*|sanitiz\w*)\s*=|DOMPurify/.test(todo);
    if (innerHTML) add(temEsc ? 'medio' : 'alto', 'Segurança', `${innerHTML} atribuições a innerHTML${temEsc ? '' : ' e nenhuma função de escape detectada'}`,
      'Planilhas importadas (Cliente, Rota, Ocorrência…) são renderizadas como HTML: um campo com <img onerror=…> executaria script (XSS).',
      'Usar textContent ou escapar todo valor vindo de planilha/Firestore antes de montar HTML.');
    if (/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(todo)) add('alto', 'Segurança', 'Uso de eval / new Function / document.write', '', 'Remover; são vetores de injeção e bloqueiam CSP.');
    const vazios = (todo.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/g) || []).length;
    if (vazios) add('medio', 'Código', `${vazios} bloco(s) catch vazios`, 'Erros engolidos escondem falhas de gravação/importação.', 'Registrar o erro (console.error + toast + log de auditoria).');
    const logs = (todo.match(/console\.log\(/g) || []).length;
    if (logs > 5) add('baixo', 'Código', `${logs} console.log esquecidos`, '', 'Remover ou proteger com flag DEBUG.');
    const vars = (todo.match(/\bvar\s+\w/g) || []).length;
    if (vars > 10) add('baixo', 'Código', `${vars} declarações com var`, 'Escopo de função e hoisting geram bugs sutis.', 'Migrar para const/let.');
    const dialogs = (todo.match(/\b(alert|confirm|prompt)\s*\(/g) || []).length;
    if (dialogs) add('baixo', 'UX', `${dialogs} uso(s) de alert/confirm/prompt`, 'Bloqueiam a thread e não funcionam bem em PWA/mobile.', 'Trocar por modais/toasts (já existem no sistema).');
    const intervalos = (todo.match(/setInterval\s*\(/g) || []).length, limpa = (todo.match(/clearInterval\s*\(/g) || []).length;
    if (intervalos > limpa) add('medio', 'Código', `${intervalos} setInterval vs ${limpa} clearInterval`, 'Timers acumulam e repetem ações (ex.: alertas).', 'Guardar o id e limpar antes de recriar.');
    const tarefas = (todo.match(/\/\/\s*(TODO|FIXME|HACK|XXX)/gi) || []).length;
    tarefas && add('info', 'Código', `${tarefas} marcador(es) TODO/FIXME`, '', 'Revisar pendências.');
    textos.forEach(t => { if (t.txt.length > 120000) add('baixo', 'Código', `${t.nome} com ${(t.txt.length / 1024).toFixed(0)} KB`, '', 'Dividir em módulos.'); });
    if (/auto|autom[aá]tic/i.test(document.body.innerText) && /setInterval|setTimeout/.test(todo) && document.getElementById('cfg-auto'))
      add('alto', 'Arquitetura', 'Alertas "automáticos" dependem da aba aberta',
        'Disparos às 08h/12h/16h/20h feitos no navegador só ocorrem com a página aberta e logada; WhatsApp não pode ser enviado direto do front-end.',
        'Mover para Cloud Functions + Cloud Scheduler (ou GitHub Actions agendado) enviando e-mail/WhatsApp via API.');

    // Funções chamadas por handlers inline que não existem
    const nomes = new Set(), ignora = new Set(['if', 'for', 'while', 'switch', 'return', 'function', 'catch', 'typeof', 'event']);
    inl.forEach(h => { const re = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g; let m; while ((m = re.exec(h.val))) if (!ignora.has(m[1])) nomes.add(m[1]); });
    const faltam = [...nomes].filter(n => { try { return (0, eval)('typeof ' + n) === 'undefined'; } catch (e) { return false; } });
    if (faltam.length) add('critico', 'Código', `${faltam.length} função(ões) chamada(s) no HTML não existe(m)`, faltam.join(', '), 'Definir as funções em app.js ou remover os botões — hoje o clique não faz nada (ReferenceError).');

    // IDs duplicados
    const ids = {}; $$('[id]').forEach(e => ids[e.id] = (ids[e.id] || 0) + 1);
    const dup = Object.keys(ids).filter(k => ids[k] > 1);
    if (dup.length) add('alto', 'Código', 'IDs duplicados no DOM', dup.join(', '), 'IDs devem ser únicos; getElementById só devolve o primeiro.');

    /* ── ERROS EM TEMPO REAL ── */
    if (RT.erros.length) add('critico', 'Runtime', `${RT.erros.length} erro(s) JavaScript`, [...new Set(RT.erros)].slice(0, 6).join('\n'), 'Corrigir na ordem listada; o primeiro costuma causar os demais.');
    if (RT.rejeicoes.length) add('alto', 'Runtime', `${RT.rejeicoes.length} Promise rejeitada(s) sem tratamento`, [...new Set(RT.rejeicoes)].slice(0, 5).join('\n'), 'Adicionar try/catch ou .catch() nas chamadas async (Firebase, EmailJS, leitura de arquivo).');
    if (RT.consoleErr.length) add('medio', 'Runtime', `${RT.consoleErr.length} console.error`, [...new Set(RT.consoleErr)].slice(0, 5).join('\n'), '');
    if (RT.recursos.length) add('alto', 'Runtime', 'Recursos que falharam ao carregar', [...new Set(RT.recursos)].slice(0, 6).join('\n'), 'Verificar caminhos, maiúsculas e se foram enviados ao GitHub.');
    if (RT.fetchFalhos.length) add('alto', 'Runtime', 'Requisições com falha', [...new Set(RT.fetchFalhos)].slice(0, 6).join('\n'), 'Tratar erro de rede e mostrar aviso ao usuário.');

    /* ── DESEMPENHO ── */
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.domContentLoadedEventEnd > 3000) add('medio', 'Desempenho', `DOMContentLoaded em ${(nav.domContentLoadedEventEnd / 1000).toFixed(1)} s`, '', 'Reduzir scripts bloqueantes e carregar bibliotecas sob demanda.');
    const bloq = $$('head script[src]').filter(s => !s.defer && !s.async && s.type !== 'module');
    if (bloq.length) add('medio', 'Desempenho', `${bloq.length} script(s) bloqueando a renderização no <head>`, bloq.map(s => s.src.split('/').slice(-1)[0]).join(', '), 'Usar defer. XLSX (≈1 MB) só deveria carregar ao importar planilha; Chart.js só na aba de gráficos.');
    performance.getEntriesByType('resource').filter(r => (r.encodedBodySize || 0) > 5e5).forEach(r => add('baixo', 'Desempenho', `Recurso pesado: ${(r.encodedBodySize / 1024).toFixed(0)} KB`, r.name.slice(0, 90), 'Carregar sob demanda ou minificado.'));
    const nos = document.getElementsByTagName('*').length;
    if (nos > 3000) add('medio', 'Desempenho', `${nos} elementos no DOM`, '', 'Paginar ou virtualizar a tabela.');
    const linhas = $$('#tbody tr').length;
    if (linhas > 300) add('medio', 'Desempenho', `${linhas} linhas renderizadas de uma vez`, 'Reescrever o tbody inteiro a cada filtro/digitação trava com volume alto.', 'Paginação (50–100/página) e debounce de ~250 ms no campo de busca (hoje usa oninput direto).');
    if (RT.longtasks.length) add('baixo', 'Desempenho', `${RT.longtasks.length} tarefa(s) longas (máx. ${Math.max(...RT.longtasks).toFixed(0)} ms)`, '', 'Quebrar processamento de importação em lotes.');

    /* ── ACESSIBILIDADE / HTML ── */
    if (!document.documentElement.lang) add('baixo', 'Acessibilidade', 'html sem atributo lang', '', '<html lang="pt-BR">');
    const semAlt = $$('img:not([alt])').length; semAlt && add('baixo', 'Acessibilidade', `${semAlt} imagem(ns) sem alt`, '', 'Adicionar alt.');
    const semLabel = $$('input:not([type=hidden]):not([type=file]),select,textarea').filter(i => !i.labels?.length && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby')).length;
    if (semLabel) add('baixo', 'Acessibilidade', `${semLabel} campo(s) sem label/aria-label`, 'Só com placeholder, leitores de tela não identificam o campo.', 'Adicionar aria-label.');
    const clicaveis = $$('div[onclick],span[onclick],.card[onclick]').filter(e => !e.hasAttribute('tabindex') && !e.getAttribute('role')).length;
    if (clicaveis) add('baixo', 'Acessibilidade', `${clicaveis} elemento(s) clicável(is) sem teclado/role`, '', 'Usar <button> ou role="button" + tabindex="0".');
    $$('.modal-overlay,.modal').length && !$$('[role=dialog]').length && add('baixo', 'Acessibilidade', 'Modal sem role="dialog" / aria-modal', 'Também sem fechar por Esc.', 'Adicionar role, aria-modal e tratar Esc/foco.');
    $$('button:not([type])').length && add('info', 'HTML', 'Botões sem type', '', 'Definir type="button".');

    /* ── PWA ── */
    const man = document.querySelector('link[rel=manifest]');
    if (!man) add('medio', 'PWA', 'Sem manifest.json', '', 'Adicionar manifest.');
    else {
      const txt = await baixar(man.href);
      if (!txt) add('alto', 'PWA', 'manifest.json não carrega (404)', man.href, 'Conferir o caminho — no GitHub Pages o projeto fica em /Cargas-Pendentes/.');
      else try {
        const j = JSON.parse(txt);
        if (!j.start_url || !j.icons || !j.icons.some(i => /512/.test(i.sizes || ''))) add('baixo', 'PWA', 'Manifest incompleto', 'Falta start_url ou ícone 512×512.', 'Completar para permitir instalação.');
      } catch (e) { add('alto', 'PWA', 'manifest.json inválido (JSON quebrado)', '', 'Validar o JSON.'); }
    }
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration().catch(() => null);
    if (!reg) add('medio', 'PWA', 'Service Worker não registrado', 'Sem ele o app não funciona offline e não é instalável de forma confiável (o indicador "🔌 Offline" do cabeçalho perde sentido).', 'Registrar sw.js em pwa.js, com cache dos arquivos estáticos.');
    for (const ic of $$('link[rel=icon],link[rel=apple-touch-icon]')) if (!(await existe(ic.href))) add('baixo', 'PWA', 'Ícone não encontrado', ic.href, 'Enviar o arquivo ao repositório.');

    /* ── INTEGRIDADE DOS DADOS ── */
    const linhasTab = $$('#tbody tr').filter(tr => tr.children.length > 3);
    if (linhasTab.length) {
      const cont = {}; linhasTab.forEach(tr => { const k = (tr.children[1]?.textContent || '').replace(/\s+/g, ' ').trim().toUpperCase(); if (k) cont[k] = (cont[k] || 0) + 1; });
      const rep = Object.entries(cont).filter(([, n]) => n > 1);
      if (rep.length) add('alto', 'Dados', `${rep.length} NF/CT-e repetido(s) na tabela`, rep.slice(0, 5).map(([k, n]) => `${k} ×${n}`).join('\n'), 'Aplicar a regra anti-repetição (angel-extras.js) na importação e na carga inicial.');
      const semT = linhasTab.filter(tr => { const c = tr.children[tr.children.length - 2]; return c && !c.textContent.trim().replace(/[—-]/g, ''); }).length;
      semT && add('info', 'Dados', `${semT} linha(s) com tratativa vazia`, '', 'Cobertas pelo pop-up de CTEs sem tratativa.');
    }
    const num = id => { const e = document.getElementById(id); return e ? parseInt(e.textContent.replace(/\D/g, ''), 10) || 0 : null; };
    const total = num('cnt-total'), faixas = ['cnt-vencidas', 'cnt-vencehoje', 'cnt-ate3', 'cnt-ate5', 'cnt-dentro', 'cnt-semprevisao'].map(num);
    if (total != null && faixas.every(v => v != null) && total > 0) {
      const soma = faixas.reduce((a, b) => a + b, 0);
      if (soma !== total) add('alto', 'Dados', `Painel de prazos não fecha com o total (${soma} ≠ ${total})`, 'Alguma carga está caindo fora das faixas ou sendo contada duas vezes.', 'Revisar a função que classifica o prazo: as faixas devem ser mutuamente exclusivas e cobrir 100% das cargas.');
    }
    document.getElementById('table-count') && total != null && (parseInt(document.getElementById('table-count').textContent) || 0) > total && add('medio', 'Dados', 'Contador da tabela maior que o total de cargas', '', 'Revisar renderTabela/contadores.');

    return F;
  }

  /* ───────── Relatório ───────── */
  function relatorio() {
    const ord = [...F].sort((a, b) => SEV[a.sev][2] - SEV[b.sev][2]);
    let md = `# Auditoria — Angel 2809 Cargas Pendentes\n${new Date().toLocaleString('pt-BR')} · ${location.href}\n\n`;
    md += Object.keys(SEV).map(k => `${SEV[k][0]} ${SEV[k][1]}: ${F.filter(f => f.sev === k).length}`).join(' · ') + '\n\n';
    ord.forEach(f => { md += `## ${SEV[f.sev][0]} [${f.cat}] ${f.titulo}\n${f.detalhe ? '```\n' + f.detalhe + '\n```\n' : ''}${f.correcao ? '**Correção:** ' + f.correcao + '\n' : ''}\n`; });
    return md;
  }
  const copiar = async txt => { try { await navigator.clipboard.writeText(txt); return true; } catch (e) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } };

  /* ───────── Interface (Shadow DOM) ───────── */
  function montarUI() {
    if (document.getElementById('angel-operador-host')) return;
    const host = document.createElement('div'); host.id = 'angel-operador-host';
    host.style.cssText = 'position:fixed;left:14px;bottom:14px;z-index:2147483647;';
    const sh = host.attachShadow({ mode: 'open' });
    sh.innerHTML = `
<style>
*{box-sizing:border-box;font-family:system-ui,Segoe UI,Roboto,sans-serif}
.fab{width:38px;height:38px;border-radius:50%;border:1px solid #30363d;background:#0d1117;color:#fff;font-size:17px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);position:relative;opacity:.88;transition:.15s}
.fab:hover{opacity:1;transform:scale(1.08)}
.bd{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#da3633;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.bd.ok{background:#238636}
.pn{display:none;position:absolute;left:0;bottom:46px;width:min(400px,92vw);max-height:70vh;flex-direction:column;background:#0d1117;color:#e6edf3;border:1px solid #30363d;border-radius:12px;box-shadow:0 10px 34px rgba(0,0,0,.6);overflow:hidden}
.pn.on{display:flex}
.hd{padding:10px 12px;border-bottom:1px solid #30363d;display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700}
.tb{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #30363d}
button.s{background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer}
button.s:hover{background:#21262d}button.s.act{border-color:#58a6ff;color:#58a6ff}
.ls{overflow:auto;padding:8px 12px 12px;display:flex;flex-direction:column;gap:8px}
.it{border:1px solid #30363d;border-radius:8px;padding:8px 10px;background:#161b22;font-size:12px;line-height:1.4}
.it b{font-size:12.5px}.ct{color:#8b949e;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}
pre{white-space:pre-wrap;word-break:break-word;margin:6px 0;padding:6px;background:#0d1117;border-radius:6px;font-size:11px;color:#c9d1d9}
.fx{color:#7ee787;margin-top:4px}.em{padding:24px;text-align:center;color:#8b949e;font-size:12px}
</style>
<div class="pn" id="pn"><div class="hd"><span>🔍 Operador de Melhorias</span><button class="s" id="x">✕</button></div>
<div class="tb" id="tb"></div><div class="ls" id="ls"><div class="em">Analisando…</div></div></div>
<button class="fab" id="fab" title="Operador de Melhorias — auditar sistema">🔍<span class="bd ok" id="bd">…</span></button>`;
    document.body.appendChild(host);
    const $ = id => sh.getElementById(id);
    let filtro = 'todos';

    function pintar() {
      const ord = [...F].sort((a, b) => SEV[a.sev][2] - SEV[b.sev][2]);
      const graves = F.filter(f => f.sev === 'critico' || f.sev === 'alto').length;
      $('bd').textContent = F.length; $('bd').className = 'bd' + (F.length === 0 ? ' ok' : '');
      $('bd').style.background = graves ? '#da3633' : F.length ? '#9e6a03' : '#238636';
      const cats = ['todos', ...Object.keys(SEV).filter(k => F.some(f => f.sev === k))];
      $('tb').innerHTML = cats.map(c => `<button class="s ${c === filtro ? 'act' : ''}" data-f="${c}">${c === 'todos' ? 'Todos ' + F.length : SEV[c][0] + ' ' + F.filter(f => f.sev === c).length}</button>`).join('') +
        '<button class="s" id="re">🔄</button><button class="s" id="cp">📋 Copiar</button><button class="s" id="dl">⬇️ .md</button><button class="s" id="ia">🤖 Pedir correção</button>';
      const vis = ord.filter(f => filtro === 'todos' || f.sev === filtro);
      $('ls').innerHTML = vis.length ? vis.map(f => `<div class="it"><div class="ct">${SEV[f.sev][0]} ${SEV[f.sev][1]} · ${esc(f.cat)}</div><b>${esc(f.titulo)}</b>${f.detalhe ? `<pre>${esc(f.detalhe)}</pre>` : ''}${f.correcao ? `<div class="fx">➜ ${esc(f.correcao)}</div>` : ''}</div>`).join('') : '<div class="em">✅ Nenhuma falha detectada nesta categoria.</div>';
      sh.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filtro = b.dataset.f; pintar(); });
      $('re').onclick = rodar;
      $('cp').onclick = async e => { e.target.textContent = (await copiar(relatorio())) ? '✔ Copiado' : '✖ Falhou'; };
      $('ia').onclick = async e => {
        const p = 'Você é um engenheiro sênior. Abaixo está o relatório de auditoria do meu portal logístico (HTML/JS/Firebase, GitHub Pages). Priorize do mais grave ao menos grave e me entregue os patches de código prontos, um por vez, com o arquivo e o trecho a alterar.\n\n' + relatorio();
        e.target.textContent = (await copiar(p)) ? '✔ Cole no Claude' : '✖ Falhou';
      };
      $('dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([relatorio()], { type: 'text/markdown' })); a.download = 'auditoria-angel-' + new Date().toISOString().slice(0, 10) + '.md'; a.click(); };
    }
    async function rodar() {
      $('ls').innerHTML = '<div class="em">Analisando…</div>';
      try { await analisar(); } catch (e) { F = [{ sev: 'medio', cat: 'Operador', titulo: 'Falha interna na análise', detalhe: String(e && e.message || e), correcao: '' }]; }
      pintar();
    }
    $('fab').onclick = () => { $('pn').classList.toggle('on'); };
    $('x').onclick = () => $('pn').classList.remove('on');
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $('pn').classList.remove('on'); });
    setTimeout(rodar, 3500); // análise automática após a página assentar
  }

  const start = () => (document.body ? montarUI() : setTimeout(start, 50));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
