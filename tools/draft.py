"""Genera fichas borrador para todas las personas del consolidado.

uso: python3 -I tools/draft.py /ruta/consolidado.zip [--force]

Lee cada foto directo del zip (no extrae nada), mide colores de piel, pelo y ropa,
estima barba y pelo largo, y sortea el resto con una semilla derivada del nombre.
Escribe characters/drafts/<slug>.json y una miniatura en public/photos/<slug>.png.
Las fichas quedan marcadas "draft": true para afinarlas a mano en el generador.
"""
import sys, io, json, zipfile, hashlib, os, statistics, colorsys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DONE = {  # ya hechas a mano
    'paolo-luis-flores-congora', 'matias-antonio-berrios-ortigas', 'ian-fry-astorga', 'juan-vargas', 'rafael-fernandez',
}
N = 256

def med(px):
    if not px: return None
    return tuple(int(statistics.median(c[i] for c in px)) for i in range(3))

def region(im, x0, x1, y0, y1):
    out = []
    for y in range(int(y0 * N), int(y1 * N)):
        for x in range(int(x0 * N), int(x1 * N)):
            r, g, b, a = im.getpixel((x, y))
            if a > 200: out.append((r, g, b))
    return out

def lum(c): return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
def dist(a, b): return sum((a[i] - b[i]) ** 2 for i in range(3)) ** 0.5
def hx(c): return '#%02x%02x%02x' % tuple(max(0, min(255, int(v))) for v in c)
def scale(c, k): return tuple(v * k for v in c)
def skin_tone(c):
    # la mediana de una foto sale apagada: llevar el matiz a piel y subir la saturación
    h, s, v = colorsys.rgb_to_hsv(*(x / 255 for x in c))
    h = min(0.085, max(0.04, h if h < 0.5 else 0.04)); s = min(0.62, max(0.3, s * 1.15)); v = min(0.97, v * 1.06)
    return tuple(x * 255 for x in colorsys.hsv_to_rgb(h, s, v))

class Rnd:
    def __init__(self, seed): self.h = hashlib.sha256(seed.encode()).digest(); self.i = 0
    def __call__(self):
        v = self.h[self.i % 32] / 255.0; self.i += 1
        if self.i % 32 == 0: self.h = hashlib.sha256(self.h).digest()
        return v
    def pick(self, xs): return xs[min(len(xs) - 1, int(self() * len(xs)))]
    def rng(self, a, b): return round(a + (b - a) * self(), 2)

ACCENTS = ['#f2c230', '#35e08a', '#f2762e', '#e5484d', '#4aa3ff', '#b06cff', '#ff7ab8', '#e8e4da']
DARKS = ['#22222a', '#2c2f3a', '#23232b', '#2a2f3d', '#3b3550', '#1d1d22', '#33302c']

def analyse(im):
    skin = med(region(im, 0.40, 0.60, 0.44, 0.54)) or (224, 165, 126)
    # tope de la cabeza
    top = 0
    for y in range(N):
        if any(im.getpixel((x, y))[3] > 200 for x in range(int(N * 0.42), int(N * 0.58))): top = y / N; break
    hair = med(region(im, 0.40, 0.60, top + 0.02, top + 0.09)) or (40, 34, 32)
    cloth = med(region(im, 0.30, 0.70, 0.93, 0.99)) or (60, 60, 70)
    chin = med(region(im, 0.45, 0.55, 0.61, 0.66)) or skin
    ratio = lum(chin) / max(1.0, lum(skin))
    beard = 'short' if ratio < 0.66 else 'stubble' if ratio < 0.86 else 'none'
    bald = dist(hair, skin) < 38
    # pelo largo: color de pelo a los lados del cuello
    side = region(im, 0.22, 0.34, 0.66, 0.78) + region(im, 0.66, 0.78, 0.66, 0.78)
    near = [c for c in side if dist(c, hair) < 42 and dist(c, cloth) > 30 and dist(c, skin) > 45]
    long_hair = (not bald) and len(near) > 0.3 * max(1, len(side)) and len(side) > 200
    # la foto ilumina la piel; el color base del cel va un poco más saturado
    return dict(skin=skin, hair=hair, cloth=cloth, beard=beard, bald=bald, long=long_hair, top=top)

