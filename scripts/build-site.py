#!/usr/bin/env python3
"""Build the GitHub Pages site into _site/ (stdlib only).

  ./scripts/build-site.py [out-dir]      then:  node scripts/site-check.mjs [out-dir]

Pages: site/*.html (hand-written, with {{VERSION}} / {{BASE}} placeholders) + /docs/*.html rendered from Markdown.
Also publishes the installers and the PoC compose file so the one-liners always match the repo.
The Markdown renderer is deliberately small: headings, fenced code, lists, tables, blockquotes, rules, inline
code/bold/italic/links. All text is HTML-escaped and unsafe link schemes are dropped.
"""
from __future__ import annotations

import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "_site"
BASE = "/aurora"  # https://zyvorai.github.io/aurora/
REPO = "https://github.com/zyvorai/aurora"
def _version() -> str:
    import os, subprocess
    if os.environ.get("AURORA_VERSION"):
        return os.environ["AURORA_VERSION"]
    try:
        return subprocess.check_output(["git", "-C", str(ROOT), "describe", "--tags", "--always"], text=True, stderr=subprocess.DEVNULL).strip().lstrip("v")
    except Exception:
        return "dev"


VERSION = _version()

DOCS = [  # (source, slug, title, group)
    ("docs/poc.md", "poc", "Try it in five minutes", "Start"),
    ("docs/customer/getting-started.md", "getting-started", "Getting started", "Start"),
    ("docs/customer/using-the-dashboard.md", "dashboard", "Using the dashboard", "Use"),
    ("docs/customer/workflows.md", "workflows", "Workflows", "Use"),
    ("docs/seo.md", "seo", "SEO", "Use"),
    ("docs/customer/admin-basics.md", "admin", "Admin basics", "Use"),
    ("docs/ollama-llm-integration.md", "llm", "LLM setup (Ollama / OpenAI)", "Reference"),
    ("docs/sso-oidc.md", "sso", "Single sign-on", "Reference"),
    ("docs/LICENSING.md", "licensing", "Licensing", "Reference"),
    ("CHANGELOG.md", "changelog", "Changelog", "Project"),
]


def slugify(t: str) -> str:
    s = re.sub(r"`([^`]*)`", r"\1", t).lower()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s.strip()).strip("-") or "section"


def safe_url(u: str) -> str:
    u = u.strip()
    return "#" if re.match(r"^\s*(javascript|data|vbscript):", u, re.I) else u


def rewrite_link(u: str, known: dict[str, str]) -> str:
    u = safe_url(u)
    if re.match(r"^(https?:|mailto:|#)", u):
        return u
    path, _, frag = u.partition("#")
    name = Path(path).name
    for src, slug in known.items():
        if Path(src).name == name and name:
            return f"{BASE}/docs/{slug}.html" + (f"#{frag}" if frag else "")
    return f"{REPO}/blob/main/{path.lstrip('./')}" if path else u


def inline(text: str, known: dict[str, str]) -> str:
    codes: list[str] = []
    def stash(m):
        codes.append(f"<code>{html.escape(m.group(1))}</code>")
        return f"\x00{len(codes)-1}\x00"
    text = re.sub(r"`([^`]+)`", stash, text)
    text = html.escape(text, quote=False)
    text = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(rewrite_link(html.unescape(m.group(2)), known), quote=True)}">{m.group(1)}</a>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", text)
    return re.sub(r"\x00(\d+)\x00", lambda m: codes[int(m.group(1))], text)


