# Mestres Morphin — Power Rangers Primal Force

Este projeto contém os "cérebros" (prompts de sistema) dos **Mestres Morphin**,
seres antigos que protegem a Rede Morphin.

## Conceito

- Existem **20 Mestres Morphin** no total — um por cada cor de Ranger da série.
- Os **6 principais** estão desenvolvidos: Vermelho, Rosa, Azul,
  Verde, Preto, Dourado (ficheiros nesta pasta).
- Os restantes **14** ainda não foram criados e serão adicionados mais tarde,
  seguindo a mesma estrutura de prompt.
- Todos os Mestres partilham uma base comum: são guerreiros-monges serenos
  e sábios, foram criados pelo Roro (Ranger Vermelho), e tratam-no com
  reverência quase paternal. Cada um tem depois a sua personalidade
  individual, ligada à sua cor.

## Ficheiros

| Ficheiro | Mestre | Estado |
|---|---|---|
| `mestre-vermelho.md` | Mestre Vermelho | ✅ Canónico |
| `mestre-rosa.md` | Mestre Rosa | ✅ Canónico |
| `mestre-azul.md` | Mestre Azul | ✅ Canónico |
| `mestre-verde.md` | Mestre Verde | ✅ Canónico |
| `mestre-preto.md` | Mestre Preto | ✅ Canónico |
| `mestre-dourado.md` | Mestre Dourado | ✅ Canónico |
| `modelo-mestre.md` | (modelo para os 14 restantes) | 📋 Template |
| — os outros 14 — | Prata, Laranja, etc. | ⏳ Por criar |

## Estrutura de um prompt de Mestre

Cada ficheiro de Mestre segue a mesma estrutura (`mestre-vermelho.md` é a
referência canónica):

1. **Abertura** — quem é, a essência da sua cor e o universo
   (*Power Rangers Primal Force*).
2. **A TUA ORIGEM** — a criação pelo Roro e a relação com ele e com os
   outros Mestres.
3. **PERSONALIDADE (núcleo)** — traços ligados à sua cor, sobre a base
   comum de guerreiro-monge sereno.
4. **REGRAS DE INTERAÇÃO** — tom, comprimento das respostas, o que fazer
   com perguntas fora do universo, e regras específicas da cor.

As regras de interação base (dignidade e propósito, sem emojis, respostas
curtas a médias, reverência pelo Roro, nunca quebrar a personagem) são
comuns a todos os Mestres — o template já as inclui.

Para criar um novo Mestre, copie `modelo-mestre.md`, renomeie-o e preencha
as secções mantendo a base comum intacta.

## A IA — conversa com os Mestres

A pasta `ai/` + o ficheiro `app.py` formam uma pequena aplicação web de chat
(sem dependências — só biblioteca padrão de Python): escolhes um Mestre e
conversas com ele. O servidor lê o ficheiro `.md` do Mestre e usa-o como
*prompt de sistema* da conversa.

### Como correr

1. Copia `.env.example` para `.env.local` e preenche `OPENAI_API_KEY`.
   (Funciona com qualquer API compatível com a OpenAI: OpenAI, OpenRouter,
   Groq, Ollama local, etc. — ajusta `OPENAI_BASE_URL` e `OPENAI_MODEL`.)
2. `python app.py` → abre http://127.0.0.1:8787

Pontos: a chave vive só no `.env.local` (nunca comitado) e é lida pelo
servidor — nunca chega ao navegador. Sem chave, a interface mostra um aviso
e o `/api/chat` responde 503.
