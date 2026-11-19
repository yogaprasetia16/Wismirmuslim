"""Buat halaman pratinjau per produk: p/<slug>/index.html.

Link seperti https://wismir.id/p/gamis-bordir/ dibagikan di WhatsApp / Instagram: pratinjaunya memakai foto dan nama produk itu
(pembaca pratinjau tidak menjalankan JavaScript, jadi harus halaman statis). Orang yang membukanya langsung diarahkan ke
/?p=<slug>, yang membuka pop-up produk di halaman utama.

Aturan slug HARUS sama dengan slugOf()/slugs() di index.html. Halaman produk yang sudah tidak ada di Sheet dihapus.
Untuk uji lokal: SHARE_SITE=http://localhost:8768 python scripts/update_share.py
"""
import csv, html, io, os, re, shutil, sys, unicodedata, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_og import ROOT, IMG, get

SITE = os.environ.get("SHARE_SITE", "https://wismir.id").rstrip("/")
OUT = os.path.join(ROOT, "p")


def slug_of(name):
    s = unicodedata.normalize("NFD", str(name or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "produk"


def slugs(names):
    seen, out = {}, []
    for n in names:
        s = slug_of(n)
        seen[s] = seen.get(s, 0) + 1
        out.append(s if seen[s] == 1 else f"{s}-{seen[s]}")
    return out


def first_photo(row):
    raw = "|".join(v for k, v in row.items() if k.startswith("foto") and v)
    for t in re.split(r"[\s|,]+", raw):
        if t and not re.match(r"https?:", t, re.I) and IMG.search(t):
            name = t[5:] if t.startswith("foto/") else t
            if os.path.exists(os.path.join(ROOT, "foto", name)):
                return f"{SITE}/foto/{urllib.parse.quote(name)}"
    return f"{SITE}/og-image.jpg"


def clip(t, n):
    t = re.sub(r"\s+", " ", t).strip()
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def page(slug, row):
    nama = row["nama"]
    title = f"{nama} – WISMIR"
    bits = [x for x in (row.get("kategori"), row.get("bahan"), ("Ukuran " + row["ukuran"]) if row.get("ukuran") else "") if x]
    desc = clip((row.get("deskripsi") or " · ".join(bits)) + ". Pesan lewat WhatsApp. WISMIR, Thamrin City Jakarta.", 200)
    img = first_photo(row)
    url = f"{SITE}/p/{slug}/"
    go = f"/?p={slug}"
    e = html.escape
    return f"""<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="robots" content="noindex, follow">
<meta name="description" content="{e(desc, quote=True)}">
<link rel="canonical" href="{SITE}/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WISMIR">
<meta property="og:locale" content="id_ID">
<meta property="og:url" content="{e(url)}">
<meta property="og:title" content="{e(title, quote=True)}">
<meta property="og:description" content="{e(desc, quote=True)}">
<meta property="og:image" content="{e(img)}">
<meta property="og:image:alt" content="{e(nama, quote=True)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(title, quote=True)}">
<meta name="twitter:description" content="{e(desc, quote=True)}">
<meta name="twitter:image" content="{e(img)}">
<meta http-equiv="refresh" content="0;url={go}">
<script>location.replace("{go}"+(location.search?"&"+location.search.slice(1):""))</script>
</head><body><p>Membuka <a href="{go}">{e(nama)}</a> di WISMIR…</p></body></html>
"""


def main():
    src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    sheet = re.search(r'const SHEET_CSV\s*=\s*"([^"]+)"', src).group(1)
    rows = list(csv.reader(io.StringIO(get(sheet).decode("utf-8-sig"))))
    head = [h.strip().lower() for h in rows[0]]
    items = [dict(zip(head, (c.strip() for c in r))) for r in rows[1:]]
    items = [i for i in items if i.get("nama")]
    if not items:
        sys.exit("Tidak ada produk di Sheet, halaman produk tidak diubah.")
    keep = set()
    for s, row in zip(slugs([i["nama"] for i in items]), items):
        d = os.path.join(OUT, s)
        os.makedirs(d, exist_ok=True)
        f = os.path.join(d, "index.html")
        new = page(s, row)
        if not os.path.exists(f) or open(f, encoding="utf-8").read() != new:
            open(f, "w", encoding="utf-8").write(new)
        keep.add(s)
    removed = 0
    if os.path.isdir(OUT):
        for n in os.listdir(OUT):
            if n not in keep and os.path.isdir(os.path.join(OUT, n)):
                shutil.rmtree(os.path.join(OUT, n))
                removed += 1
    print(f"Halaman produk: {len(keep)} dibuat/diperbarui, {removed} dihapus.")


if __name__ == "__main__":
    main()
