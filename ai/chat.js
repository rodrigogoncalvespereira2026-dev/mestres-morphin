"use strict";

const state = {
  masters: [],
  activeId: null,
  histories: {}, // masterId -> [{role, content}]
  temperaturas: {}, // masterId -> criatividade (0.0 - 1.5)
  lore: {}, // masterId -> biografia devolvida pelo servidor
  busy: false,
  configured: false,
  // true enquanto a síntese de voz toca (ou o microfone, quando existir).
  speaking: false,
  listening: false,
  autoSpeak: true,
};

const els = {
  list: document.getElementById("master-list"),
  dot: document.getElementById("chat-dot"),
  name: document.getElementById("chat-name"),
  meta: document.getElementById("chat-meta"),
  messages: document.getElementById("messages"),
  form: document.getElementById("chat-form"),
  input: document.getElementById("input"),
  send: document.getElementById("send-btn"),
  banner: document.getElementById("config-banner"),
  toast: document.getElementById("toast"),
  vozBtn: document.getElementById("voz-btn"),
  vozTxt: document.getElementById("voz-txt"),
  vozIc: document.getElementById("voz-ic"),
  // Onda sonora ao lado do botão de voz (5 barras).
  onda: document.getElementById("onda-voz"),
  // Sugestões rápidas acima do campo de texto.
  sugestoes: document.getElementById("sugestoes"),
  // Distintivo de status ao lado do nome do Mestre ativo.
  badge: document.getElementById("badge-status"),
  badgeTexto: document.getElementById("badge-status-texto"),
  // Painel central da conversa — serve para o efeito de brilho (`.pensando`).
  painel: document.querySelector(".chat"),
  // Slider de criatividade (temperatura do modelo).
  temp: document.getElementById("temp-range"),
  tempRotulo: document.getElementById("temp-rotulo"),
  // Painel lateral de biografia / lore.
  lore: document.getElementById("lore-panel"),
  loreNome: document.getElementById("lore-nome"),
  loreStatus: document.getElementById("lore-status"),
  loreLoading: document.getElementById("lore-loading"),
  loreErro: document.getElementById("lore-erro"),
  loreTexto: document.getElementById("lore-texto"),
  loreFechar: document.getElementById("lore-fechar"),
};

// ---------- helpers ----------
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add("hidden"), 4000);
}

function scrollDown() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

// ---------- voz (mesmo sistema do Alpha) ----------
// Síntese do próprio browser, a falar sozinha cada resposta.
const synth = window.speechSynthesis;

// O browser só deixa sintetizar depois de um gesto do utilizador: até lá a
// resposta fica em espera e sai no primeiro toque/tecla.
let vozBloqueada = true;
let vozPendente = null;

// Onda sonora do botão: pulsa enquanto a IA fala ou o microfone ouve.
// Sempre que o estado muda, as barras voltam suavemente ao repouso (4px).
function atualizarOnda() {
  if (!els.onda) return;
  els.onda.classList.toggle("wave-active", Boolean(state.speaking || state.listening));
}

// Tom de cada Mestre: mantém as vozes distinguíveis mesmo quando o browser
// não tem a voz pedida instalada (aí cai na voz pt por omissão).
const TOM_MESTRE = {
  Duarte: { pitch: 0.9, rate: 0.85 },
  Miguel: { pitch: 0.95, rate: 0.87 },
  Antonio: { pitch: 0.92, rate: 0.86 },
  Euclides: { pitch: 1.0, rate: 0.85 },
  Raquel: { pitch: 1.25, rate: 0.9 },
  Francisca: { pitch: 1.2, rate: 0.88 },
  Matilde: { pitch: 1.1, rate: 0.84 },
  Thalita: { pitch: 1.15, rate: 0.9 },
  Valerio: { pitch: 0.88, rate: 0.84 },
  Yara: { pitch: 1.12, rate: 0.87 },
  Nicolau: { pitch: 0.9, rate: 0.83 },
  Brenda: { pitch: 1.18, rate: 0.9 },
  Humberto: { pitch: 0.86, rate: 0.85 },
  Leticia: { pitch: 1.14, rate: 0.86 },
  Leila: { pitch: 1.08, rate: 0.85 },
  Fabio: { pitch: 0.9, rate: 0.86 },
  Julio: { pitch: 1.05, rate: 0.92 },
  Donato: { pitch: 0.85, rate: 0.82 },
  Giovanna: { pitch: 1.06, rate: 0.84 },
  Elza: { pitch: 1.1, rate: 0.88 },
};

