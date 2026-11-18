"""Buka situs yang sedang tayang dan cek apakah halaman dan semua foto produk bisa diambil.

Hanya melaporkan (log + ringkasan run di GitHub Actions), tidak mengubah apa pun.
Untuk uji lokal: LIVE_BASE=http://localhost:8768 python scripts/check_live.py
"""
import csv, io, os, re, sys, urllib.error, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_og import ROOT, IMG

BASE = os.environ.get("LIVE_BASE", "https://wismir.id").rstrip("/")


def fetch(url, method="GET"):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "Mozilla/5.0 wismir-check"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return getattr(r, "status", 200) or 200, r.headers.get("Content-Type", ""), int(r.headers.get("Content-Length") or 0), r.read() if method == "GET" else b""
    except urllib.error.HTTPError as e:
        return e.code, "", 0, b""
    except Exception as e:
        return 0, str(e)[:80], 0, b""


out = ["## Cek situs live", ""]
st, ct, ln, body = fetch(BASE + "/")
out.append(f"- Halaman utama `{BASE}/`: HTTP **{st}**, {ct}")
html_live = body.decode("utf-8", "replace") if st == 200 else ""
if html_live:
    out.append(f"- Memuat `foto/` di kode: {'ya' if 'foto/' in html_live else 'TIDAK'}; `.archw` (beranda baru): {'ya' if 'archw' in html_live else 'TIDAK (versi lama?)'}")

src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
sheet = re.search(r'const SHEET_CSV\s*=\s*"([^"]+)"', src).group(1)
sst, _, _, sb = fetch(sheet)
out.append(f"- Google Sheet (CSV): HTTP **{sst}**")
names = {}
if sst == 200:
    rows = list(csv.reader(io.StringIO(sb.decode("utf-8-sig"))))
    head = [h.strip().lower() for h in rows[0]]
    for r in rows[1:]:
        row = dict(zip(head, (c.strip() for c in r)))
        if not row.get("nama"):
            continue
        raw = "|".join(v for k, v in row.items() if k.startswith("foto") and v)
        for t in re.split(r"[\s|,]+", raw):
            if t and not re.match(r"https?:", t, re.I) and IMG.search(t):
                names.setdefault(t[5:] if t.startswith("foto/") else t, row["nama"])
bad = []
big = []
for n, prod in sorted(names.items()):
    s, c, l, _ = fetch(f"{BASE}/foto/{urllib.parse.quote(n)}", "HEAD")
    if s != 200 or not c.startswith("image/"):
        bad.append((n, prod, s, c))
    elif l > 600_000:
        big.append((n, prod, l))
out.append(f"- Foto yang dicek: **{len(names)}**, gagal diambil: **{len(bad)}**, lebih dari 600 KB: **{len(big)}**")
out += [f"  - GAGAL `{n}` (produk: {p}): HTTP {s} {c}" for n, p, s, c in bad]
out += [f"  - BESAR `{n}` (produk: {p}): {l // 1024} KB" for n, p, l in big]
text = "\n".join(out)
print(text)
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8").write(text + "\n")
