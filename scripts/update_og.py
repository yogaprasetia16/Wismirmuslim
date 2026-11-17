"""Perbarui og-image.jpg (foto pratinjau WhatsApp/IG) dari foto produk terbaru di Google Sheet.

Logikanya sama dengan foto beranda di index.html: produk dengan kolom "terbaru" = ya
yang punya foto, kalau tidak ada dipakai produk pertama yang punya foto.
"""
import csv, hashlib, io, os, re, sys, urllib.request
from PIL import Image, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "index.html")
OUT = os.path.join(ROOT, "og-image.jpg")
YES = re.compile(r"^(ya|y|yes|true|1|v|x)$", re.I)
IMG = re.compile(r"\.(jpe?g|png|webp|gif|avif)(\?.*)?$", re.I)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def photo_url(u):
    m = re.search(r"drive\.google\.com/file/d/([\w-]+)", u) or (
        "drive.google.com" in u and re.search(r"[?&]id=([\w-]+)", u))
    return f"https://drive.google.com/thumbnail?id={m.group(1)}&sz=w1200" if m else u


def photos(row):
    raw = "|".join(v for k, v in row.items() if k.startswith("foto") and v)
    out = []
    for u in re.split(r"[\s|,]+", raw):
        if re.match(r"https?:", u, re.I) or IMG.search(u):
            out.append(photo_url(u if "/" in u else "foto/" + u))
    return out


def load_image(u):
    if u.startswith("http"):
        return Image.open(io.BytesIO(get(u)))
    for p in (u, u[5:] if u.startswith("foto/") else u):
        f = os.path.join(ROOT, p)
        if os.path.exists(f):
            return Image.open(f)
    raise FileNotFoundError(u)


def main():
    html = open(HTML, encoding="utf-8").read()
    sheet = re.search(r'const SHEET_CSV\s*=\s*"([^"]+)"', html).group(1)
    text = get(sheet).decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    head = [h.strip().lower() for h in rows[0]]
    items = [dict(zip(head, (c.strip() for c in r))) for r in rows[1:]]
    items = [i for i in items if i.get("nama")]
    pick = (next((i for i in items if YES.match(i.get("terbaru", "")) and photos(i)), None)
            or next((i for i in items if photos(i)), None))
    if not pick:
        sys.exit("Tidak ada produk berfoto, og-image.jpg tidak diubah.")
    im = ImageOps.exif_transpose(load_image(photos(pick)[0])).convert("RGB")

    W, H = 1200, 630
    bg = ImageOps.fit(im, (W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(28))
    bg = Image.blend(bg, Image.new("RGB", (W, H), (250, 246, 240)), 0.35)
    fg = ImageOps.contain(im, (W, H), Image.LANCZOS)
    bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2))
    buf = io.BytesIO()
    bg.save(buf, "JPEG", quality=85, optimize=True)
    data = buf.getvalue()

    old = open(OUT, "rb").read() if os.path.exists(OUT) else b""
    ver = hashlib.md5(data).hexdigest()[:8]
    if data != old:
        open(OUT, "wb").write(data)
    new_html = re.sub(r'(https://wismir\.id/og-image\.jpg)(\?v=\w+)?', r"\1?v=" + ver, html)
    if new_html != html:
        open(HTML, "w", encoding="utf-8").write(new_html)
    print("Produk:", pick.get("nama"), "| versi:", ver)


if __name__ == "__main__":
    main()