def render_md(md: str, known: dict[str, str]) -> tuple[str, list[tuple[int, str, str]]]:
    out: list[str] = []
    toc: list[tuple[int, str, str]] = []
    lines = md.replace("\r\n", "\n").split("\n")
    i, n = 0, len(lines)
    para: list[str] = []

    def flush():
        if para:
            out.append("<p>" + inline(" ".join(para), known) + "</p>")
            para.clear()

    while i < n:
        line = lines[i]
        if line.strip().startswith("```"):
            flush()
            lang = line.strip()[3:].strip()
            i += 1
            buf = []
            while i < n and not lines[i].strip().startswith("```"):
                buf.append(lines[i]); i += 1
            i += 1
            out.append(f'<pre><code class="lang-{html.escape(lang)}">{html.escape(chr(10).join(buf))}</code></pre>')
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", line)
        if m:
            flush()
            lvl, txt = len(m.group(1)), m.group(2).strip()
            sid = slugify(txt)
            if lvl in (2, 3):
                toc.append((lvl, sid, re.sub(r"`", "", txt)))
            out.append(f'<h{lvl} id="{sid}">{inline(txt, known)}</h{lvl}>')
            i += 1
            continue
        if re.match(r"^\s*(---|\*\*\*)\s*$", line):
            flush(); out.append("<hr>"); i += 1; continue
        if line.startswith(">"):
            flush()
            buf = []
            while i < n and lines[i].startswith(">"):
                buf.append(lines[i].lstrip("> ").rstrip()); i += 1
            out.append("<blockquote>" + inline(" ".join(buf), known) + "</blockquote>")
            continue
        if "|" in line and i + 1 < n and re.match(r"^\s*\|?[\s:|-]+\|[\s:|-]*$", lines[i + 1]):
            flush()
            def cells(r): return [c.strip() for c in r.strip().strip("|").split("|")]
            head = cells(line); i += 2
            rows = []
            while i < n and "|" in lines[i] and lines[i].strip():
                rows.append(cells(lines[i])); i += 1
            t = "<div class='tablewrap'><table><thead><tr>" + "".join(f"<th>{inline(c, known)}</th>" for c in head) + "</tr></thead><tbody>"
            for r in rows:
                t += "<tr>" + "".join(f"<td>{inline(c.replace(chr(92) + '|', '|'), known)}</td>" for c in r) + "</tr>"
            out.append(t + "</tbody></table></div>")
            continue
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", line)
        if m:
            flush()
            tag = "ol" if m.group(2)[0].isdigit() else "ul"
            items = []
            while i < n and (re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) or (lines[i].startswith("  ") and lines[i].strip() and items)):
                mm = re.match(r"^\s*(?:[-*]|\d+\.)\s+(.*)$", lines[i])
                if mm: items.append(mm.group(1))
                else: items[-1] += " " + lines[i].strip()
                i += 1
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x, known)}</li>" for x in items) + f"</{tag}>")
            continue
        if not line.strip():
            flush(); i += 1; continue
        para.append(line.strip()); i += 1
    flush()
    return "\n".join(out), toc


def page(template: str, **kw) -> str:
    for k, v in kw.items():
        template = template.replace("{{" + k + "}}", v)
    return template


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "docs").mkdir(parents=True)
    shutil.copytree(ROOT / "site", OUT, dirs_exist_ok=True)
    (OUT / "img").mkdir(exist_ok=True)
    for f in (ROOT / "apps/web/public/screenshots").glob("*.png"):
        shutil.copy(f, OUT / "img" / f.name)
    shutil.copy(ROOT / "apps/web/public/social/aurora-share-card.png", OUT / "img/share.png")
    shutil.copy(ROOT / "apps/web/public/zyvor-mark.svg", OUT / "favicon.svg")
    for f in ("install.sh", "install.ps1"):
        shutil.copy(ROOT / "scripts/poc" / f, OUT / f)
    shutil.copy(ROOT / "docker-compose.poc.yml", OUT / "docker-compose.poc.yml")

    known = {src: slug for src, slug, _, _ in DOCS}
    groups: dict[str, list[tuple[str, str]]] = {}
    for _, slug, title, group in DOCS:
        groups.setdefault(group, []).append((slug, title))
    nav = "".join(
        f"<h4>{g}</h4>" + "".join(f'<a href="{BASE}/docs/{s}.html">{html.escape(t)}</a>' for s, t in items)
        for g, items in groups.items()
    )
    tpl = (ROOT / "site/_doc.html").read_text()
    index = []
    for src, slug, title, group in DOCS:
        p = ROOT / src
        if not p.exists():
            print(f"warning: {src} missing, skipped", file=sys.stderr)
            continue
        body, toc = render_md(p.read_text(), known)
        toc_html = "".join(f'<a class="l{lvl}" href="#{sid}">{html.escape(t)}</a>' for lvl, sid, t in toc)
        (OUT / "docs" / f"{slug}.html").write_text(
            page(tpl, TITLE=html.escape(title), BODY=body, NAV=nav, TOC=toc_html, BASE=BASE, VERSION=VERSION, SRC=f"{REPO}/blob/main/{src}")
        )
        index.append({"slug": slug, "title": title, "text": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", body))[:4000]})
    (OUT / "docs" / "search.json").write_text(json.dumps(index))

    for f in OUT.glob("*.html"):
        f.write_text(page(f.read_text(), BASE_ABS="https://zyvorai.github.io/aurora", BASE=BASE, VERSION=VERSION, REPO=REPO))
    (OUT / "_doc.html").unlink(missing_ok=True)
    (OUT / ".nojekyll").touch()
    (OUT / "sitemap.txt").write_text("\n".join(f"https://zyvorai.github.io/aurora/{p.relative_to(OUT)}" for p in sorted(OUT.rglob("*.html"))) + "\n")
    print(f"site built in {OUT} (version {VERSION}, {len(index)} docs)")


if __name__ == "__main__":
    main()
