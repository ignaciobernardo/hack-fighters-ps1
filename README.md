# hack fighters · PS1

Juego de pelea 1 contra 1 con estética de PlayStation 1 y los 237 participantes de Platanus Hack 26 Santiago como luchadores. Cada uno es un modelo low-poly (~750 vértices, un atlas de 512 px) con su cara real proyectada en la cabeza, y cada empresa tiene su propio ataque.

```
npm install
npm run dev        # http://127.0.0.1:8118
```

> Las fotos **no están en el repo**. Para generarlas desde el consolidado de la hack (macOS, usa Vision):
> `python3 -I tools/ps1_faces.py consolidado-26cl.zip` y después `python3 -I tools/people.py roster.json`.
> Deja `public/ps1/<id>.png`, `public/ps1/faces.json` y `public/ps1/thumbs.png`.

## Cómo se juega

Controles del gabinete Platanus Arcade (mismas teclas que `CABINET_KEYS`): joystick + 6 botones + START por jugador.
P1 = WASD + U I O / J K L · P2 = flechas + R T Y / F G H · START1 = Enter · START2 = 2.

| Botón | De pie | Agachado | En el aire |
|---|---|---|---|
| 1 | golpe | golpe bajo | golpe aéreo |
| 2 | golpe fuerte | gancho (anti-aéreo) | martillo |
| 3 | **ataque de empresa** | | |
| 4 | patada | patada baja | patada aérea |
| 5 | patada alta | barrida | picada |
| 6 | dash (atrás + 6 = hacia atrás) | | dash aéreo |

Doble toque adelante/atrás también es dash. Un golpe que conecta se cancela en uno más fuerte. START pausa y muestra los controles.

## Ataques de empresa

Todos los de una misma empresa comparten ataque (`src/ps1game/firmas.js`, 133 ataques). Tipos: `phone` (saca el teléfono y le caen mensajes al rival), `rain` (cae del cielo), `volley` (ráfaga), `lob` (parábola), `slip` (trampa en el suelo → resbala → lluvia) y `drive` (algo cruza el suelo). Ejemplos:

- **Vita** — «Tu clase es a las 7»: mensajes del gimnasio cayéndole en la cabeza.
- **Platanus** — «Ronda semilla»: cáscara de plátano, resbalón y lluvia de billetes.
- **Finapsys** — «Cuenta clínica»: píldoras, jeringas y bonos.
- **Buk** liquidaciones de sueldo · **CChC** ladrillos y cascos · **Fintoc** ráfaga de monedas · **BipBop** pingüino · **Shinkansen** tren bala · **Copec** mancha de aceite.

Los objetos son modelos low-poly armados con piezas simples en `src/ps1game/props.js`.

## Estructura

- `src/ps1/` — generador del modelo PS1 (malla, atlas pintado, foto → cabeza). `ps1.html` es el visor.
- `src/ps1game/` — el juego: `main.js` (pantallas, cámara, render 320×240 + dither), `fighter.js`, `moves.js`, `ai.js`, `input.js`, `sig.js` (motor de ataques de empresa), `stage-*.js` (el MUT, Buk, Casa Platanus).
- `characters/` — una ficha por persona (ropa, cuerpo). `data/people.json` — nombre, empresa, cargo.
- `tools/check_all.mjs` — arma a los 237 y lanza cada ataque; `tools/pelea_shot.mjs` — capturas.

Parámetros útiles: `?demo=1` (CPU contra CPU al azar), `?fight=1&p1=ian-fry&p2=rafael-fernandez&stage=buk`, `screen=select`, `mode=2p`, `dither=0`, `wobble=0`.
