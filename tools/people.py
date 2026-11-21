# Arma data/people.json (nombre corto, empresa, cargo, rol) y public/ps1/thumbs.png (caritas de 32 px)
# uso: python3 -I tools/people.py <roster.json de hack-smash>
import json, sys, os
from PIL import Image
src = json.load(open(sys.argv[1]))
faces = json.load(open('public/ps1/faces.json'))
MADE = {'ian-fry': 'ian', 'matias-berrios': 'matias', 'paolo-flores': 'paolo', 'juan-vargas': 'juan', 'rafael-fernandez': 'rafa'}
people = []
for p in src:
    if p['id'] not in faces or not os.path.exists(f"public/ps1/{p['id']}.png"): continue
    people.append({'id': p['id'], 'name': p['name'], 'short': p['short'], 'company': p.get('company') or '', 'cargo': p.get('cargo') or '', 'role': p.get('role') or 'HACKER', 'look': {k: p['look'].get(k) for k in ('silueta', 'build', 'top', 'pants', 'shoes')}})
people.sort(key=lambda p: p['name'].lower().replace('á','a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u'))
T = 32; cols = 16
atlas = Image.new('RGB', (cols * T, ((len(people) + cols - 1) // cols) * T), (40, 40, 48))
for i, p in enumerate(people):
    f = faces[p['id']]; im = Image.open(f"public/ps1/{p['id']}.png").convert('RGBA'); S = im.width
    bx, by, bw, bh = f['box']; cx, cy = (bx + bw / 2) * S, (by + bh / 2) * S; r = max(bw, bh) * S * 0.78
    box = (int(cx - r), int(cy - r * 1.12), int(cx + r), int(cy + r * 0.88))
    bg = Image.new('RGBA', im.size, (58, 60, 72, 255)); bg.alpha_composite(im)
    atlas.paste(bg.crop(box).resize((T, T), Image.LANCZOS).convert('RGB'), ((i % cols) * T, (i // cols) * T))
    p['i'] = i
atlas.save('public/ps1/thumbs.png')
os.makedirs('data', exist_ok=True)
json.dump(people, open('data/people.json', 'w'), ensure_ascii=False, indent=1)
print(len(people), atlas.size)
