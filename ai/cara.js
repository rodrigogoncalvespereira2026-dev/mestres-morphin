/* ==========================================================================
   cara.js — a cara animada dos personagens Primal Force
   --------------------------------------------------------------------------
   Porte independente da cara do Alpha (alfa/frontend/src/components/Face.jsx):
   a mesma mecânica de olhos-lente, pupila com sacadas, piscadas, respiração
   e barra de atividade. Cada personagem tem a sua VARIANTE (cor de identidade
   e uns extras de silhueta), por isso as caras são irmãs e não sósias.

   Uso:
     <canvas id="cara" width="300" height="280" aria-hidden="true"></canvas>
     <script src="/cara.js"></script>
     <script>
       const cara = CaraPrimal.criar(document.getElementById("cara"), {
         variante: "keeper",       // "zenowing" | "keeper" | "mestre" | "padrao"
       });
       cara.estado("pensar");      // espera | ouvir | pensar | falar
       cara.expressao("feliz", 2500);   // sobreposição temporária
       cara.humor(resposta);       // lê o texto e escolhe uma expressão
       cara.cor("#6c3ce0");        // troca a cor de identidade (Mestres)
       cara.destruir();
     </script>

   O tamanho no ecrã é do CSS: o canvas desenha-se em 300x280 lógicos e a
   densidade de píxeis do ecrã é tida em conta aqui dentro.
   ========================================================================== */
