// Ataque característico por empresa (botón 3). Todos los de una misma empresa comparten ataque.
// kind: phone (saca el teléfono y caen mensajes) · rain (cae del cielo) · volley (ráfaga recta)
//       throw (un tiro fuerte) · lob (parábola) · slip (trampa en el suelo → resbala → lluvia)
//       drive (algo grande cruza el suelo)
const F = (name, kind, prop, o = {}) => ({ name, kind, prop, ...o });
const phone = (name, texts, color = '#35c46a', fg = '#fff') => F(name, 'phone', 'bubble', { texts, color, fg });
const docs = (name, text, fg = '#c22', kind = 'rain') => F(name, kind, 'doc', { po: { text, fg } });
const books = (name, color) => F(name, 'rain', 'book', { po: { color } });

export const FIRMAS = {
  // --- las del pedido ---
  'Platanus': F('RONDA SEMILLA', 'slip', 'peel', { then: 'bill', n: 9 }),
  'Vita': phone('TU CLASE ES A LAS 7', ['¿vienes hoy?', 'clase 7:00', 'no faltes!', 'renueva plan', 'a entrenar', 'te esperamos'], '#8f5aff'),
  'Finapsys': F('CUENTA CLÍNICA', 'rain', ['pill', 'syringe', 'doc', 'cross'], { po: { text: 'BONO' } }),
  // --- sponsors y empresas con varios ---
  'Buk': docs('DÍA DE PAGO', 'SUELDO', '#2257c4'),
  'CChC': F('OBRA GRUESA', 'rain', ['brick', 'brick', 'helmet']),
  'Revi': docs('PERMISO DE EDIFICACIÓN', 'PERMISO', '#1f8a4a'),
  'Lemaco': F('MAQUINARIA PESADA', 'drive', 'truck', { po: { color: '#f2c230' } }),
  'Fintoc': F('TRANSFERENCIA AL TOQUE', 'volley', 'coin', { n: 5 }),
  'Unholster': F('LLUVIA DE DATOS', 'rain', 'data'),
  'BipBop Labs': F('PINGÜINAZO', 'drive', 'penguin'),
  'BipBop': F('PINGÜINAZO', 'drive', 'penguin'),
  'Abaqus': F('PORTAFOLIO EN ROJO', 'rain', 'candle'),
  'C1DO1': F('VER UNA, HACER UNA', 'volley', 'syringe', { n: 4 }),
  'Fintual': F('RISKY NORRIS', 'lob', 'piggy'),
  'Mi Primera Chamba': docs('LLUVIA DE CVS', 'CV', '#2257c4', 'volley'),
  'GBM': docs('LLUVIA DE CVS', 'CV', '#2257c4', 'volley'),
  'SmartUp': F('AGENTE DE COMPRAS', 'drive', 'robot', { po: { color: '#ffb02a' } }),
  'Sodimac': F('HÁGALO USTED MISMO', 'rain', ['hammer', 'brick', 'hammer']),
  'Turboshop': F('REPUESTO EXPRÉS', 'drive', 'tire'),
  'Copec': F('MANCHA DE ACEITE', 'slip', 'puddle', { then: 'drop', thenPo: { color: '#e8a020' }, n: 8 }),
  'Copec Taller': F('MANCHA DE ACEITE', 'slip', 'puddle', { then: 'drop', thenPo: { color: '#e8a020' }, n: 8 }),
  'Copec Wind': F('MANCHA DE ACEITE', 'slip', 'puddle', { then: 'drop', thenPo: { color: '#e8a020' }, n: 8 }),
  'AgendaPro': F('AGENDA LLENA', 'rain', 'calendar'),
  'Grupalia': F('CRÉDITO GRUPAL', 'rain', 'coin', { n: 12 }),
  'Kapso': phone('WEBHOOK ENTRANTE', ['POST /hook', '200 OK', 'hola!', 'msg recibido', 'visto', 'template'], '#25d366'),
  'Shinkansen': F('TREN BALA', 'drive', 'train'),
  'Cognition': F('DEVIN LO ARREGLA', 'drive', 'robot'),
  'NeuralWorks': F('RED NEURONAL', 'rain', 'chip'),
  'CEA': F('DONACIÓN EFECTIVA', 'lob', 'heart'),
  'Lici': docs('LICITACIÓN ADJUDICADA', 'LICITA', '#7a3ad0'),
  '50X': F('PLANTA VIRTUAL', 'volley', 'battery', { n: 4 }),
  'Zesty': F('EXPRIMIDO', 'lob', 'lemon'),
  // --- fintech / plata ---
  'Buda.com': F('LLUVIA DE SATOSHIS', 'rain', 'coin', { po: { text: 'B' }, n: 12 }),
  'Tenpo': F('TARJETA DE PREPAGO', 'volley', 'card', { po: { color: '#1fd0a0' } }),
  'Neat': F('ARRIENDO CON TARJETA', 'volley', 'card', { po: { color: '#2b2b34' } }),
  'Alfin Banco': F('LÍNEA DE CRÉDITO', 'volley', 'card', { po: { color: '#d92b3a' } }),
  'Global66': F('REMESA EXPRESS', 'drive', 'plane'),
  'Duemint': docs('COBRANZA', 'FACTURA', '#c22'),
  'Relvo': docs('FACTURA AUTÓNOMA', 'FACTURA', '#1f8a4a', 'volley'),
  'Inseport': F('CONTROL FINANCIERO', 'rain', 'candle', { po: { color: '#3fc46a' } }),
  'AMM Capital': F('VELAS JAPONESAS', 'rain', 'candle', { po: { color: '#3fc46a' } }),
  'PlusZero': F('MODELO CUANT', 'rain', 'candle', { po: { color: '#ffb02a' } }),
  'Quantum Wave': F('RIESGO EXTREMO', 'volley', 'bolt'),
  'Dropout Capital': F('TICKET DE INVERSIÓN', 'rain', 'bill'),
  'Dasein Futures': F('PORTAFOLIO', 'rain', 'candle', { po: { color: '#5a8fff' } }),
  'SummaPartners': F('ADVANCED ANALYTICS', 'rain', 'data', { po: { color: '#5ab0ff' } }),
  'Frust': F('CUENTA DE AWS', 'rain', 'cloud', { po: { color: '#ffb02a' } }),
  'TheHouse Advisory': docs('INFORME DE CONSULTORÍA', 'INFORME', '#333'),
  'Deloitte': docs('AUDITORÍA', 'AUDIT', '#1f8a4a'),
  'Leñadura S.A.': F('LEÑA SECA', 'rain', 'log'),
  // --- chat / agentes / marketing ---
  'Vambe': phone('¿TE INTERESA?', ['hola!!', '¿te interesa?', 'oferta hoy', 'cotiza aquí', 'sigues ahí?', 'cerramos?'], '#5a6bff'),
  'Ungga': phone('ARRIENDO POR WHATSAPP', ['depto 2D1B', '¿visita hoy?', 'UF 12', 'sin aval?', 'disponible'], '#25d366'),
  'UDP': phone('RESERVA 24/7', ['¿mesa p/ 2?', 'reservado!', '21:00 ok', 'confirmado'], '#25d366'),
  'Valoon': phone('GRUPO DE LA OBRA', ['falta cemento', 'foto avance', 'llegó grúa', 'losa lista', 'urgente!!'], '#25d366'),
  'Batwise': phone('CHATGPT TE RECOMIENDA', ['según la IA…', 'top 1: tú', 'cita [1]', 'recomendado'], '#10a37f'),
  'Bison Agents': phone('CHATGPT TE RECOMIENDA', ['según la IA…', 'top 3 marcas', 'cita [1]', 'recomendado'], '#7a5230'),
  'Comunidad CachAI': phone('¿CACHAI?', ['¿cachai?', '¿y por qué?', '¿cómo?', '¿y si…?', 'pregunta!'], '#ff7a2a'),
  'Claro': phone('TE QUEDAN 0 MB', ['0 MB', 'recarga ya', 'bolsa $990', 'sin saldo', 'promo!'], '#d92b3a'),
  'TELUS Digital': phone('SU LLAMADA ES IMPORTANTE', ['en espera…', 'marque 1', 'ticket #482', 'no cuelgue'], '#6a3ad0'),
  'Front': F('BANDEJA DE ENTRADA', 'rain', 'envelope'),
  '30X': F('LEAD CALIFICADO', 'volley', 'envelope', { n: 4 }),
  'Topsort': F('SE ADJUDICA', 'lob', 'hammer'),
  'Zent Agency': F('AUTOMATIZACIÓN', 'drive', 'robot', { po: { color: '#3fe07a' } }),
  'Black Sheep': F('OVEJA NEGRA', 'drive', 'sheep'),
  'RedTur': F('EXCESO DE EQUIPAJE', 'lob', 'bag', { po: { color: '#7a5230' } }),
  'Stealth Startup': docs('TOP SECRET', 'SECRETO', '#111', 'volley'),
  'Stealth': docs('TOP SECRET', 'SECRETO', '#111', 'volley'),
  // --- retail / logística / comida ---
  'Rappi': F('PEDIDO EN CAMINO', 'lob', 'bag', { po: { color: '#ff441f' } }),
  'Falabella': F('CYBER DAY', 'rain', 'bag', { po: { color: '#aad400' } }),
  'Gama': F('PASILLO 4', 'rain', ['melon', 'bottle', 'box']),
  'Valdishopper': F('CARRO LLENO', 'rain', 'bag', { po: { color: '#3a8fe8' } }),
  'Fundo Peumayen': F('SANDÍA DE TEMPORADA', 'rain', 'melon'),
  'Alt Protein Project UC': F('HAMBURGUESA DE LENTEJAS', 'lob', 'burger'),
  'UDD': F('ALMUERZO ASIÁTICO', 'lob', 'burger'),
  'Biwiser Group': F('QUIEBRE DE STOCK', 'rain', 'box'),
  'Krunchbox': F('CAJA DE DATOS', 'rain', 'box'),
  'puente OS': F('ÚLTIMA MILLA', 'drive', 'truck', { po: { color: '#3a6fd0' } }),
  'Cristalchile': F('ENVASE RETORNABLE', 'rain', 'bottle'),
  'Relvo · Zubale': docs('FACTURA AUTÓNOMA', 'FACTURA', '#1f8a4a', 'volley'),
  // --- autos / aviones / energía / industria ---
  'Carstat': F('CRASH TEST', 'drive', 'car'),
  'LATAM Airlines': F('VUELO LA800', 'drive', 'plane'),
  'LATAM': F('VUELO LA800', 'drive', 'plane'),
  'SII Group': F('TURBULENCIA', 'drive', 'plane'),
  'Visagente': docs('CITA DE VISA', 'VISA', '#2257c4', 'volley'),
  'Plexo': F('BARRIL DE CRUDO', 'rain', 'barrel'),
  'Valdivia Tech': F('SOBRECARGA', 'volley', 'bolt'),
  'DAAB': F('ALTA TENSIÓN', 'volley', 'bolt'),
  'ProHack': F('GRAN INDUSTRIA', 'rain', 'gear'),
  'JAPS': F('AUTOMATIZACIÓN', 'rain', 'gear'),
  'Sonicali': F('SALMÓN DEL SUR', 'volley', 'fish', { n: 4 }),
  'GoFarmer': F('RIEGO DE PRECISIÓN', 'rain', 'drop', { n: 12 }),
  'GreenBloc': F('RIEGO SUBTERRÁNEO', 'rain', 'drop', { n: 12 }),
  'Wingsoft': F('MACETERO INTELIGENTE', 'rain', 'plant'),
  'ACHS': F('PREVENCIÓN DE RIESGOS', 'slip', 'cone', { then: 'helmet', n: 6 }),
  'GeoVictoria': F('MARCASTE TARDE', 'rain', 'clock'),
  'PGB': F('MARCASTE TARDE', 'rain', 'clock'),
  // --- nube / datos / IA ---
  'Google Cloud': F('TODO A LA NUBE', 'rain', 'cloud'),
  'Microsoft': F('PANTALLAZO AZUL', 'rain', 'cloud', { po: { color: '#3a8fe8' } }),
  'NTT DATA': F('CAÍDA DE SERVIDOR', 'rain', 'server'),
  'Edaltec': F('GOBIERNO DE DATOS', 'rain', 'data', { po: { color: '#ffb02a' } }),
  'Ciencia de Datos UC': F('DATASET SUCIO', 'rain', 'data', { po: { color: '#ffd23a' } }),
  'CENIA': F('AUDITORÍA DE LLM', 'volley', 'magnifier'),
  'CHAIS': F('PAUSA A LA IA', 'volley', 'stop', { n: 3 }),
  'TEK Chile': F('IA FÍSICA', 'drive', 'robot', { po: { color: '#ff5a3a' } }),
  'Meta Build City': F('METAVERSO', 'lob', 'visor'),
  'Nomenclator': F('CLICK PREDICHO', 'rain', 'box', {}),
  'XalDigital': F('PIPELINE ROTO', 'rain', 'data', { po: { color: '#ff7ad0' } }),
  // --- salud / bio ---
  'Skip': F('REEMBOLSO MÉDICO', 'rain', ['doc', 'pill', 'doc'], { po: { text: 'BONO', fg: '#1f8a4a' } }),
  'IMC Labs': F('RECETA MAGISTRAL', 'rain', ['flask', 'pill']),
  'TeselaGen': F('ADN RECOMBINANTE', 'rain', 'flask', { po: { color: '#ff5ad0' } }),
  'AliviaUC': F('ALTA MÉDICA', 'volley', 'cross', { n: 3 }),
  'OstheoGlove': F('ALTA MÉDICA', 'volley', 'cross', { n: 3 }),
  // --- lugares / comunidad ---
  'Grupo Colibrí': F('TERRENO EN VERDE', 'lob', 'house'),
  'TECHO': F('MEDIAGUA', 'lob', 'house', { po: { color: '#d9b98a' } }),
  'Ubikas': F('SALA OCUPADA', 'volley', 'key', { n: 4 }),
  'AlojaFacil': F('CHECK-IN', 'volley', 'key', { n: 4 }),
  'ProviWork': F('HOT DESK', 'rain', 'laptop'),
  'Welcome Back': F('PELOTAZO', 'volley', 'ball', { n: 3 }),
  'Bomberos': F('URSA CRUX', 'lob', 'rocket'),
  'Radio Transients Lab': F('RÁFAGA DE RADIO', 'rain', 'star'),
  'SIMONA Costa': F('MAREJADA', 'drive', 'wave'),
  'RindeChile': docs('SOBREPRECIO', 'x10 $$$', '#c22'),
  'Flair': F('PANAL', 'volley', 'bee', { n: 5 }),
  'Pequén': F('VUELO DEL PEQUÉN', 'drive', 'owl'),
  'Identyz': F('VERIFICA TU IDENTIDAD', 'volley', 'card', { po: { color: '#3fa0a0' } }),
  'MiGuru': docs('OFERTA LABORAL', 'CV', '#333', 'volley'),
  'dameldato': docs('DAME EL DATO', 'DATO', '#2257c4', 'volley'),
  'Vinko': docs('CONVOCATORIA ABIERTA', 'POSTULA', '#1f8a4a'),
  'Loken': F('CTO AS A SERVICE', 'lob', 'laptop'),
  'Ingeniería para Chile': F('IMPRESIÓN 3D', 'rain', 'gear'),
  'USM · Control Automático': F('LAZO CERRADO', 'rain', 'gear'),
  'USM · Enaer': F('MANTENCIÓN MAYOR', 'drive', 'plane'),
  'MSc Ing. Mecánica UC': F('ELEMENTOS FINITOS', 'rain', 'gear'),
  // --- universidades ---
  'U. de Chile': books('APUNTES DE BEAUCHEF', '#2b4fd0'),
  'VTI U. de Chile': books('APUNTES DE BEAUCHEF', '#2b4fd0'),
  'U. de los Andes': books('RAMO DE COMPUTACIÓN', '#b23a3a'),
  'U. Adolfo Ibáñez': books('CASO DE NEGOCIOS', '#1c1c20'),
  'USM': books('CERTAMEN SORPRESA', '#1f8a4a'),
  'U. Santa María': books('CERTAMEN SORPRESA', '#1f8a4a'),
  'UCAB': books('PARCIAL DE CÁLCULO', '#f2c230'),
  'U. de Concepción': books('CAMPANIL', '#e8a020'),
  'ORT Argentina': books('TRABAJO PRÁCTICO', '#3a8fe8'),
  'UTN': books('TRABAJO PRÁCTICO', '#3a8fe8'),
};
const UC = docs('INTERROGACIÓN SORPRESA', 'NOTA 1.0', '#c22');
const DEFAULT = F('DEPLOY EN VIERNES', 'rain', 'laptop');

export function firmaFor(company) {
  const c = (company || '').trim();
  if (!c) return { ...DEFAULT, company: '' };
  const parts = c.split(' · ');
  const hit = FIRMAS[c] || FIRMAS[parts[0]] || Object.entries(FIRMAS).find(([k]) => parts[0].toLowerCase().startsWith(k.toLowerCase()))?.[1];
  if (hit) return { ...hit, company: parts[0] };
  if (/\bUC\b|SIAM PUC/.test(parts[0])) return { ...UC, company: parts[0] };
  if (/^U\. |Universidad/.test(parts[0])) return { ...books('EXAMEN FINAL', '#7a3ad0'), company: parts[0] };
  // segunda empresa del perfil, si la primera no está en el catálogo
  for (const p of parts.slice(1)) if (FIRMAS[p]) return { ...FIRMAS[p], company: p };
  return { ...DEFAULT, company: parts[0] };
}