function escolherVoz(master) {
  if (!synth) return null;
  const vozes = synth.getVoices();
  const nome = ((master && master.voiceName) || "").toLowerCase();
  if (nome) {
    const exata = vozes.find((v) => v.name.toLowerCase().includes(nome));
    if (exata) return exata;
  }
  return (
    vozes.find((v) => v.lang.includes("pt") && v.name.includes("Google")) ||
    vozes.find((v) => v.lang.includes("pt")) ||
    vozes.find((v) => v.lang.includes("es")) ||
    null
  );
}

function speak(text, masterId, forcar = false) {
  if (!text || !synth) return;
  if (!forcar && !state.autoSpeak) return;
  if (vozBloqueada) {
    vozPendente = { text, masterId };
    return;
  }
  const master = state.masters.find((m) => m.id === masterId) || null;
  synth.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-PT";
  const tom = TOM_MESTRE[(master && master.voiceName) || ""] || { pitch: 1.1, rate: 0.85 };
  utter.rate = tom.rate;
  utter.pitch = tom.pitch;
  utter.volume = 1.0;
  const match = escolherVoz(master);
  if (match) utter.voice = match;
  utter.onstart = () => {
    state.speaking = true;
    atualizarOnda();
    cara?.estado("falar");
  };
  const parar = () => {
    state.speaking = false;
    atualizarOnda();
    cara?.estado("espera");
  };
  utter.onend = parar;
  utter.onerror = parar;
  synth.speak(utter);
}

function stopSpeaking() {
  if (synth) synth.cancel();
  vozPendente = null;
  state.speaking = false;
  state.listening = false;
  atualizarOnda();
  cara?.estado("espera");
}

function desbloquearVoz() {
  if (!vozBloqueada) return;
  vozBloqueada = false;
  const p = vozPendente;
  vozPendente = null;
  if (p) speak(p.text, p.masterId, true);
}

["pointerdown", "click", "keydown", "touchstart"].forEach((ev) => {
  window.addEventListener(ev, desbloquearVoz, { once: true, passive: true });
});

// O Chrome carrega a lista de vozes de forma assíncrona: aquece-a já.
if (synth) {
  synth.addEventListener("voiceschanged", () => {});
  synth.getVoices();
}

// ---------- cara (cara.js) ----------
// O retrato do Mestre escolhido, irmão da cara do Alpha: pensa enquanto
// espera, fala com a boca enquanto a voz fala e muda de cor com o Mestre.
const cara = window.CaraPrimal
  ? CaraPrimal.criar(document.getElementById("cara"), { variante: "mestre" })
  : null;

// ---------- painel de reações (escolher a expressão à mão) ----------
// Como o do Alpha: cada azulejo é uma cara parada com a expressão já aplicada,
// e tocar nele mostra-a na cara do Mestre. A grelha refaz-se ao trocar de
// Mestre, para o visor e a pedra ficarem na cor dele.
const ROTULOS = {
  feliz: "Feliz!",
  rir: "A rir!",
  amor: "Amor!",
  envergonhado: "Envergonhado...",
  piscadela: "Piscadela ;)",
  desconfiado: "Desconfiado...",
  determinado: "Determinado!",
  surpreso: "Surpreso!",
  confuso: "Confuso...",
  triste: "Triste...",
  zangado: "Zangado!",
  sono: "Com sono...",
};