(function (global) {
  "use strict";

  var LARGURA = 300;
  var ALTURA = 280;

  /* Paleta por expressão — a mesma do Alpha, para a linguagem ser comum.
     espera/falar (e ouvir, em alguns) são substituídos pela cor de identidade
     de cada personagem. */
  var CORES = {
    espera: "#37e6e6",
    ouvir: "#00ff88",
    pensar: "#ffd700",
    falar: "#37e6e6",
    feliz: "#ff69b4",
    rir: "#ffb300",
    surpreso: "#ff6b6b",
    confuso: "#9966ff",
    triste: "#4f8cff",
    zangado: "#ff3b30",
    sono: "#8f9bb3",
    amor: "#ff2d78",
    envergonhado: "#ff9ec2",
    piscadela: "#b6ff3b",
    desconfiado: "#a3b18a",
    determinado: "#ff8a00",
  };

  /* Medidas comuns a todas as expressões. Os alvos têm de ter TODAS as
     chaves, porque a interpolação percorre as chaves do estado atual.

       abertura     altura do olho (1 = normal)
       largura      largura do olho
       boca         abertura da boca
       curva        olhos: >0 arco para cima (a sorrir), <0 descaídos
       inclinacao   olho esquerdo vs direito (assimetria do confuso)
       brilho       intensidade do néon
       cejaAltura   sobrancelhas: <0 baixas (zangado), >0 levantadas (surpreso)
       cejaInclinacao  sobrancelhas: >0 ponta interior para cima (triste),
                       <0 ponta interior para baixo (zangado)
       assimetria   levanta só uma sobrancelha
       rubor        bochechas coradas          coracao  olhos em coração
       piscadela    fecha um olho              torta    boca de esguelha
       pupila       raio da pupila             olharX/olharY  para onde olha
  */
  var BASE = {
    assimetria: 0,
    rubor: 0,
    coracao: 0,
    piscadela: 0,
    torta: 0,
    pupila: 0.56,
    olharX: 0,
    olharY: 0,
  };

  var ALVOS = {
    // ---- estados de funcionamento ----
    espera: { ...BASE, abertura: 0.62, largura: 0.94, boca: 0.30, curva: 0.12, inclinacao: 0.00, brilho: 0.85, cejaAltura: 0.10, cejaInclinacao: 0.00 },
    ouvir: { ...BASE, abertura: 0.92, largura: 1.00, boca: 0.46, curva: 0.30, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.35, cejaInclinacao: 0.10, pupila: 0.60, olharY: -0.05 },
    pensar: { ...BASE, abertura: 0.58, largura: 0.92, boca: 0.22, curva: 0.08, inclinacao: -0.09, brilho: 0.90, cejaAltura: 0.20, cejaInclinacao: 0.40, pupila: 0.52, olharX: -0.55, olharY: -0.75 },
    falar: { ...BASE, abertura: 1.00, largura: 0.96, boca: 0.90, curva: 0.50, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.18, cejaInclinacao: 0.08, olharX: 0.05, olharY: -0.10 },
    // ---- expressões ----
    feliz: { ...BASE, abertura: 0.70, largura: 1.02, boca: 0.62, curva: 1.00, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.40, cejaInclinacao: 0.12, pupila: 0.60, olharY: -0.15 },
    rir: { ...BASE, abertura: 0.24, largura: 1.04, boca: 1.30, curva: 1.50, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.50, cejaInclinacao: 0.15, pupila: 0.46 },
    amor: { ...BASE, abertura: 1.10, largura: 1.08, boca: 0.72, curva: 1.15, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.45, cejaInclinacao: 0.10, coracao: 1.00, rubor: 0.75, pupila: 0.62 },
    envergonhado: { ...BASE, abertura: 0.56, largura: 0.94, boca: 0.32, curva: 0.30, inclinacao: 0.00, brilho: 0.85, cejaAltura: 0.30, cejaInclinacao: 0.42, rubor: 1.00, torta: -0.25, pupila: 0.52, olharX: -0.45, olharY: 0.95 },
    piscadela: { ...BASE, abertura: 0.78, largura: 1.00, boca: 0.58, curva: 0.65, inclinacao: 0.00, brilho: 1.00, cejaAltura: 0.38, cejaInclinacao: 0.06, piscadela: 1.00, torta: 0.55, pupila: 0.58, olharX: 0.25, olharY: -0.10 },
    desconfiado: { ...BASE, abertura: 0.52, largura: 0.96, boca: 0.24, curva: -0.22, inclinacao: 0.00, brilho: 0.90, cejaAltura: 0.12, cejaInclinacao: -0.12, assimetria: 1.00, torta: 0.75, pupila: 0.40, olharX: 0.95, olharY: -0.15 },
    determinado: { ...BASE, abertura: 0.84, largura: 0.92, boca: 0.28, curva: 0.00, inclinacao: 0.00, brilho: 1.00, cejaAltura: -0.32, cejaInclinacao: -0.85, pupila: 0.48, olharY: -0.25 },
    surpreso: { ...BASE, abertura: 1.75, largura: 1.06, boca: 0.60, curva: 0.00, inclinacao: 0.00, brilho: 1.00, cejaAltura: 1.00, cejaInclinacao: 0.05, pupila: 0.74 },
    confuso: { ...BASE, abertura: 0.74, largura: 0.98, boca: 0.30, curva: -0.20, inclinacao: 0.16, brilho: 0.90, cejaAltura: 0.45, cejaInclinacao: -0.30, pupila: 0.56, olharX: -0.70, olharY: -0.30 },
    triste: { ...BASE, abertura: 0.50, largura: 0.92, boca: 0.26, curva: -0.55, inclinacao: 0.00, brilho: 0.72, cejaAltura: 0.25, cejaInclinacao: 0.95, pupila: 0.52, olharX: -0.20, olharY: 0.95 },
    zangado: { ...BASE, abertura: 0.44, largura: 0.90, boca: 0.18, curva: -0.35, inclinacao: 0.00, brilho: 0.95, cejaAltura: -0.60, cejaInclinacao: -1.00, pupila: 0.40, olharY: 0.10 },
    sono: { ...BASE, abertura: 0.28, largura: 0.95, boca: 0.44, curva: -0.10, inclinacao: 0.00, brilho: 0.65, cejaAltura: 0.05, cejaInclinacao: 0.20, pupila: 0.50, olharX: 0.10, olharY: 0.85 },
  };

  /* As expressões que se podem sobrepor a um estado — as do painel de reações.
     A ordem é a que aparece na grelha. */
  var EXPRESSOES = [
    "feliz",
    "rir",
    "amor",
    "envergonhado",
    "piscadela",
    "desconfiado",
    "determinado",
    "surpreso",
    "confuso",
    "triste",
    "zangado",
    "sono",
  ];

  /* ------------------------------------------------------------------------
     Utilidades de cor e de forma
     ------------------------------------------------------------------------ */

  function hexParaRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbParaHex(c) {
    return (
      "#" +
      c
        .map(function (v) {
          return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");
        })
        .join("")
    );
  }

  function misturar(a, b, f) {
    return a + (b - a) * f;
  }

  function comAlfa(cor, alfa) {
    var p = hexParaRgb(cor);
    return "rgba(" + Math.round(p[0]) + "," + Math.round(p[1]) + "," + Math.round(p[2]) + "," + alfa + ")";
  }

  /** Retângulo arredondado (com recurso manual para browsers antigos). */
  function retanguloArredondado(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Olho e boca em forma de lente: duas curvas quadráticas que se abrem com a
   * altura e se dobram com a `curva` — positiva arco para cima, negativa para
   * baixo. `torcao` desnivela os cantos e dá a boca de esguelha.
   */
  function desenharLente(ctx, cx, cy, largura, altura, curva, torcao) {
    var meia = largura / 2;
    var dobra = curva * 20;
    var desnivel = (torcao || 0) * 14;
    ctx.beginPath();
    ctx.moveTo(cx - meia, cy + desnivel);
    ctx.quadraticCurveTo(cx, cy - altura - dobra, cx + meia, cy - desnivel);
    ctx.quadraticCurveTo(cx, cy + altura - dobra, cx - meia, cy + desnivel);
    ctx.closePath();
  }

  /** Coração, para os olhos da expressão "amor". Desenhado em volta da origem. */
  function desenharCoracao(ctx, tamanho) {
    var s = tamanho / 16;
    ctx.beginPath();
    ctx.moveTo(0, 8 * s);
    ctx.bezierCurveTo(-14 * s, -2 * s, -8 * s, -14 * s, 0, -6 * s);
    ctx.bezierCurveTo(8 * s, -14 * s, 14 * s, -2 * s, 0, 8 * s);
    ctx.closePath();
  }

  /** Sobrancelha: traço arredondado. `ladoInterno` diz onde fica a ponta de dentro. */
  function desenharSobrancelha(ctx, yBase, meiaLargura, inclinacao, ladoInterno, cor, forca) {
    var subida = inclinacao * 9;
    var internoNaEsquerda = ladoInterno < 0;
    var yInt = yBase - subida;
    var yExt = yBase + subida;
    var yEsq = internoNaEsquerda ? yInt : yExt;
    var yDir = internoNaEsquerda ? yExt : yInt;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-meiaLargura, yEsq);
    ctx.quadraticCurveTo(0, (yEsq + yDir) / 2 - 3, meiaLargura, yDir);
    ctx.strokeStyle = comAlfa(cor, Math.max(0.18, Math.min(1, forca)));
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowColor = comAlfa(cor, 0.8);
    ctx.shadowBlur = 10 * forca;
    ctx.stroke();
    ctx.restore();
  }

  /** Losango (pedra do visor dos Mestres, gema da coroa do Keeper). */
  function desenharLosango(ctx, cx, cy, raio) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - raio);
    ctx.lineTo(cx + raio * 0.72, cy);
    ctx.lineTo(cx, cy + raio);
    ctx.lineTo(cx - raio * 0.72, cy);
    ctx.closePath();
  }

  /* ------------------------------------------------------------------------
     Variantes — a identidade de cada personagem
     ------------------------------------------------------------------------
     atras   desenhado ANTES da cabeça (fica por trás dela)
     frente  desenhado DEPOIS da cabeça e do vidro (vem para a frente)
     cores   substituições na paleta (espera/falar = cor de identidade)
     cor     cor de identidade por omissão

     Os dois recebem (ctx, cor, t, atual, corIdentidade): `cor` é a cor do
     momento (muda com a expressão) e `corIdentidade` é a do personagem, que
     não muda — é a que devem usar no que é dele (coroa, visor, pedra).
     ------------------------------------------------------------------------ */

  var VARIANTES = {
    /* Sem extras: a cara do Alpha, base de todas. */
    padrao: {},

    /* Zenowing — Ranger Prateado, crista de Titanossauro e "ouvidos" de elmo. */
    zenowing: {
      cor: "#6fe3ea",
      atras: function (ctx, cor, t, atual) {
        // Barbatanas laterais do elmo, a espreitar por trás da cabeça.
        ctx.save();
        ctx.shadowColor = comAlfa("#e8eef5", 0.7);
        ctx.shadowBlur = 14 * atual.brilho;
        ctx.fillStyle = "rgba(232,238,245,0.85)";
        for (var lado = 0; lado < 2; lado++) {
          var sinal = lado === 0 ? 1 : -1;
          var x = lado === 0 ? 26 : 274;
          ctx.beginPath();
          ctx.moveTo(x, 92);
          ctx.lineTo(x - 16 * sinal, 110);
          ctx.lineTo(x, 130);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },
      frente: function (ctx, cor, t, atual) {
        // Crista dorsal (Titanossauro): nasce entre as sobrancelhas e passa
        // acima do contorno da cabeça, como uma barbatana de elmo.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(150, 4);
        ctx.quadraticCurveTo(158, 30, 166, 50);
        ctx.lineTo(158, 78);
        ctx.lineTo(142, 78);
        ctx.lineTo(134, 50);
        ctx.quadraticCurveTo(142, 30, 150, 4);
        ctx.closePath();
        var grad = ctx.createLinearGradient(0, 4, 0, 78);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.45, "#e8eef5");
        grad.addColorStop(1, "rgba(232,238,245,0.30)");
        ctx.fillStyle = grad;
        ctx.shadowColor = comAlfa("#cfe3f5", 0.75);
        ctx.shadowBlur = 14 * atual.brilho;
        ctx.fill();
        ctx.restore();
      },
    },

    /* Keeper — Guardião da Coroa: diadema dourada e cantos de escudo. */
    keeper: {
      cor: "#e6b84c",
      cores: { pensar: "#a06cff" },
      frente: function (ctx, cor, t, atual, corId) {
        var ouro = corId;
        var brilho = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.6)) * atual.brilho;

        // Diadema: faixa em arco com cinco pontas e a gema ao centro.
        ctx.save();
        ctx.shadowColor = comAlfa(ouro, 0.85);
        ctx.shadowBlur = 16 * brilho;
        ctx.beginPath();
        ctx.moveTo(78, 60);
        ctx.quadraticCurveTo(150, 40, 222, 60);
        ctx.lineTo(222, 66);
        ctx.quadraticCurveTo(150, 47, 78, 66);
        ctx.closePath();
        ctx.fillStyle = comAlfa(ouro, 0.9);
        ctx.fill();

        var pontos = [90, 120, 150, 180, 210];
        for (var p = 0; p < pontos.length; p++) {
          var x = pontos[p];
          var alto = x === 150 ? 22 : 12;
          var base = x === 150 ? 52 : 58;
          ctx.beginPath();
          ctx.moveTo(x - 11, base);
          ctx.lineTo(x, base - alto);
          ctx.lineTo(x + 11, base);
          ctx.closePath();
          ctx.fillStyle = comAlfa(ouro, 0.95);
          ctx.fill();
        }

        // Gema central, a pulsar devagar.
        desenharLosango(ctx, 150, 54, 7 + 1.2 * Math.sin(t * 1.6));
        ctx.fillStyle = "#fff6dc";
        ctx.fill();
        ctx.restore();
      },
    },

    /* Mestre Morphin — visor em V e a pedra do Mestre (cor própria). */
    mestre: {
      cor: "#e6b84c",
      // A cor do Mestre (corId) fica no visor e na pedra: é o que distingue os
      // seis, tanto na cara grande como nas miniaturas do painel de reações.
      frente: function (ctx, cor, t, atual, corId) {
        ctx.save();
        // Faixa do visor, em V, na cor do Mestre.
        ctx.beginPath();
        ctx.moveTo(32, 68);
        ctx.quadraticCurveTo(150, 44, 268, 68);
        ctx.strokeStyle = comAlfa(corId, 0.5);
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.shadowColor = comAlfa(corId, 0.7);
        ctx.shadowBlur = 12 * atual.brilho;
        ctx.stroke();

        // Templos: dois encaixes no fim da faixa.
        for (var lado = 0; lado < 2; lado++) {
          var x = lado === 0 ? 34 : 266;
          ctx.beginPath();
          ctx.arc(x, 68, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = comAlfa(corId, 0.75);
          ctx.fill();
        }

        // Pedra do Mestre, na ponta do V.
        desenharLosango(ctx, 150, 52, 9 + 1.4 * Math.sin(t * 1.9));
        ctx.fillStyle = comAlfa(corId, 0.95);
        ctx.fill();
        desenharLosango(ctx, 150, 52, 4);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fill();
        ctx.restore();
      },
    },
  };

  /* ------------------------------------------------------------------------
     Humor: lê a resposta e escolhe uma expressão breve. É leve de propósito —
     não é análise de sentimentos, é só vida na cara.
     ------------------------------------------------------------------------ */
  var PISTAS = [
    [/(!{2,}|😄|😊|🎉|\b(parabéns|parabens|excelente|ótimo|otimo|que bom|bem-vindo|bem vindo|feliz)\b)/i, "feliz"],
    [/(\?!|😮|\b(impossível|impossivel|incrível|incrivel|inacreditável)\b)/i, "surpreso"],
    [/(\b(cuidado|perigo|ameaça|ameaca|nunca|proibido|alerta)\b)/i, "determinado"],
    [/(\b(desculpa|lamento|infelizmente|triste|pena)\b|😔)/i, "triste"],
    [/\?\s*$/, "confuso"],
  ];

  function humorDe(texto) {
    var limpo = String(texto || "").trim();
    if (!limpo) return null;
    for (var i = 0; i < PISTAS.length; i++) {
      if (PISTAS[i][0].test(limpo)) return PISTAS[i][1];
    }
    return null;
  }

  /* ------------------------------------------------------------------------
     A cara
     ------------------------------------------------------------------------ */

  function criar(canvas, opcoes) {
    opcoes = opcoes || {};
    var nomeVariante = VARIANTES[opcoes.variante] ? opcoes.variante : "padrao";
    var variante = VARIANTES[nomeVariante];
    var ctx = canvas.getContext("2d");

    var cores = Object.assign({}, CORES, variante.cores || {});
    var corIdentidade = opcoes.cor || variante.cor || cores.espera;

    /** A cor de identidade toma conta de "espera" e "falar" (e "ouvir"). */
    function aplicarCor(hex) {
      if (!hex) return;
      corIdentidade = hex;
      cores = Object.assign({}, cores);
      cores.espera = hex;
      cores.falar = hex;
    }
    aplicarCor(corIdentidade);

    // As miniaturas do painel de reações (12 de uma vez) levam densidade 1,
    // que a 70 px de largura não se nota e poupa muita memória de canvas.
    var escala = opcoes.densidade || Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    var modoEstatico = opcoes.estatico || null;
    canvas.width = LARGURA * escala;
    canvas.height = ALTURA * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);

    var reduzirMovimento =
      window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var estadoAtual = "espera";
    canvas.dataset.estado = estadoAtual;
    var expressaoAtual = null;
    var temporizadorExpressao = 0;

    var atual = Object.assign({}, BASE, {
      abertura: 0.62,
      largura: 0.94,
      boca: 0.3,
      curva: 0.12,
      inclinacao: 0,
      brilho: 0.85,
      cejaAltura: 0.1,
      cejaInclinacao: 0,
    });
    var corAtual = hexParaRgb(cores.espera);

    var raf = 0;
    var t = 0;
    var ultimo = performance.now();
    var proximoPiscar = 2.2;
    var piscarRestante = 0;
    var piscar = 1;
    var proximaPiscadela = 1;
    var piscadelaRestante = 0;
    // Quanto o olhar vagueia: 1 quando nada se passa, 0 quando há tarefa.
    var vagar = 0;
    var olharDerivaX = 0;
    var olharDerivaY = 0;
    var olharAlvoX = 0;
    var olharAlvoY = 0;
    var proximaSacada = 1.2;
    var parado = false;

    function desenhar() {
      var agora = performance.now();
      var dt = Math.min((agora - ultimo) / 1000, 0.05);
      ultimo = agora;
      t += dt;

      // ---------- alvo: estado de base, com a expressão por cima ----------
      var base = ALVOS[estadoAtual] || ALVOS.espera;
      var alvo = expressaoAtual && ALVOS[expressaoAtual] ? Object.assign({}, base, ALVOS[expressaoAtual]) : base;
      var nomeCor = CORES[expressaoAtual] ? expressaoAtual : estadoAtual;
      var corAlvo = hexParaRgb(cores[nomeCor] || cores.espera);

      var suavidade = 1 - Math.pow(0.0016, dt); // ~independente dos fotogramas
      for (var chave in atual) {
        if (Object.prototype.hasOwnProperty.call(atual, chave)) {
          atual[chave] = misturar(atual[chave], alvo[chave] !== undefined ? alvo[chave] : atual[chave], suavidade);
        }
      }
      if (reduzirMovimento) {
        corAtual = corAlvo.slice();
      } else {
        corAtual = [
          misturar(corAtual[0], corAlvo[0], suavidade),
          misturar(corAtual[1], corAlvo[1], suavidade),
          misturar(corAtual[2], corAlvo[2], suavidade),
        ];
      }
      var cor = rgbParaHex(corAtual);

      // ---------- piscar ----------
      if (piscarRestante > 0) {
        piscarRestante = Math.max(0, piscarRestante - dt);
        var p = 1 - Math.abs(1 - piscarRestante / 0.16); // 0 -> 1 -> 0
        piscar = 1 - p * 0.93;
      } else {
        piscar = 1;
        proximoPiscar -= dt;
        if (proximoPiscar <= 0) {
          piscarRestante = 0.32;
          proximoPiscar = 2.6 + Math.random() * 3.4;
        }
      }

      // ---------- piscadela (fecha um olho, volta e meia) ----------
      var fecharOlho = -1;
      var forcaPiscadela = 0;
      if (atual.piscadela > 0.5) {
        if (piscadelaRestante > 0) {
          piscadelaRestante = Math.max(0, piscadelaRestante - dt);
          forcaPiscadela = 1 - Math.abs(1 - piscadelaRestante / 0.18); // 0 -> 1 -> 0
          fecharOlho = atual.piscadela > 0 ? 0 : 1;
        } else {
          proximaPiscadela -= dt;
          if (proximaPiscadela <= 0) {
            piscadelaRestante = 0.36;
            proximaPiscadela = 1.9;
          }
        }
      } else {
        proximaPiscadela = 0.5;
      }

      // ---------- olhar: sacadas pequenas quando está parado ----------
      parado = (estadoAtual === "espera" || estadoAtual === "ouvir") && !expressaoAtual;
      vagar = misturar(vagar, parado ? 1 : 0, suavidade);

      if (parado) {
        proximaSacada -= dt;
        if (proximaSacada <= 0) {
          var angulo = Math.random() * Math.PI * 2;
          var distancia = 0.45 + Math.random() * 0.35;
          olharAlvoX = Math.cos(angulo) * distancia;
          olharAlvoY = Math.sin(angulo) * distancia * 0.75;
          proximaSacada = 2.0 + Math.random() * 2.8;
        }
      } else {
        olharAlvoX = 0;
        olharAlvoY = 0;
        proximaSacada = 0.9;
      }

      var rapidezSacada = 1 - Math.pow(0.00002, dt);
      olharDerivaX = misturar(olharDerivaX, olharAlvoX, rapidezSacada);
      olharDerivaY = misturar(olharDerivaY, olharAlvoY, rapidezSacada);

      var derivaX = olharDerivaX * vagar + (reduzirMovimento ? 0 : Math.sin(t * 3.1) * 0.03);
      var derivaY = olharDerivaY * vagar + (reduzirMovimento ? 0 : Math.cos(t * 2.7) * 0.02);

      // ---------- vida: respiração e ritmos ----------
      var respiracao = reduzirMovimento ? 1 : 1 + Math.sin(t * 0.9) * 0.007 * atual.brilho;
      var ondaFalar = 0.5 + 0.5 * Math.sin(t * 11) * Math.sin(t * 6.3);
      var ondaPensar = 0.5 + 0.5 * Math.sin(t * 2.4);
      var oscilar = function (freq, amp) {
        return Math.sin(t * freq) * amp;
      };

      ctx.clearRect(0, 0, LARGURA, ALTURA);

      // ---------- aura por trás da cabeça ----------
      var aura = ctx.createRadialGradient(150, 132, 20, 150, 132, 168);
      aura.addColorStop(0, comAlfa(cor, 0.16 * atual.brilho));
      aura.addColorStop(1, comAlfa(cor, 0));
      ctx.fillStyle = aura;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      ctx.save();
      ctx.translate(150, 132);
      ctx.scale(respiracao, respiracao);
      ctx.translate(-150, -132);

      // ---------- extras por trás da cabeça (barbatanas do Zenowing) ----------
      if (variante.atras) variante.atras(ctx, cor, t, atual, corIdentidade);

      // ---------- cabeça ----------
      ctx.save();
      ctx.shadowColor = comAlfa(cor, 0.75);
      ctx.shadowBlur = 22 * atual.brilho;
      ctx.beginPath();
      retanguloArredondado(ctx, 26, 16, 248, 230, 48);
      var preenchimento = ctx.createLinearGradient(0, 16, 0, 246);
      preenchimento.addColorStop(0, "#1c2430");
      preenchimento.addColorStop(0.55, "#121821");
      preenchimento.addColorStop(1, "#0a0e14");
      ctx.fillStyle = preenchimento;
      ctx.fill();
      ctx.restore();

      // brilho interior no topo (dá volume ao vidro)
      ctx.save();
      ctx.beginPath();
      retanguloArredondado(ctx, 26, 16, 248, 230, 48);
      ctx.clip();
      var luzTopo = ctx.createLinearGradient(0, 16, 0, 120);
      luzTopo.addColorStop(0, "rgba(255,255,255,0.075)");
      luzTopo.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = luzTopo;
      ctx.fillRect(26, 16, 248, 120);
      ctx.restore();

      // contorno néon
      ctx.save();
      ctx.strokeStyle = cor;
      ctx.lineWidth = 2;
      ctx.shadowColor = comAlfa(cor, 0.9);
      ctx.shadowBlur = 16 * atual.brilho;
      ctx.beginPath();
      retanguloArredondado(ctx, 26, 16, 248, 230, 48);
      ctx.stroke();
      ctx.restore();

      // ---------- extras à frente da cabeça (coroa, visor, crista) ----------
      if (variante.frente) variante.frente(ctx, cor, t, atual, corIdentidade);

      // ---------- olhos (com sobrancelhas) ----------
      var alturaOlhoBase = 21;
      var larguraOlhoBase = 60;
      var forcaCeja = Math.min(
        1,
        0.3 +
          Math.abs(atual.cejaAltura) * 0.6 +
          Math.abs(atual.cejaInclinacao) * 0.7 +
          Math.abs(atual.assimetria) * 0.4
      );

      var olhos = [
        { cx: 104, cy: 112, lado: 1 },
        { cx: 196, cy: 112, lado: -1 },
      ];

      for (var i = 0; i < olhos.length; i++) {
        var olho = olhos[i];
        // No estado confuso um olho fica menor e mais baixo que o outro.
        var desvio = atual.inclinacao * olho.lado;
        var cx = olho.cx + desvio * 26;
        var cy = olho.cy + desvio * 34;
        var escalaOlho = 1 - desvio * 0.55;

        var fechado = fecharOlho === i ? forcaPiscadela : 0;
        var alturaOlho = alturaOlhoBase * atual.abertura * escalaOlho * piscar * (1 - fechado * 0.92);
        var larguraOlho = larguraOlhoBase * atual.largura;
        var cejaAltura = atual.cejaAltura + (i === 0 ? atual.assimetria : -atual.assimetria) * 0.6;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(desvio * 0.5);

        // sobrancelha
        var yCeja = -Math.max(alturaOlho, 3) - 20 - cejaAltura * 11;
        desenharSobrancelha(ctx, yCeja, (larguraOlho * escalaOlho) / 2, atual.cejaInclinacao, olho.lado, cor, forcaCeja);

        // recorte escuro do olho (a "cavidade")
        desenharLente(ctx, 0, 0, larguraOlho + 12, alturaOlho + 9, atual.curva);
        ctx.fillStyle = "rgba(6,9,13,0.95)";
        ctx.fill();

        // parte luminosa — a lente dá lugar a um coração na expressão "amor"
        ctx.save();
        ctx.shadowColor = comAlfa(cor, 0.95);
        ctx.shadowBlur = 18 * atual.brilho;
        var gradienteOlho = ctx.createLinearGradient(0, -alturaOlho, 0, alturaOlho);
        gradienteOlho.addColorStop(0, "#ffffff");
        gradienteOlho.addColorStop(0.35, cor);
        gradienteOlho.addColorStop(1, cor);
        ctx.fillStyle = gradienteOlho;

        if (atual.coracao < 0.98) {
          ctx.globalAlpha = 1 - atual.coracao;
          desenharLente(ctx, 0, 0, larguraOlho * escalaOlho, alturaOlho, atual.curva);
          ctx.fill();
        }
        if (atual.coracao > 0.02) {
          ctx.globalAlpha = atual.coracao;
          desenharCoracao(ctx, larguraOlho * escalaOlho * 0.6 * (1 - fechado * 0.9));
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.restore();

        // pupila — dá direção ao olhar e torna as reações legíveis
        var olhoVisivel = Math.max(0, Math.min(1, alturaOlho / 7));
        if (atual.coracao < 0.98 && olhoVisivel > 0.05) {
          var dobraOlho = atual.curva * 20;
          var meiaCima = Math.max(3, (alturaOlho + dobraOlho) / 2);
          var meiaBaixo = Math.max(3, (alturaOlho - dobraOlho) / 2);
          var meiaLente = (meiaCima + meiaBaixo) / 2;
          var raio = Math.min(meiaLente * 1.3 * atual.pupila, (larguraOlho * escalaOlho) / 2 - 4);
          var espacoX = Math.max(0, (larguraOlho * escalaOlho) / 2 - raio - 3);
          var espacoY = Math.max(0, meiaLente - raio);
          var centroPupilaY = -(meiaCima - meiaBaixo) / 2;
          ctx.save();
          ctx.globalAlpha = (1 - atual.coracao) * olhoVisivel;
          ctx.beginPath();
          ctx.ellipse(
            (atual.olharX + derivaX) * espacoX,
            centroPupilaY + (atual.olharY + derivaY) * espacoY,
            raio,
            raio,
            0,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "rgba(4,7,11,0.96)";
          ctx.fill();
          ctx.restore();
        }

        // reflexo superior (efeito de vidro)
        if (alturaOlho > 5 && atual.coracao < 0.6) {
          ctx.globalAlpha = 0.55 * atual.brilho * (1 - atual.coracao) * (1 - fechado);
          ctx.beginPath();
          ctx.ellipse(
            -larguraOlho * 0.18,
            -alturaOlho * 0.34,
            larguraOlho * 0.16 * escalaOlho,
            Math.max(1.4, alturaOlho * 0.17),
            0,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.restore();
      }

      // ---------- rubor (bochechas coradas) ----------
      if (atual.rubor > 0.02) {
        var bochechas = [76, 224];
        for (var bi = 0; bi < bochechas.length; bi++) {
          var bx = bochechas[bi];
          var bochecha = ctx.createRadialGradient(bx, 152, 2, bx, 152, 36);
          bochecha.addColorStop(0, comAlfa("#ff5c8a", 0.45 * atual.rubor));
          bochecha.addColorStop(1, comAlfa("#ff5c8a", 0));
          ctx.fillStyle = bochecha;
          ctx.beginPath();
          ctx.ellipse(bx, 152, 36, 23, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ---------- boca ----------
      var larguraBoca = 116;
      var alturaBocaBase = 15;
      var boca = alvo.boca;
      // Na boca a curvatura é ao contrário da dos olhos.
      var curvaBoca = -alvo.curva * 0.85;

      if (estadoAtual === "falar") {
        boca = 0.35 + ondaFalar * 0.95;
      } else if (estadoAtual === "pensar") {
        boca = 0.16 + ondaPensar * 0.14;
        curvaBoca = -(0.05 + oscilar(2.4, 0.12));
      } else if (estadoAtual === "ouvir" && !expressaoAtual) {
        boca = alvo.boca + oscilar(3.2, 0.05);
      }

      var alturaBoca = alturaBocaBase * boca;
      var torcao = atual.torta;

      ctx.save();
      ctx.translate(150, 192);

      desenharLente(ctx, 0, 0, larguraBoca + 10, alturaBoca + 7, curvaBoca, torcao);
      ctx.fillStyle = "rgba(6,9,13,0.95)";
      ctx.fill();

      ctx.save();
      ctx.shadowColor = comAlfa(cor, 0.9);
      ctx.shadowBlur = 16 * atual.brilho;
      desenharLente(ctx, 0, 0, larguraBoca, alturaBoca, curvaBoca, torcao);
      var gradienteBoca = ctx.createLinearGradient(0, -alturaBoca, 0, alturaBoca);
      gradienteBoca.addColorStop(0, cor);
      gradienteBoca.addColorStop(0.5, "#ffffff");
      gradienteBoca.addColorStop(1, cor);
      ctx.fillStyle = gradienteBoca;
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.restore();
      ctx.restore();

      // ---------- luzes laterais ----------
      for (var lado = 0; lado < 2; lado++) {
        var lx = lado === 0 ? 14 : 286;
        var pulso = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 3 + lado * 1.5)) * atual.brilho;
        ctx.save();
        ctx.beginPath();
        retanguloArredondado(ctx, lx - 5, 108, 10, 30, 5);
        ctx.fillStyle = "rgba(6,9,13,0.95)";
        ctx.fill();
        ctx.shadowColor = comAlfa(cor, 0.95);
        ctx.shadowBlur = 14 * pulso;
        ctx.fillStyle = comAlfa(cor, 0.35 + pulso * 0.65);
        ctx.fill();
        ctx.restore();
      }

      // ---------- barra de atividade ----------
      var nivel = estadoAtual === "espera" ? 0.34 + oscilar(1.1, 0.04) : 0.34 + 0.62 * (0.5 + 0.5 * Math.sin(t * 2.6));
      var nivelFinal = Math.max(0.08, Math.min(1, nivel));

      ctx.save();
      ctx.beginPath();
      retanguloArredondado(ctx, 72, 222, 156, 9, 5);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      retanguloArredondado(ctx, 72, 222, 156 * nivelFinal, 9, 5);
      var gradienteBarra = ctx.createLinearGradient(72, 0, 72 + 156 * nivelFinal, 0);
      gradienteBarra.addColorStop(0, comAlfa(cor, 0.55));
      gradienteBarra.addColorStop(1, cor);
      ctx.fillStyle = gradienteBarra;
      ctx.shadowColor = comAlfa(cor, 0.9);
      ctx.shadowBlur = 12 * atual.brilho;
      ctx.fill();
      ctx.restore();

      ctx.restore(); // fim da respiração

      if (!modoEstatico) raf = requestAnimationFrame(desenhar);
    }

    /** Num fotograma só (miniaturas): salta logo para os valores finais. */
    function instantaneo() {
      var base = ALVOS[estadoAtual] || ALVOS.espera;
      var alvo = expressaoAtual && ALVOS[expressaoAtual] ? Object.assign({}, base, ALVOS[expressaoAtual]) : base;
      Object.assign(atual, alvo);
      corAtual = hexParaRgb(cores[expressaoAtual] || cores[estadoAtual] || cores.espera);
      desenhar();
    }

    function arrancar() {
      if (raf) return;
      ultimo = performance.now();
      raf = requestAnimationFrame(desenhar);
    }

    function parar() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    // Não gasta bateria com o separador escondido.
    function aoMudarVisibilidade() {
      if (document.hidden) parar();
      else arrancar();
    }
    if (modoEstatico) {
      // Uma cara parada, já com a expressão pedida: é isto que enche a grelha
      // do painel de reações (12 caras a animar ao mesmo tempo seria demais).
      var ehExpressao = EXPRESSOES.indexOf(modoEstatico) >= 0;
      estadoAtual = ehExpressao ? "espera" : modoEstatico;
      expressaoAtual = ehExpressao ? modoEstatico : null;
      canvas.dataset.estado = estadoAtual;
      if (expressaoAtual) canvas.dataset.expressao = expressaoAtual;
      instantaneo();
    } else {
      document.addEventListener("visibilitychange", aoMudarVisibilidade);
      arrancar();
    }

    return {
      estado: function (nome) {
        if (!ALVOS[nome]) return;
        estadoAtual = nome;
        // Espelho do estado no próprio canvas: dá para inspecionar num teste
        // (cara.dataset.estado) sem mexer no desenho.
        canvas.dataset.estado = nome;
        if (modoEstatico) instantaneo();
      },
      expressao: function (nome, ms) {
        if (!ALVOS[nome]) return;
        expressaoAtual = nome;
        canvas.dataset.expressao = nome;
        if (modoEstatico) {
          instantaneo();
          return;
        }
        clearTimeout(temporizadorExpressao);
        temporizadorExpressao = setTimeout(function () {
          expressaoAtual = null;
          delete canvas.dataset.expressao;
        }, ms || 2200);
      },
      /** Lê o texto e escolhe uma expressão breve (silencioso se não houver pista). */
      humor: function (texto, ms) {
        var e = humorDe(texto);
        if (e) this.expressao(e, ms || 2600);
      },
      /** Troca a cor de identidade (usado pelos Mestres ao mudar de Mestre). */
      cor: function (hex) {
        aplicarCor(hex);
      },
      destruir: function () {
        parar();
        clearTimeout(temporizadorExpressao);
        document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      },
    };
  }

  global.CaraPrimal = {
    criar: criar,
    variantes: Object.keys(VARIANTES),
    expressoes: EXPRESSOES.slice(),
    humorDe: humorDe,
  };
})(window);
