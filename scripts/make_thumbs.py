"""Buat foto kecil untuk kartu katalog: foto/t/<nama>.jpg dari setiap foto di foto/.

Kartu di wismir.id memakai foto kecil ini (lebih ringan, terutama di browser Instagram/WhatsApp);
foto ukuran penuh hanya dimuat di popup produk. Aman dijalankan berulang: foto kecil yang sudah ada
dan lebih baru dari fotonya tidak dibuat ulang; foto kecil yatim (foto aslinya sudah dihapus) dibuang.

Aturan nama HARUS sama dengan thumbOf() di index.html: foto/IMG_1.jpeg -> foto/t/IMG_1.jpg
"""
import os
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTO = os.path.join(ROOT, "foto")
THUMB = os.path.join(FOTO, "t")
WIDTH, QUALITY = 480, 74
EXT = {".jpg", ".jpeg", ".png", ".webp"}


def thumb_name(name):
    return os.path.splitext(name)[0] + ".jpg"


def main(foto=FOTO):
    thumb = os.path.join(foto, "t")
    os.makedirs(thumb, exist_ok=True)
    made, keep = 0, set()
    for n in sorted(os.listdir(foto)):
        src = os.path.join(foto, n)
        if not os.path.isfile(src) or os.path.splitext(n)[1].lower() not in EXT:
            continue
        tn = thumb_name(n)
        keep.add(tn)
        dst = os.path.join(thumb, tn)
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        try:
            im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        except Exception as e:
            print("Lewati (tidak bisa dibuka):", n, e)
            keep.discard(tn)
            continue
        if im.width > WIDTH:
            im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        made += 1
    removed = 0
    for n in os.listdir(thumb):
        if n not in keep and os.path.isfile(os.path.join(thumb, n)):
            os.remove(os.path.join(thumb, n))
            removed += 1
    print(f"Foto kecil: {made} dibuat, {removed} dibuang, {len(keep)} total.")


if __name__ == "__main__":
    main()
