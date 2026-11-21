"""Fotos recortadas + puntos de la cara para el estilo PS1.

uso: python3 -I tools/ps1_faces.py /ruta/consolidado.zip [--force]

Por persona: public/ps1/<slug>.png (foto sin fondo, 512 px, RGBA) y una entrada en
public/ps1/faces.json con ojos, boca, mentón (Vision, tools/faces.swift) y lo que
la máscara alfa dice de la cabeza: tope del pelo y ancho a la altura de los ojos.
Coordenadas normalizadas 0..1, origen arriba a la izquierda.
"""
import sys, io, os, json, zipfile, subprocess
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'ps1')
N = 512

def alpha_info(im, f):
    a = im.getchannel('A'); W, H = a.size; px = a.load()
    ex = (f['eyeL'][0] + f['eyeR'][0]) / 2
    cx = int(ex * W)
    # tope del pelo sobre la línea media de la cara (±8% para no caer en un hueco del peinado)
    top = None
    for y in range(H):
        if any(px[x, y] > 128 for x in range(max(0, cx - W // 12), min(W, cx + W // 12))): top = y / H; break
    def span(yn):
        y = min(H - 1, max(0, int(yn * H)))
        l = cx
        while l > 0 and px[l - 1, y] > 128: l -= 1
        r = cx
        while r < W - 1 and px[r + 1, y] > 128: r += 1
        return [l / W, r / W]
    ey = (f['eyeL'][1] + f['eyeR'][1]) / 2
    return {'top': top, 'spanEye': span(ey), 'spanBrow': span(ey - (f['chin'][1] - ey) * 0.45), 'spanTop': span((top or 0) + 0.04)}

def main():
    if len(sys.argv) < 2: sys.exit(__doc__)
    force = '--force' in sys.argv
    z = zipfile.ZipFile(sys.argv[1])
    index = json.loads(z.read('consolidado/index.json'))
    os.makedirs(OUT, exist_ok=True)
    paths = {}
    for p in index:
        slug = os.path.basename(p['folder'])
        dst = os.path.join(OUT, slug + '.png')
        if not os.path.exists(dst) or force:
            try: raw = z.read(f"consolidado/{p['folder']}/foto-transparente.png")
            except KeyError: continue
            Image.open(io.BytesIO(raw)).convert('RGBA').resize((N, N), Image.LANCZOS).save(dst, optimize=True)
        paths[slug] = dst
    res = subprocess.run(['swift', os.path.join(ROOT, 'tools', 'faces.swift'), *paths.values()], capture_output=True, text=True)
    by = {}
    for line in res.stdout.splitlines():
        if not line.startswith('{'): continue
        d = json.loads(line); by[d.pop('file')] = d
    faces = {}
    for slug, path in paths.items():
        f = by.get(path)
        if not f or not f.get('ok'): continue
        f.pop('ok')
        im = Image.open(path)
        f.update(alpha_info(im, f))
        faces[slug] = {k: ([round(x, 4) for x in v] if isinstance(v, list) else round(v, 4) if isinstance(v, float) else v) for k, v in f.items()}
    with open(os.path.join(OUT, 'faces.json'), 'w') as fh: json.dump(faces, fh, indent=0, sort_keys=True)
    print(f'{len(faces)} caras de {len(paths)} fotos ({len(index)} personas)')

main()