const painelReacoes = document.getElementById("reacoes");
const grelhaReacoes = document.getElementById("reacoes-grelha");
const botaoReacoes = document.getElementById("reacoes-btn");
let grelhaFeita = false;

function construirGrelha() {
  if (!cara || !window.CaraPrimal || !state.masters.length) return;
  const master = activeMaster();
  grelhaReacoes.innerHTML = "";
  for (const nome of CaraPrimal.expressoes) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = "reacao";
    botao.title = nome;
    botao.setAttribute("aria-pressed", "false");

    const miniatura = document.createElement("canvas");
    miniatura.width = 300;
    miniatura.height = 280;
    miniatura.setAttribute("aria-hidden", "true");
    // Uma cara parada por azulejo (12 a animar ao mesmo tempo seria demais).
    CaraPrimal.criar(miniatura, {
      variante: "mestre",
      cor: master ? master.color : null,
      estatico: nome,
      densidade: 1,
    });

    const rotulo = document.createElement("span");
    rotulo.textContent = ROTULOS[nome] || nome;

    botao.append(miniatura, rotulo);
    botao.addEventListener("click", () => escolherReacao(nome, botao));
    grelhaReacoes.appendChild(botao);
  }
  grelhaFeita = true;
}

function escolherReacao(nome, botao) {
  cara?.expressao(nome, 3500);
  for (const outro of grelhaReacoes.querySelectorAll(".reacao")) {
    outro.setAttribute("aria-pressed", String(outro === botao));
  }
}

function abrirReacoes(abrir) {
  painelReacoes.hidden = !abrir;
  botaoReacoes.setAttribute("aria-expanded", String(abrir));
  if (abrir) construirGrelha();
}

botaoReacoes.addEventListener("click", () => abrirReacoes(painelReacoes.hidden));
document.getElementById("reacoes-fechar").addEventListener("click", () => {
  abrirReacoes(false);
  botaoReacoes.focus();
});
document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !painelReacoes.hidden) abrirReacoes(false);
});

function addBubble(role, content, who) {
  const wrap = document.createElement("div");
  wrap.className = "msg " + role;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  const whoEl = document.createElement("div");
  whoEl.className = "who";
  whoEl.textContent = who;
  bubble.appendChild(whoEl);
  bubble.appendChild(document.createTextNode(content));
  wrap.appendChild(bubble);
  els.messages.appendChild(wrap);
  scrollDown();
  return bubble;
}

function typingIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "msg master";
  const p = document.createElement("div");
  p.className = "typing";
  p.id = "typing";
  p.textContent = "o Mestre medita";
  wrap.appendChild(p);
  els.messages.appendChild(wrap);
  scrollDown();
}

function removeTyping() {
  const t = document.getElementById("typing");
  if (t) t.parentElement.remove();
}

// ---------- distintivo de status ----------
// "canónico" -> "canonico" (para o atributo data-status do CSS), sem acentos.
function statusSlug(status) {
  const s = String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!s) return "";
  return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Selo ao lado do nome: texto, cor e visibilidade acompanham o Mestre ativo.
function atualizarBadge(m) {
  if (!els.badge) return;
  if (!m || !m.status) {
    els.badge.hidden = true;
    return;
  }
  els.badge.hidden = false;
  els.badge.dataset.status = statusSlug(m.status);
  if (els.badgeTexto) els.badgeTexto.textContent = m.status;
}

// ---------- sugestões rápidas ----------
// Três perguntas por Mestre (vêm de /api/masters em "suggestions").
// Clicar numa pílula escreve no campo e põe o cursor pronto a enviar.
function renderSugestoes() {
  const box = els.sugestoes;
  if (!box) return;
  const m = activeMaster();
  const lista = m && Array.isArray(m.suggestions) ? m.suggestions.slice(0, 3) : [];
  box.textContent = "";
  for (const texto of lista) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sugestao";
    b.textContent = texto;
    b.title = texto;
    b.addEventListener("click", () => {
      els.input.value = texto;
      resizeInput();
      updateSend();
      els.input.focus();
      const fim = els.input.value.length;
      els.input.setSelectionRange(fim, fim);
    });
    box.appendChild(b);
  }
}

