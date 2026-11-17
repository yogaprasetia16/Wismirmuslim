"""Bandingkan nama foto di Google Sheet dengan isi folder foto/.

Hasil: daftar foto yang tidak dipakai (aman dihapus) dan nama di Sheet yang filenya belum ada.
Ditulis ke log dan ke ringkasan run di GitHub Actions. Tidak mengubah/menghapus apa pun.
"""
import csv, io, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from update_og import get, ROOT, IMG

html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
sheet = re.search(r'const SHEET_CSV\s*=\s*"([^"]+)"', html).group(1)
rows = list(csv.reader(io.StringIO(get(sheet).decode("utf-8-sig"))))
head = [h.strip().lower() for h in rows[0]]

used, missing = {}, {}
have = {f for f in os.listdir(os.path.join(ROOT, "foto"))}
for r in rows[1:]:
    row = dict(zip(head, (c.strip() for c in r)))
    if not row.get("nama"):
        continue
    raw = "|".join(v for k, v in row.items() if k.startswith("foto") and v)
    for t in re.split(r"[\s|,]+", raw):
        if not t or re.match(r"https?:", t, re.I) or not IMG.search(t):
            continue
        name = t[5:] if t.startswith("foto/") else t
        used.setdefault(name, row["nama"])
        if name not in have:
            missing[name] = row["nama"]

unused = sorted(f for f in have if f not in used and f not in html)
out = ["## Cek foto", "",
       f"Foto di folder: **{len(have)}** | dipakai di Sheet: **{len(used)}**", ""]
out.append("### Foto tidak dipakai (aman dihapus)")
out += [f"- `{f}`" for f in unused] or ["- (tidak ada)"]
out += ["", "### Nama di Sheet yang filenya belum ada di folder foto/"]
out += [f"- `{n}` (produk: {p})" for n, p in sorted(missing.items())] or ["- (tidak ada)"]
out += ["", "### Struktur Sheet", f"Kolom: `{'`, `'.join(head)}`", f"Jumlah produk: {sum(1 for r in rows[1:] if len(r) and dict(zip(head, r)).get('nama'))}"]
for col in ("kategori", "terbaru", "sale"):
    if col in head:
        vals = sorted({(r[head.index(col)] if len(r) > head.index(col) else "").strip() for r in rows[1:]})
        out.append(f"- Nilai unik `{col}`: {vals}")
text = "\n".join(out)
print(text)
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8").write(text + "\n")
