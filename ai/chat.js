"use strict";

const state = {
  masters: [],
  activeId: null,
  histories: {}, // masterId -> [{role, content}]
  busy: false,
  configured: false,
  speaking: false,
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
  utter.onstart = () => cara?.estado("falar");
  utter.onend = () => cara?.estado("espera");
  utter.onerror = () => cara?.estado("espera");
  synth.speak(utter);
}

function stopSpeaking() {
  if (synth) synth.cancel();
  vozPendente = null;
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
  els.meta.textContent = state.configured
    ? "Ligado · modelo " + state.model + " · " + (m.status === "canónico" ? "canónico" : "rascunho")
    : m.status === "canónico"
      ? "Cérebro canónico · prompt de sistema carregado."
      : "Rascunho — prompt ainda por validar.";
  for (const b of els.list.querySelectorAll(".master")) {
    b.classList.toggle("active", b.dataset.id === id);
  }
  renderMessages();
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
  els.input.value = "";
  resizeInput();
  renderMessages();
  state.busy = true;
  updateSend();
  cara?.estado("pensar");
  typingIndicator();

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterId: master.id, messages: hist }),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || ("Erro " + resp.status));
    }
    removeTyping();
    hist.push({ role: "assistant", content: data.reply || "" });
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

// ---------- boot ----------
async function boot() {
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
    if (state.masters.length) selectMaster(state.masters[0].id);
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
  stopSpeaking();
  cara?.estado("espera");
  renderMessages();
  toast("Conversa reiniciada.");
  els.input.focus();
});

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