// ---------- master switching ----------
function activeMaster() {
  return state.masters.find((m) => m.id === state.activeId) || null;
}

function renderList() {
  els.list.innerHTML = "";
  for (const m of state.masters) {
    const b = document.createElement("button");
    b.className = "master";
    b.dataset.id = m.id;
    b.style.setProperty("--accent", m.color);
    if (m.id === state.activeId) b.classList.add("active");

    const dot = document.createElement("span");
    dot.className = "dot";
    const name = document.createElement("span");
    name.className = "mname";
    // Nome curto na lista lateral (o nome completo aparece no cabeçalho do chat).
    name.textContent = m.short || m.name;
    const badge = document.createElement("span");
    badge.className = "badge " + m.status;
    badge.textContent = m.status === "canónico" ? "canónico" : "rascunho";

    b.append(dot, name, badge);
    b.addEventListener("click", () => selectMaster(m.id));
    els.list.appendChild(b);
  }
}

function selectMaster(id) {
  state.activeId = id;
  guardarEstado();
  const m = activeMaster();
  if (!m) return;
  document.documentElement.style.setProperty("--accent", m.color);
  cara?.estado("espera");
  cara?.cor(m.color);
  // As miniaturas do painel seguem a cor do Mestre escolhido.
  if (grelhaFeita) construirGrelha();
  els.dot.style.background = m.color;
  els.dot.style.boxShadow = "0 0 12px " + m.color;
  els.name.textContent = m.name;
  atualizarBadge(m);
  atualizarEstado();
  atualizarSliderTemp();
  // Painel de biografia aberto? Passa a mostrar o novo Mestre.
  if (els.lore && els.lore.classList.contains("aberto")) abrirLore();
  for (const b of els.list.querySelectorAll(".master")) {
    b.classList.toggle("active", b.dataset.id === id);
  }
  renderMessages();
  renderSugestoes();
  updateSend();
  els.input.focus();
}

function renderMessages() {
  els.messages.innerHTML = "";
  const hist = state.histories[state.activeId] || [];
  const who = activeMaster() ? activeMaster().name : "Mestre";
  if (hist.length === 0) {
    const hint = document.createElement("div");
    hint.className = "msg master";
    const b = document.createElement("div");
    b.className = "bubble";
    const whoEl = document.createElement("div");
    whoEl.className = "who";
    whoEl.textContent = who;
    b.appendChild(whoEl);
    b.appendChild(document.createTextNode(
      "Saudação, iniciado. Fala — estou a ouvir-te."
    ));
    hint.appendChild(b);
    els.messages.appendChild(hint);
  } else {
    for (const m of hist) {
      addBubble(m.role, m.content, m.role === "user" ? "Tu" : who);
    }
  }
  scrollDown();
}

// ---------- send ----------
async function send() {
  const text = els.input.value.trim();
  const master = activeMaster();
  if (!text || !master || state.busy) return;

  const hist = (state.histories[master.id] = state.histories[master.id] || []);
  hist.push({ role: "user", content: text });
  guardarEstado();
  els.input.value = "";
  resizeInput();
  renderMessages();
  state.busy = true;
  updateSend();
  atualizarEstado();
  cara?.estado("pensar");
  typingIndicator();

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        masterId: master.id,
        messages: hist,
        temperature: temperaturaAtiva(),
      }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || ("Erro " + resp.status));
    }
    removeTyping();
    hist.push({ role: "assistant", content: data.reply || "" });
    guardarEstado();
    renderMessages();
    cara?.estado("espera");
    cara?.humor(data.reply);
    speak(data.reply, master.id);
  } catch (err) {
    removeTyping();
    cara?.estado("espera");
    const who = master.name;
    const wrap = document.createElement("div");
    wrap.className = "msg err";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    const whoEl = document.createElement("div");
    whoEl.className = "who";
    whoEl.textContent = who;
    bubble.appendChild(whoEl);
    bubble.appendChild(document.createTextNode(String(err.message || err)));
    wrap.appendChild(bubble);
    els.messages.appendChild(wrap);
    scrollDown();
    toast("A resposta falhou — vê a mensagem de erro acima.");
  } finally {
    state.busy = false;
    updateSend();
    atualizarEstado();
    els.input.focus();
  }
}

