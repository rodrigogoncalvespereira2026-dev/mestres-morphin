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
  vozAuto: document.getElementById("voz-auto"),
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

// ---------- speech synthesis ----------
function speak(text, masterId) {
  if (!state.autoSpeak || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const master = state.masters.find(m => m.id === masterId);
  if (!master) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "pt-PT";
  utter.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(v => v.name === master.voice) || voices.find(v => v.lang.startsWith("pt"));
  if (match) utter.voice = match;
  window.speechSynthesis.speak(utter);
}

function stopSpeaking() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}

// Load voices
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {};
  window.speechSynthesis.getVoices();
}

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
    name.textContent = m.name;
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
    speak(data.reply, master.id);
  } catch (err) {
    removeTyping();
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
  renderMessages();
  toast("Conversa reiniciada.");
  els.input.focus();
});

if (els.vozAuto) {
  els.vozAuto.addEventListener("change", () => {
    state.autoSpeak = els.vozAuto.checked;
    if (!state.autoSpeak) stopSpeaking();
  });
}

boot();