def spec_for(p, a, slug):
    r = Rnd(slug)
    accent = r.pick(ACCENTS)
    long_hair = a['long']
    style = 'buzz' if a['bald'] else 'long' if long_hair else r.pick(['messy', 'crop', 'quiff', 'curly', 'messy', 'crop'])
    hair = scale(a['skin'], 0.35) if a['bald'] else scale(a['hair'], 0.88)
    jacket_type = r.pick(['none', 'none', 'fleece', 'hoodie', 'vest'])
    jacket = {'type': 'none'}
    if jacket_type == 'fleece': jacket = {'type': 'fleece', 'color': r.pick(DARKS), 'collar': 'high', 'length': r.rng(0.3, 0.5), 'fit': r.rng(0.4, 0.6), 'open': 0.42, 'flare': 0.5}
    if jacket_type == 'hoodie': jacket = {'type': 'hoodie', 'color': r.pick(DARKS), 'trim': accent, 'cord': accent, 'collar': 'hood', 'length': r.rng(0.45, 0.65), 'fit': r.rng(0.5, 0.75), 'open': 0.5, 'flare': 0.6, 'sleeves': r.pick(['long', 'rolled'])}
    if jacket_type == 'vest': jacket = {'type': 'vest', 'color': r.pick(DARKS), 'trim': accent, 'collar': 'none', 'sleeves': 'none', 'length': 0.22, 'fit': 0.1, 'open': 0.3, 'flare': 0.15}
    bottom_type = r.pick(['straight', 'slim', 'joggers', 'wide', 'shorts'])
    handle = p.get('github') or slug.split('-')[0]
    roles = ' / '.join(x.lower() for x in (p.get('roles') or []))
    return {
        'id': slug, 'draft': True, 'name': p['name'], 'handle': handle,
        'title': ' · '.join(x for x in [roles, p.get('company')] if x), 'photo': slug + '.png',
        'seed': 1 + int(r() * 97),
        'body': {'height': r.rng(1.62, 1.88), 'build': r.rng(0.3, 0.7), 'shoulders': r.rng(0.35, 0.7), 'legs': r.rng(0.4, 0.6), 'head': r.rng(1.0, 1.08)},
        'skin': hx(skin_tone(a['skin'])),
        'face': {'jaw': r.rng(0.4, 0.75), 'eyes': {'color': hx(scale(a['hair'], 0.9)) if lum(a['hair']) < 90 else '#4a3626', 'size': r.rng(0.9, 1.05)},
                 'brows': {'thick': r.rng(0.35, 0.75), 'angle': r.rng(0.02, 0.2)}, 'beard': a['beard'], 'mouth': r.pick(['smirk', 'smile', 'grin'])},
        'hair': {'style': style, 'color': hx(hair), 'volume': r.rng(0.95, 1.15), 'length': 1.0},
        'top': {'type': 'tee', 'color': hx(a['cloth']), 'fit': r.rng(0.35, 0.65), 'length': r.rng(0.4, 0.7)},
        'jacket': jacket,
        'bottom': {'type': bottom_type, 'color': r.pick(DARKS), **({'length': 0.5, 'pocket': True} if bottom_type == 'shorts' else {}), **({'stripe': True, 'trim': accent} if bottom_type == 'joggers' else {})},
        'shoes': {'type': r.pick(['sneaker', 'sneaker', 'boot']), 'color': r.pick(['#f1efe9', '#2a2a30', '#ecebe6']), 'accent': accent, 'sole': r.pick(['#f7f5ef', '#26262c']), 'size': r.rng(1.05, 1.15), **({'sock': 0.3} if bottom_type == 'shorts' else {})},
        'hands': {'type': r.pick(['bare', 'wraps', 'fingerless', 'bare']), 'color': r.pick(['#efe8d8', '#23232b'])},
        'acc': {},
        'prints': [{'on': 'top', 'side': 'front', 'text': handle[:10], 'color': accent, 'size': 0.8, 'y': 0.62}],
    }

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    force = '--force' in sys.argv
    z = zipfile.ZipFile(sys.argv[1])
    index = json.loads(z.read('consolidado/index.json'))
    out_dir = os.path.join(ROOT, 'characters', 'drafts'); os.makedirs(out_dir, exist_ok=True)
    ph_dir = os.path.join(ROOT, 'public', 'photos'); os.makedirs(ph_dir, exist_ok=True)
    made = skipped = nophoto = 0
    for p in index:
        slug = os.path.basename(p['folder'])
        if slug in DONE: continue
        dst = os.path.join(out_dir, slug + '.json')
        if os.path.exists(dst) and not force: skipped += 1; continue
        try:
            raw = z.read(f"consolidado/{p['folder']}/foto-transparente.png")
            im = Image.open(io.BytesIO(raw)).convert('RGBA').resize((N, N), Image.LANCZOS)
        except KeyError:
            nophoto += 1; continue
        spec = spec_for(p, analyse(im), slug)
        with open(dst, 'w') as f: json.dump(spec, f, indent=2, ensure_ascii=False); f.write('\n')
        thumb = os.path.join(ph_dir, slug + '.png')
        if not os.path.exists(thumb):
            try: Image.open(io.BytesIO(z.read(f"consolidado/{p['folder']}/foto.png"))).convert('RGB').resize((256, 256), Image.LANCZOS).save(thumb, optimize=True)
            except KeyError: pass
        made += 1
    print(f'borradores: {made} nuevos, {skipped} ya existían, {nophoto} sin foto, de {len(index)} personas')

main()