function updateSend() {
  const master = activeMaster();
  const canSend =
    state.configured && master && !state.busy && els.input.value.trim().length > 0;
  els.send.disabled = !canSend;
}

function resizeInput() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 140) + "px";
}

// ---------- persistência (localStorage) ----------
// O Mestre escolhido e as conversas ficam guardados no navegador: recarregar a
// página não apaga as mensagens nem volta ao primeiro Mestre da lista.
const CHAVE_ATIVO = "mestres-morphin:mestre-ativo";
const CHAVE_HISTORIAS = "mestres-morphin:historias";
const CHAVE_TEMPERATURAS = "mestres-morphin:temperaturas";
// Mesmos limites do slider (min 0.0 / max 1.5) e do backend.
const TEMP_PADRAO = 0.7;
const TEMP_MIN = 0;
const TEMP_MAX = 1.5;

function limitarTemperatura(valor) {
  const n = typeof valor === "number" ? valor : parseFloat(valor);
  if (!Number.isFinite(n)) return TEMP_PADRAO;
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, n));
}

function temperaturaAtiva() {
  return limitarTemperatura(state.temperaturas[state.activeId]);
}

function guardarEstado() {
  try {
    if (state.activeId) localStorage.setItem(CHAVE_ATIVO, state.activeId);
    localStorage.setItem(CHAVE_HISTORIAS, JSON.stringify(state.histories));
    localStorage.setItem(CHAVE_TEMPERATURAS, JSON.stringify(state.temperaturas));
  } catch (_) {
    // Modo privado / armazenamento cheio — a app continua a funcionar em memória.
  }
}

function carregarEstado() {
  try {
    const ativo = localStorage.getItem(CHAVE_ATIVO);
    if (ativo) state.activeId = ativo;
    const guardadas = JSON.parse(localStorage.getItem(CHAVE_HISTORIAS) || "{}");
    if (guardadas && typeof guardadas === "object" && !Array.isArray(guardadas)) {
      // Só aceita mensagens com o formato esperado: um histórico estragado no
      // navegador não pode partir o ecrã no arranque.
      const limpas = {};
      for (const [id, msgs] of Object.entries(guardadas)) {
        if (!Array.isArray(msgs)) continue;
        limpas[id] = msgs.filter(
          (m) =>
            m &&
            typeof m === "object" &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        );
      }
      state.histories = limpas;
    }
    const temps = JSON.parse(localStorage.getItem(CHAVE_TEMPERATURAS) || "{}");
    if (temps && typeof temps === "object" && !Array.isArray(temps)) {
      const limpas = {};
      for (const [id, v] of Object.entries(temps)) {
        limpas[id] = limitarTemperatura(v);
      }
      state.temperaturas = limpas;
    }
  } catch (_) {
    // Histórico ilegível — começa limpo.
  }
}

// ---------- estado visível (status + brilho do painel) ----------
function textoEstado() {
  const m = activeMaster();
  if (!m) return "";
  if (state.busy) return "A meditar na Rede Morphin...";
  return state.configured
    ? "Ligado · modelo " + state.model + " · " + (m.status === "canónico" ? "canónico" : "rascunho")
    : m.status === "canónico"
      ? "Cérebro canónico · prompt de sistema carregado."
      : "Rascunho — prompt ainda por validar.";
}

