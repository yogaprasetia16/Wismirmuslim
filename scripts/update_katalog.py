"""Buat katalog.json dari Google Sheet produk (yang dipublikasikan sebagai CSV).

index.html membaca katalog.json lebih dulu (satu file kecil dari website sendiri, jauh lebih cepat
daripada Google Sheet), lalu mencocokkannya dengan Sheet di latar belakang. Apps Script katalog juga
menulis file ini langsung setiap produk disimpan/dihapus/disembunyikan; skrip ini jaring pengamannya
(untuk Sheet yang diubah langsung) dan membuat file pertama kali.

Format (HARUS sama dengan katalogBuild_() di apps-script/Code.gs):
  {"v":1,"items":[ {kolom: nilai, ...}, ... ]}   urutan = urutan di Sheet
  produk tampil   : semua kolom yang tidak kosong (huruf kecil)
  produk sembunyi : hanya {"nama":..., "sembunyi":"ya"} (agar nomor link produk tetap dihitung)
"""
import csv, io, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "katalog.json")
YES = re.compile(r"^(ya|y|yes|true|1|v|x)$", re.I)


def build(rows):
    head = [h.strip().lower() for h in rows[0]]
    items = []
    for r in rows[1:]:
        d = dict(zip(head, (c.strip() for c in r)))
        if not d.get("nama"):
            continue
        if YES.match(d.get("sembunyi", "")):
            items.append({"nama": d["nama"], "sembunyi": "ya"})
        else:
            items.append({k: v for k, v in d.items() if k and v != ""})
    return json.dumps({"v": 1, "items": items}, ensure_ascii=False, separators=(",", ":"))


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def main():
    src = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    sheet = re.search(r'const SHEET_CSV\s*=\s*"([^"]+)"', src).group(1)
    rows = list(csv.reader(io.StringIO(get(sheet).decode("utf-8-sig"))))
    text = build(rows)
    if not json.loads(text)["items"]:
        sys.exit("Tidak ada produk di Sheet, katalog.json tidak diubah.")
    old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
    if old != text:
        open(OUT, "w", encoding="utf-8").write(text)
    print("katalog.json:", len(json.loads(text)["items"]), "produk", "(berubah)" if old != text else "(sama)")


if __name__ == "__main__":
    main()
