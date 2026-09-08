#!/usr/bin/env python3
"""Build a self-contained preview.html rendering every .md "brain" file.

Usage:  python tools/build_preview.py
Output: preview.html  (regenerated from the Markdown sources each run)
"""
from __future__ import annotations

import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "preview.html"

# Order + accents for the tab bar. Filename -> (label, accent colour)
PAGES = [
    ("README.md", "Visão Geral", "#e6b84c"),
    ("mestre-vermelho.md", "Mestre Vermelho", "#e0463b"),
    ("mestre-rosa.md", "Mestre Rosa", "#ef7fb0"),
    ("mestre-azul.md", "Mestre Azul", "#4f86d6"),
    ("mestre-verde.md", "Mestre Verde", "#58a85e"),
    ("mestre-preto.md", "Mestre Preto", "#9aa0a8"),
    ("mestre-dourado.md", "Mestre Dourado", "#f0c94f"),
    ("modelo-mestre.md", "Modelo — Mestre [COR]", "#b9c0c8"),
]

_ESCAPE = re.compile(r"[&<>\"']")
_ESCAPE_MAP = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
}


def esc(text: str) -> str:
    return _ESCAPE.sub(lambda m: _ESCAPE_MAP[m.group(0)], text)


def inline(text: str) -> str:
    """Escape, then apply `code`, **bold** and *italic*."""
    text = esc(text)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", text)
    return text


def render_table(rows: list[list[str]]) -> str:
    header = rows[0]
    body = rows[1:]
    thead = "".join(f"<th>{inline(c)}</th>" for c in header)
    tbody = "".join(
        "<tr>" + "".join(f"<td>{inline(c)}</td>" for c in row) + "</tr>"
        for row in body
    )
    return (
        '<div class="table-wrap"><table>'
        f"<thead><tr>{thead}</tr></thead>"
        f"<tbody>{tbody}</tbody></table></div>"
    )


def is_separator(row: list[str]) -> bool:
    return all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in row)


def render_blocks(text: str) -> str:
    lines = text.splitlines()
    out: list[str] = []
    i = 0
    n = len(lines)

    def flush_block(lines_in: list[str]) -> None:
        if not lines_in:
            return
        first = lines_in[0]
        # Heading
        m = re.match(r"^(#{1,4})\s+(.*)$", first)
        if m:
            level = min(len(m.group(1)) + 1, 6)  # h1 -> h2 inside section
            out.append(f"<h{level}>{inline(m.group(2))}</h{level}>")
            return
        # Blockquote
        if all(ln.startswith(">") for ln in lines_in if ln.strip()):
            quote = " ".join(ln[1:].strip() for ln in lines_in if ln.strip())
            out.append(f"<blockquote>{inline(quote)}</blockquote>")
            return
        # Table
        if first.lstrip().startswith("|"):
            rows: list[list[str]] = []
            for ln in lines_in:
                ln = ln.strip()
                if not ln.startswith("|"):
                    continue
                cells = [c.strip() for c in ln.strip("|").split("|")]
                if is_separator(cells):
                    continue
                rows.append(cells)
            if rows:
                out.append(render_table(rows))
            return
        # Horizontal rule
        if re.fullmatch(r"-{3,}|\*{3,}|_{3,}", first.strip()):
            out.append("<hr>")
            return
        # Bullet / ordered list
        if re.match(r"^\s*(?:[-*]|\d+\.)\s+", first):
            list_tag = "ol" if re.match(r"^\s*\d+\.\s+", first) else "ul"
            items: list[str] = []
            for ln in lines_in:
                m = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.*)$", ln)
                if m:
                    items.append(m.group(1).strip())
                elif ln.strip() and items:
                    items[-1] += " " + ln.strip()
            lis = "".join(f"<li>{inline(it)}</li>" for it in items)
            out.append(f"<{list_tag}>{lis}</{list_tag}>")
            return
        # Plain paragraph
        para = " ".join(ln.strip() for ln in lines_in if ln.strip())
        out.append(f"<p>{inline(para)}</p>")

    block: list[str] = []
    for ln in lines:
        if ln.strip():
            block.append(ln)
        else:
            flush_block(block)
            block = []
    flush_block(block)
    return "\n".join(out)