function atualizarEstado() {
  if (els.meta) {
    els.meta.textContent = textoEstado();
    els.meta.classList.toggle("meditar", state.busy);
  }
  // O painel central acende na cor do Mestre enquanto ele medita.
  if (els.painel) els.painel.classList.toggle("pensando", state.busy);
}

// ---------- slider de criatividade ----------
function atualizarSliderTemp() {
  if (!els.temp) return;
  const t = temperaturaAtiva();
  els.temp.value = String(t);
  // Preenchimento da trilho até ao valor actual (--fill é lido pelo CSS).
  const pct = ((t - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * 100;
  els.temp.style.setProperty("--fill", pct.toFixed(1) + "%");
  if (els.tempRotulo) els.tempRotulo.textContent = "Criatividade: " + t.toFixed(1);
}

// ---------- biografia / lore ----------
// Texto em negrito/itálico/etc. O conteúdo é escapado primeiro: nunca se
// injecta HTML bruto vindo do ficheiro do Mestre.
function inlineMd(texto) {
  let s = esc(texto);
  s = s.replace(/!\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/g, "$1");
  s = s.replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, "$1");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  return s;
}

// Markdown -> fragmento do DOM (títulos, listas, parágrafos, réguas, código).
function renderMarkdown(md) {
  const frag = document.createDocumentFragment();
  let paragrafo = [];
  let lista = null;
  let emCodigo = false;
  let codigo = [];

  const fecharPar = () => {
    if (!paragrafo.length) return;
    const p = document.createElement("p");
    p.innerHTML = inlineMd(paragrafo.join(" "));
    frag.appendChild(p);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (!lista) return;
    frag.appendChild(lista);
    lista = null;
  };
  const fecharCodigo = () => {
    if (!codigo.length) return;
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.textContent = codigo.join("\n");
    pre.appendChild(code);
    frag.appendChild(pre);
    codigo = [];
  };

  const linhas = String(md || "").replace(/\r\n/g, "\n").split("\n");
  for (const linha of linhas) {
    if (/^\s*```/.test(linha)) {
      if (emCodigo) fecharCodigo();
      else { fecharPar(); fecharLista(); }
      emCodigo = !emCodigo;
      continue;
    }
    if (emCodigo) {
      codigo.push(linha);
      continue;
    }
    if (!linha.trim()) {
      fecharPar();
      fecharLista();
      continue;
    }
    if (/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(linha)) {
      fecharPar();
      fecharLista();
      frag.appendChild(document.createElement("hr"));
      continue;
    }
    const cabecalho = linha.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (cabecalho) {
      fecharPar();
      fecharLista();
      const h = document.createElement(cabecalho[1].length <= 2 ? "h2" : "h3");
      h.textContent = cabecalho[2].trim();
      frag.appendChild(h);
      continue;
    }
    const item = linha.match(/^\s*(?:[-*+]|\d+\.)\s+(.*)$/);
    if (item) {
      fecharPar();
      if (!lista) lista = document.createElement("ul");
      const li = document.createElement("li");
      li.innerHTML = inlineMd(item[1]);
      lista.appendChild(li);
      continue;
    }
    fecharLista();
    paragrafo.push(linha.replace(/^\s*>\s?/, ""));
  }
  if (emCodigo) fecharCodigo();
  fecharPar();
  fecharLista();
  return frag;
}

async function carregarLore(id) {
  if (state.lore[id]) return state.lore[id];
  const resp = await fetch("/api/masters/" + encodeURIComponent(id) + "/lore");
  if (!resp.ok) throw new Error("Erro " + resp.status);
  const dados = await resp.json();
  state.lore[id] = dados;
  return dados;
}

function mostrarLore(dados) {
  els.loreLoading.hidden = true;
  els.loreErro.hidden = true;
  els.loreTexto.hidden = false;
  els.loreTexto.textContent = "";
  els.loreTexto.appendChild(renderMarkdown(dados.markdown || dados.texto || ""));
  if (els.loreStatus) {
    els.loreStatus.textContent = [dados.status, dados.file].filter(Boolean).join(" · ");
  }
}

// Cada clique pode trocar de Mestre a caminho: só o último pedido manda.
let lorePedido = 0;

async function abrirLore() {
  const m = activeMaster();
  if (!m || !els.lore) return;
  const pedido = ++lorePedido;

  els.loreNome.textContent = m.name;
  els.lore.classList.add("aberto");
  els.lore.setAttribute("aria-hidden", "false");
  els.name.setAttribute("aria-expanded", "true");
  els.loreErro.hidden = true;

  if (state.lore[m.id]) {
    mostrarLore(state.lore[m.id]);
    return;
  }
  els.loreTexto.hidden = true;
  els.loreLoading.hidden = false;
  try {
    const dados = await carregarLore(m.id);
    if (pedido !== lorePedido) return;
    mostrarLore(dados);
  } catch (_) {
    if (pedido !== lorePedido) return;
    els.loreLoading.hidden = true;
    els.loreErro.hidden = false;
    els.loreErro.textContent = "Não consegui abrir o arquivo da biografia.";
  }
}

function fecharLore() {
  if (!els.lore) return;
  els.lore.classList.remove("aberto");
  els.lore.setAttribute("aria-hidden", "true");
  els.name.setAttribute("aria-expanded", "false");
}

// Clicar no nome do Mestre ativo abre/fecha a biografia.
els.name.addEventListener("click", () => {
  if (els.lore.classList.contains("aberto")) fecharLore();
  else abrirLore();
});
els.name.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    els.name.click();
  }
});
els.loreFechar.addEventListener("click", () => {
  fecharLore();
  els.name.focus();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.lore.classList.contains("aberto")) fecharLore();
});

// ---------- boot ----------
async function boot() {
  carregarEstado();
  try {
    const resp = await fetch("/api/masters");
    const data = await resp.json();
    state.masters = data.masters || [];
    state.configured = !!(data.config && data.config.configured);
    state.model = (data.config && data.config.model) || "?";
    if (!state.configured) {
      els.banner.classList.remove("hidden");
    }
    renderList();
    // Mestre guardado no navegador; se já não existir, cai para o primeiro.
    const guardado = state.masters.some((m) => m.id === state.activeId);
    if (state.masters.length) {
      selectMaster(guardado ? state.activeId : state.masters[0].id);
    }
    const contador = document.querySelector(".side-count");
    if (contador) contador.textContent = state.masters.length + " desenvolvidos";
  } catch (err) {
    toast("Não consigo contactar o servidor: " + err.message);
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  send();
});
els.input.addEventListener("input", () => {
  updateSend();
  resizeInput();
});
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (!state.activeId) return;
  delete state.histories[state.activeId];
  guardarEstado();
  stopSpeaking();
  cara?.estado("espera");
  renderMessages();
  toast("Conversa reiniciada.");
  els.input.focus();
});

// Cada Mestre tem a sua própria criatividade, guardada no navegador.
if (els.temp) {
  els.temp.addEventListener("input", () => {
    if (!state.activeId) return;
    const t = Math.round(limitarTemperatura(parseFloat(els.temp.value)) * 10) / 10;
    state.temperaturas[state.activeId] = t;
    guardarEstado();
    atualizarSliderTemp();
  });
}

// Interruptor da voz: ligada/desligada.
function atualizarBotaoVoz() {
  els.vozBtn.setAttribute("aria-pressed", String(state.autoSpeak));
  els.vozTxt.textContent = state.autoSpeak ? "Voz ligada" : "Voz desligada";
  els.vozIc.textContent = state.autoSpeak ? "🔊" : "🔇";
}

els.vozBtn.addEventListener("click", () => {
  state.autoSpeak = !state.autoSpeak;
  atualizarBotaoVoz();
  if (!state.autoSpeak) stopSpeaking();
});

atualizarBotaoVoz();

boot();
