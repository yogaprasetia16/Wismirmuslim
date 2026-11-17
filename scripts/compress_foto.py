"""Kecilkan foto di folder foto/ yang terlalu besar (sisi terpanjang 1400 px, kualitas 82).

Aman dijalankan berulang: foto yang sudah kecil tidak disentuh.
"""
import glob, io, os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_SIDE, MAX_BYTES = 1400, 450_000
EXT = {".jpg", ".jpeg", ".png", ".webp"}


def main():
    changed = 0
    for f in sorted(glob.glob(os.path.join(ROOT, "foto", "*"))):
        ext = os.path.splitext(f)[1].lower()
        if ext not in EXT:
            continue
        size = os.path.getsize(f)
        try:
            im = Image.open(f)
            im.load()
        except Exception as e:
            print("Lewati (tidak bisa dibuka):", os.path.basename(f), e)
            continue
        if max(im.size) <= MAX_SIDE and size <= MAX_BYTES:
            continue
        im = ImageOps.exif_transpose(im)
        if max(im.size) > MAX_SIDE:
            r = MAX_SIDE / max(im.size)
            im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
        buf = io.BytesIO()
        if ext == ".png":
            im.save(buf, "PNG", optimize=True)
        elif ext == ".webp":
            im.convert("RGB").save(buf, "WEBP", quality=82)
        else:
            im.convert("RGB").save(buf, "JPEG", quality=82, optimize=True, progressive=True)
        if buf.tell() < size * 0.9:
            open(f, "wb").write(buf.getvalue())
            changed += 1
            print(f"{os.path.basename(f)}: {size // 1024} KB -> {buf.tell() // 1024} KB")
    print("Selesai,", changed, "foto dikecilkan.")


if __name__ == "__main__":
    main()