def first_heading(text: str) -> str | None:
    for ln in text.splitlines():
        m = re.match(r"^#\s+(.*)$", ln)
        if m:
            return inline(m.group(1)).strip()
    return None


def main() -> int:
    sections: list[tuple[str, str, str]] = []  # (id, title, html)
    for filename, label, _accent in PAGES:
        source = (ROOT / filename).read_text(encoding="utf-8")
        title = first_heading(source) or label
        html_body = render_blocks(source)
        sections.append((filename.replace(".md", ""), title, html_body))

    tabs_html = "\n".join(
        '<button class="tab%s" data-id="%s" style="--accent:%s">%s</button>'
        % (
            " active" if idx == 0 else "",
            fid,
            accent,
            esc(label),
        )
        for idx, ((fid, _t, _b), (_f, label, accent)) in enumerate(
            zip(sections, PAGES)
        )
    )

    pages_html = "\n".join(
        '<section class="page%s" id="page-%s"><div class="inner">%s</div></section>'
        % (" active" if idx == 0 else "", fid, body)
        for idx, (fid, _t, body) in enumerate(sections)
    )

    doc = f"""<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mestres Morphin — Power Rangers Primal Force</title>
<style>
  :root {{
    --bg: #0e1020;
    --bg2: #141731;
    --panel: #1a1e3c;
    --ink: #eef0f7;
    --muted: #9aa1bd;
    --line: #2a2f55;
    --gold: #e6b84c;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    background:
      radial-gradient(1200px 500px at 80% -10%, rgba(230,184,76,.08), transparent 60%),
      radial-gradient(900px 600px at -10% 110%, rgba(93,63,211,.14), transparent 60%),
      var(--bg);
    color: var(--ink);
    font-family: Georgia, "Times New Roman", serif;
    line-height: 1.65;
  }}
  header.hero {{
    border-bottom: 1px solid var(--line);
    background: linear-gradient(180deg, rgba(20,23,49,.9), rgba(14,16,32,.4));
    padding: 34px 44px 20px;
  }}
  header.hero .kicker {{
    font-family: "Segoe UI", Arial, sans-serif;
    font-size: 11px; letter-spacing: .28em; text-transform: uppercase;
    color: var(--gold); margin: 0 0 8px;
  }}
  header.hero h1 {{ margin: 0; font-size: 30px; font-weight: 600; letter-spacing: .01em; }}
  header.hero p.sub {{ margin: 10px 0 0; color: var(--muted); font-size: 15px; max-width: 820px; }}
  nav.tabs {{
    display: flex; flex-wrap: wrap; gap: 8px;
    padding: 16px 44px;
    border-bottom: 1px solid var(--line);
    background: rgba(14,16,32,.6);
    position: sticky; top: 0; z-index: 5;
    backdrop-filter: blur(6px);
  }}
  button.tab {{
    appearance: none; border: 1px solid var(--line);
    background: var(--panel); color: var(--ink);
    font-family: "Segoe UI", Arial, sans-serif; font-size: 13px;
    padding: 7px 14px; border-radius: 999px; cursor: pointer;
    transition: border-color .15s, transform .05s;
  }}
  button.tab::before {{
    content: "●"; color: var(--accent, var(--muted));
    margin-right: 7px; font-size: 9px; vertical-align: 1px;
  }}
  button.tab:hover {{ border-color: var(--accent, var(--muted)); }}
  button.tab.active {{
    border-color: var(--accent, var(--gold));
    box-shadow: 0 0 0 1px var(--accent, var(--gold)) inset;
  }}
  main {{ padding: 30px 44px 80px; max-width: 960px; }}
  .page {{ display: none; }}
  .page.active {{ display: block; animation: fade .25s ease; }}
  @keyframes fade {{ from {{ opacity: 0; transform: translateY(4px); }} to {{ opacity: 1; transform: none; }} }}
  .page h1 {{
    font-size: 27px; margin: 0 0 6px; color: var(--gold);
    padding-bottom: 10px; border-bottom: 1px solid var(--line);
  }}
  .page h2 {{
    font-size: 19px; margin: 34px 0 10px; color: var(--gold);
    text-transform: uppercase; letter-spacing: .06em;
  }}
  .page h3, .page h4, .page h5, .page h6 {{
    font-size: 16px; margin: 26px 0 8px; color: #dfe3f2;
  }}
  .page p {{ margin: 12px 0; }}
  .page ul, .page ol {{ margin: 12px 0; padding-left: 26px; }}
  .page li {{ margin: 8px 0; }}
  .page strong {{ color: #ffffff; }}
  .page em {{ color: #cdd3ea; }}
  .page code {{
    font-family: Consolas, "Courier New", monospace; font-size: .86em;
    background: rgba(230,184,76,.1); color: #f3d98b;
    padding: 1px 6px; border-radius: 4px;
  }}
  .page blockquote {{
    margin: 16px 0; padding: 12px 18px;
    border-left: 3px solid var(--gold);
    background: rgba(230,184,76,.06);
    border-radius: 0 8px 8px 0;
    color: var(--muted);
  }}
  .table-wrap {{ overflow-x: auto; margin: 16px 0; }}
  .page table {{
    border-collapse: collapse; width: 100%;
    font-family: "Segoe UI", Arial, sans-serif; font-size: 13.5px;
  }}
  .page th, .page td {{
    border: 1px solid var(--line); padding: 9px 12px; text-align: left;
    vertical-align: top;
  }}
  .page th {{ background: var(--panel); color: var(--gold); font-weight: 600; }}
  .page hr {{ border: 0; border-top: 1px solid var(--line); margin: 26px 0; }}
  footer {{
    padding: 18px 44px 30px; color: var(--muted);
    font-family: "Segoe UI", Arial, sans-serif; font-size: 12px;
    border-top: 1px solid var(--line);
  }}
  @media (max-width: 700px) {{
    header.hero, nav.tabs, main, footer {{ padding-left: 18px; padding-right: 18px; }}
  }}
</style>
</head>
<body>
<header class="hero">
  <p class="kicker">Power Rangers Primal Force</p>
  <h1>Mestres Morphin</h1>
  <p class="sub">Os "cérebros" (prompts de sistema) dos Mestres Morphin — seres
  antigos, guerreiros-monges serenos e sábios, criados pelo Roro, que protegem
  a Rede Morphin. Escolha um Mestre para ler o seu prompt.</p>
</header>
<nav class="tabs" aria-label="Mestres">
{tabs_html}
</nav>
<main>
{pages_html}
</main>
<footer>
Gerado por <code>tools/build_preview.py</code> a partir dos ficheiros .md do projeto —
<a href="#" id="src-link" style="color:var(--muted)">origem do ficheiro visível</a>.
</footer>
<script>
  const tabs = Array.from(document.querySelectorAll('button.tab'));
  const pages = Array.from(document.querySelectorAll('section.page'));
  function show(id) {{
    tabs.forEach(t => t.classList.toggle('active', t.dataset.id === id));
    pages.forEach(p => p.classList.toggle('active', p.id === 'page-' + id));
    history.replaceState(null, '', '#' + id);
    document.getElementById('src-link').textContent = 'origem: ' + id + '.md';
  }}
  tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.id)));
  if (location.hash && location.hash.length > 1) {{
    const id = location.hash.slice(1);
    if (document.getElementById('page-' + id)) show(id);
  }}
  document.getElementById('src-link').addEventListener('click', (e) => {{
    e.preventDefault();
    const active = tabs.find(t => t.classList.contains('active'));
    show(active ? active.dataset.id : 'README');
  }});
</script>
</body>
</html>
"""
    OUT.write_text(doc, encoding="utf-8")
    print(f"preview.html written ({len(doc)} bytes, {len(sections)} pages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
