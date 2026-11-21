// Ataque característico por empresa (botón 3). Todos los de una misma empresa comparten ataque,
// y cada uno tiene una mecánica propia además del daño:
//   phone    saca el teléfono y le caen mensajes al rival (finisher: algo gigante al final)
//   storm    cae por todo el escenario            crush   un objeto gigante cae donde está el rival
//   teleport desaparece y aparece detrás          control lo maneja a control remoto y le llueve encima
//   orbit    escudo de objetos girando            mines   quedan en el suelo esperando
//   slip     trampa → resbalón → lluvia           drive   algo grande cruza el suelo y atropella
//   lob      bomba en parábola con onda           swing   saca un arma y embiste
//   volley / throw / rain  siempre con un estado: confuse (controles al revés), freeze, slow,
//            shock, burn (daño en el tiempo) o drain (te cura con lo que quita)
const F = (name, kind, prop, o = {}) => ({ name, kind, prop, ...o });
const phone = (name, texts, color = '#35c46a', o = {}) => F(name, 'phone', 'bubble', { texts, color, fg: '#fff', ...o });
const doc = (text, fg = '#c22') => ({ text, fg });
const OIL = F('MANCHA DE ACEITE', 'slip', 'puddle', { then: 'drop', thenPo: { color: '#e8a020' }, n: 8, status: { burn: 240 } });
const CV = F('LLUVIA DE CVS', 'storm', 'doc', { po: doc('CV', '#2257c4'), n: 22, status: { slow: 150 } });
const AEO = (color) => phone('CHATGPT TE RECOMIENDA', ['según la IA…', 'top 1: tú', 'cita [1]', 'recomendado', 'alucinando…'], color, { status: { confuse: 220 } });
const CLOCK = F('MARCASTE TARDE', 'rain', 'clock', { status: { freeze: 75 } });
const book = (name, color, kind = 'crush', o = {}) => F(name, kind, 'book', { po: { color }, ...o });

export const FIRMAS = {
  // --- las del pedido ---
  'Platanus': F('RONDA SEMILLA', 'slip', 'peel', { then: 'bill', n: 9, everywhere: true }),
  'Vita': phone('TU CLASE ES A LAS 7', ['¿vienes hoy?', 'clase 7:00', 'no faltes!', 'renueva plan', 'a entrenar', 'te esperamos'], '#8f5aff', { n: 7, finisher: 'weight' }),
  'Finapsys': F('CUENTA CLÍNICA', 'storm', ['pill', 'syringe', 'doc', 'cross'], { po: doc('BONO'), n: 24, status: { slow: 200 } }),
  // --- sponsors y empresas con varios ---
  'Buk': F('DÍA DE PAGO', 'storm', ['doc', 'doc', 'bill'], { po: doc('SUELDO', '#2257c4') }),
  'CChC': F('OBRA GRUESA', 'crush', 'brick', { size: 5 }),
  'Revi': F('PERMISO DE EDIFICACIÓN', 'rain', 'doc', { po: doc('PERMISO', '#1f8a4a'), status: { slow: 240 } }),
  'Lemaco': F('MAQUINARIA PESADA', 'drive', 'truck', { po: { color: '#f2c230' } }),
  'Fintoc': F('TRANSFERENCIA AL TOQUE', 'teleport', 'coin'),
  'Unholster': F('LLUVIA DE DATOS', 'storm', 'data', { n: 22 }),
  'BipBop Labs': F('PINGÜINAZO', 'drive', 'penguin'),
  'BipBop': F('PINGÜINAZO', 'drive', 'penguin'),
  'Abaqus': F('PORTAFOLIO EN ROJO', 'crush', 'candle', { size: 4.5 }),
  'C1DO1': F('VER UNA, HACER UNA', 'volley', 'syringe', { n: 3, status: { slow: 220 } }),
  'Fintual': F('RISKY NORRIS', 'lob', 'piggy'),
  'Mi Primera Chamba': CV,
  'GBM': CV,
  'SmartUp': F('AGENTE DE COMPRAS', 'control', 'remote', { then: 'box' }),
  'Sodimac': F('HÁGALO USTED MISMO', 'swing', 'hammer'),
  'Turboshop': F('REPUESTO EXPRÉS', 'drive', 'tire'),
  'Copec': OIL, 'Copec Taller': OIL, 'Copec Wind': OIL,
  'AgendaPro': F('AGENDA LLENA', 'rain', 'calendar', { status: { freeze: 70 } }),
  'Grupalia': F('CRÉDITO GRUPAL', 'storm', 'coin', { n: 20 }),
  'Kapso': phone('WEBHOOK ENTRANTE', ['POST /hook', '200 OK', 'hola!', 'msg recibido', 'visto', 'template'], '#25d366', { status: { shock: 30 } }),
  'Shinkansen': F('TREN BALA', 'drive', 'train'),
  'Cognition': F('DEVIN TOMA EL CONTROL', 'control', 'remote', { then: 'data' }),
  'NeuralWorks': F('TE LEO LA MENTE', 'volley', 'chip', { n: 2, status: { confuse: 260 } }),
  'CEA': F('DONACIÓN EFECTIVA', 'heal', 'heart'),
  'Lici': F('LICITACIÓN ADJUDICADA', 'rain', 'doc', { po: doc('LICITA', '#7a3ad0'), status: { slow: 240 } }),
  '50X': F('PLANTA VIRTUAL', 'volley', 'battery', { n: 3, status: { shock: 55 } }),
  'Zesty': F('EXPRIMIDO', 'lob', 'lemon', { status: { burn: 180 }, burnLabel: 'ÁCIDO' }),
  // --- fintech / plata ---
  'Buda.com': F('LLUVIA DE SATOSHIS', 'storm', 'coin', { po: { text: 'B' } }),
  'Tenpo': F('TARJETA DE PREPAGO', 'volley', 'card', { po: { color: '#1fd0a0' }, drain: true }),
  'Neat': F('ARRIENDO CON TARJETA', 'volley', 'card', { po: { color: '#2b2b34' }, status: { slow: 200 } }),
  'Alfin Banco': F('LÍNEA DE CRÉDITO', 'volley', 'card', { po: { color: '#d92b3a' }, drain: true }),
  'Global66': F('REMESA EXPRESS', 'teleport', 'bill'),
  'Duemint': F('COBRANZA', 'volley', 'doc', { n: 3, po: doc('FACTURA'), drain: true }),
  'Relvo': F('FACTURA AUTÓNOMA', 'volley', 'doc', { n: 3, po: doc('FACTURA', '#1f8a4a'), drain: true }),
  'Inseport': F('CONTROL FINANCIERO', 'control', 'remote', { then: 'candle', thenPo: { color: '#3fc46a' } }),
  'AMM Capital': F('VELAS JAPONESAS', 'storm', 'candle', { po: { color: '#3fc46a' }, n: 20, status: { burn: 150 } }),
  'PlusZero': F('MODELO CUANT', 'orbit', 'candle', { po: { color: '#ffb02a' } }),
  'Quantum Wave': F('RIESGO EXTREMO', 'volley', 'bolt', { status: { shock: 55 } }),
  'Dropout Capital': F('TICKET DE INVERSIÓN', 'storm', 'bill', { n: 22 }),
  'Dasein Futures': F('PORTAFOLIO', 'orbit', 'candle', { po: { color: '#5a8fff' } }),
  'SummaPartners': F('ADVANCED ANALYTICS', 'orbit', 'data', { po: { color: '#5ab0ff' } }),
  'Frust': F('SAVINGS PLAN', 'volley', 'cloud', { n: 2, po: { color: '#ffb02a' }, drain: true }),
  'TheHouse Advisory': F('INFORME DE CONSULTORÍA', 'crush', 'doc', { po: doc('INFORME', '#333'), size: 4 }),
  'Deloitte': F('AUDITORÍA', 'rain', 'doc', { po: doc('AUDIT', '#1f8a4a'), status: { slow: 240 } }),
  'Leñadura S.A.': F('LEÑA SECA', 'drive', 'log'),
  // --- chat / agentes / marketing ---
  'Vambe': phone('¿TE INTERESA?', ['hola!!', '¿te interesa?', 'oferta hoy', 'cotiza aquí', 'sigues ahí?', 'cerramos?'], '#5a6bff', { status: { slow: 160 } }),
  'Ungga': phone('ARRIENDO POR WHATSAPP', ['depto 2D1B', '¿visita hoy?', 'UF 12', 'sin aval?', 'disponible'], '#25d366', { n: 6, finisher: 'house' }),
  'UDP': phone('RESERVA 24/7', ['¿mesa p/ 2?', 'reservado!', '21:00 ok', 'confirmado'], '#25d366', { status: { freeze: 45 } }),
  'Valoon': phone('GRUPO DE LA OBRA', ['falta cemento', 'foto avance', 'llegó grúa', 'losa lista', 'urgente!!'], '#25d366', { n: 6, finisher: 'brick' }),
  'Batwise': AEO('#10a37f'),
  'Bison Agents': AEO('#7a5230'),
  'Comunidad CachAI': phone('¿CACHAI?', ['¿cachai?', '¿y por qué?', '¿cómo?', '¿y si…?', 'pregunta!'], '#ff7a2a', { status: { confuse: 200 } }),
  'Claro': phone('TE QUEDAN 0 MB', ['0 MB', 'recarga ya', 'bolsa $990', 'sin saldo', 'promo!'], '#d92b3a', { status: { slow: 220 } }),
  'TELUS Digital': phone('SU LLAMADA ES IMPORTANTE', ['en espera…', 'marque 1', 'ticket #482', 'no cuelgue'], '#6a3ad0', { status: { freeze: 60 } }),
  'Front': F('BANDEJA DE ENTRADA', 'storm', 'envelope', { n: 22, status: { slow: 160 } }),
  '30X': F('LEAD CALIFICADO', 'volley', 'envelope', { n: 3, status: { confuse: 180 } }),
  'Topsort': F('SE ADJUDICA', 'swing', 'hammer'),
  'Zent Agency': F('AUTOMATIZACIÓN TOTAL', 'control', 'remote', { then: 'gear' }),
  'Black Sheep': F('OVEJA NEGRA', 'drive', 'sheep'),
  'RedTur': F('EXCESO DE EQUIPAJE', 'crush', 'bag', { po: { color: '#7a5230' }, size: 4 }),
  'Stealth Startup': F('MODO STEALTH', 'teleport', 'doc', { po: doc('SECRETO', '#111') }),
  'Stealth': F('MODO STEALTH', 'teleport', 'doc', { po: doc('SECRETO', '#111') }),
  // --- retail / logística / comida ---
  'Rappi': F('PEDIDO EN CAMINO', 'lob', 'bag', { po: { color: '#ff441f' }, status: { burn: 150 }, burnLabel: 'AJÍ' }),
  'Falabella': F('CYBER DAY', 'storm', 'bag', { po: { color: '#aad400' }, n: 22 }),
  'Gama': F('PASILLO 4', 'storm', ['melon', 'bottle', 'box'], { n: 20 }),
  'Valdishopper': F('CARRO LLENO', 'storm', 'bag', { po: { color: '#3a8fe8' }, n: 22 }),
  'Fundo Peumayen': F('SANDÍA DE TEMPORADA', 'crush', 'melon', { size: 5 }),
  'Alt Protein Project UC': F('HAMBURGUESA DE LENTEJAS', 'heal', 'burger'),
  'UDD': F('ALMUERZO ASIÁTICO', 'lob', 'burger', { status: { burn: 160 }, burnLabel: 'PICANTE' }),
  'Biwiser Group': F('QUIEBRE DE STOCK', 'crush', 'box', { size: 4.5 }),
  'Krunchbox': F('CAJA DE DATOS', 'crush', 'box', { size: 4.5 }),
  'puente OS': F('ÚLTIMA MILLA', 'drive', 'truck', { po: { color: '#3a6fd0' } }),
  'Cristalchile': F('VIDRIO ROTO', 'mines', 'bottle', { n: 4 }),
  // --- autos / aviones / energía / industria ---
  'Carstat': F('CRASH TEST', 'drive', 'car'),
  'LATAM Airlines': F('VUELO LA800', 'drive', 'plane'),
  'LATAM': F('VUELO LA800', 'drive', 'plane'),
  'SII Group': F('TURBULENCIA', 'drive', 'plane'),
  'Visagente': F('CITA DE VISA', 'volley', 'doc', { n: 3, po: doc('VISA', '#2257c4'), status: { freeze: 70 } }),
  'Plexo': F('BARRIL DE CRUDO', 'drive', 'barrel'),
  'Valdivia Tech': F('SOBRECARGA', 'volley', 'bolt', { status: { shock: 55 } }),
  'DAAB': F('ALTA TENSIÓN', 'volley', 'bolt', { status: { shock: 55 } }),
  'ProHack': F('GRAN INDUSTRIA', 'orbit', 'gear'),
  'JAPS': F('AUTOMATIZACIÓN', 'orbit', 'gear'),
  'Sonicali': F('SALMÓN DEL SUR', 'volley', 'fish', { n: 4, status: { slow: 150 } }),
  'GoFarmer': F('RIEGO DE PRECISIÓN', 'storm', 'drop', { n: 26, status: { slow: 170 } }),
  'GreenBloc': F('RIEGO SUBTERRÁNEO', 'mines', 'drop', { n: 4, status: { slow: 200 } }),
  'Wingsoft': F('MACETERO INTELIGENTE', 'mines', 'plant', { n: 4 }),
  'ACHS': F('PREVENCIÓN DE RIESGOS', 'slip', 'cone', { then: 'helmet', n: 6 }),
  'GeoVictoria': CLOCK, 'PGB': CLOCK,
  // --- nube / datos / IA ---
  'Google Cloud': F('TODO A LA NUBE', 'storm', 'cloud', { n: 18, status: { freeze: 50 } }),
  'Microsoft': F('PANTALLAZO AZUL', 'rain', 'cloud', { po: { color: '#3a8fe8' }, status: { freeze: 80 } }),
  'NTT DATA': F('CAÍDA DE SERVIDOR', 'crush', 'server', { size: 4, status: { shock: 50 } }),
  'Edaltec': F('GOBIERNO DE DATOS', 'orbit', 'data', { po: { color: '#ffb02a' } }),
  'Ciencia de Datos UC': F('DATASET SUCIO', 'storm', 'data', { po: { color: '#ffd23a' }, n: 20, status: { confuse: 170 } }),
  'CENIA': F('TE LEO LA MENTE', 'volley', 'magnifier', { n: 2, status: { confuse: 280 } }),
  'CHAIS': F('PAUSA A LA IA', 'volley', 'stop', { n: 2, status: { freeze: 90 } }),
  'TEK Chile': F('IA FÍSICA', 'drive', 'robot', { po: { color: '#ff5a3a' } }),
  'Meta Build City': F('METAVERSO', 'lob', 'visor', { status: { confuse: 300 } }),
  'Nomenclator': F('CLICK PREDICHO', 'teleport', 'box'),
  'XalDigital': F('PIPELINE ROTO', 'orbit', 'data', { po: { color: '#ff7ad0' } }),
  // --- salud / bio ---
  'Skip': F('REEMBOLSO MÉDICO', 'volley', ['doc', 'pill', 'doc'], { n: 3, po: doc('BONO', '#1f8a4a'), drain: true }),
  'IMC Labs': F('RECETA MAGISTRAL', 'rain', ['flask', 'pill'], { status: { confuse: 220 } }),
  'TeselaGen': F('ADN RECOMBINANTE', 'rain', 'flask', { po: { color: '#ff5ad0' }, status: { confuse: 220 } }),
  'AliviaUC': F('ALTA MÉDICA', 'heal', 'cross'),
  'OstheoGlove': F('ALTA MÉDICA', 'heal', 'cross'),
  // --- lugares / comunidad ---
  'Grupo Colibrí': F('TERRENO EN VERDE', 'crush', 'house', { size: 4 }),
  'TECHO': F('MEDIAGUA', 'crush', 'house', { po: { color: '#d9b98a' }, size: 4 }),
  'Ubikas': F('SALA OCUPADA', 'volley', 'key', { n: 3, status: { freeze: 75 } }),
  'AlojaFacil': F('CHECK-IN', 'volley', 'key', { n: 3, status: { freeze: 75 } }),
  'ProviWork': F('HOT DESK', 'orbit', 'laptop'),
  'Welcome Back': F('PELOTAZO', 'throw', 'ball', { status: { confuse: 150 } }),
  'Bomberos': F('URSA CRUX', 'lob', 'rocket', { status: { burn: 200 } }),
  'Radio Transients Lab': F('RÁFAGA DE RADIO', 'storm', 'star', { n: 18, status: { shock: 40 } }),
  'SIMONA Costa': F('MAREJADA', 'drive', 'wave'),
  'RindeChile': F('SOBREPRECIO', 'rain', 'doc', { po: doc('x10 $$$'), drain: true }),
  'Flair': F('PANAL', 'orbit', 'bee', { n: 5, status: { burn: 120 }, burnLabel: 'PICADO' }),
  'Pequén': F('VUELO DEL PEQUÉN', 'drive', 'owl'),
  'Identyz': F('VERIFICANDO IDENTIDAD…', 'volley', 'card', { po: { color: '#3fa0a0' }, status: { freeze: 80 } }),
  'MiGuru': F('OFERTA LABORAL', 'volley', 'doc', { n: 3, po: doc('CV', '#333'), status: { slow: 180 } }),
  'dameldato': F('DAME EL DATO', 'volley', 'doc', { n: 3, po: doc('DATO', '#2257c4'), status: { confuse: 180 } }),
  'Vinko': F('CONVOCATORIA ABIERTA', 'storm', 'doc', { po: doc('POSTULA', '#1f8a4a'), n: 20, status: { slow: 150 } }),
  'Loken': F('CTO AS A SERVICE', 'control', 'remote', { then: 'laptop' }),
  'Ingeniería para Chile': F('IMPRESIÓN 3D', 'orbit', 'gear'),
  'USM · Control Automático': F('LAZO CERRADO', 'control', 'remote', { then: 'gear' }),
  'USM · Enaer': F('MANTENCIÓN MAYOR', 'drive', 'plane'),
  'MSc Ing. Mecánica UC': F('ELEMENTOS FINITOS', 'orbit', 'gear'),
  // --- universidades ---
  'U. de Chile': book('APUNTES DE BEAUCHEF', '#2b4fd0'),
  'VTI U. de Chile': book('APUNTES DE BEAUCHEF', '#2b4fd0'),
  'U. de los Andes': book('RAMO DE COMPUTACIÓN', '#b23a3a', 'orbit'),
  'U. Adolfo Ibáñez': book('CASO DE NEGOCIOS', '#1c1c20', 'mines', { n: 4 }),
  'USM': book('CERTAMEN SORPRESA', '#1f8a4a', 'storm', { n: 20, status: { confuse: 170 } }),
  'U. Santa María': book('CERTAMEN SORPRESA', '#1f8a4a', 'storm', { n: 20, status: { confuse: 170 } }),
  'UCAB': book('PARCIAL DE CÁLCULO', '#f2c230', 'orbit'),
  'U. de Concepción': F('CAMPANIL', 'crush', 'brick', { size: 5 }),
  'ORT Argentina': book('TRABAJO PRÁCTICO', '#3a8fe8', 'mines', { n: 4 }),
  'UTN': book('TRABAJO PRÁCTICO', '#3a8fe8', 'mines', { n: 4 }),
};
const UC = F('INTERROGACIÓN SORPRESA', 'rain', 'doc', { po: doc('NOTA 1.0'), status: { confuse: 200 } });
const DEFAULT = F('DEPLOY EN VIERNES', 'crush', 'laptop', { size: 4, status: { freeze: 60 } });

export function firmaFor(company) {
  const c = (company || '').trim();
  if (!c) return { ...DEFAULT, company: '' };
  const parts = c.split(' · ');
  const hit = FIRMAS[c] || FIRMAS[parts[0]] || Object.entries(FIRMAS).find(([k]) => parts[0].toLowerCase().startsWith(k.toLowerCase()))?.[1];
  if (hit) return { ...hit, company: parts[0] };
  if (/\bUC\b|SIAM PUC/.test(parts[0])) return { ...UC, company: parts[0] };
  if (/^U\. |Universidad/.test(parts[0])) return { ...book('EXAMEN FINAL', '#7a3ad0'), company: parts[0] };
  for (const p of parts.slice(1)) if (FIRMAS[p]) return { ...FIRMAS[p], company: p };
  return { ...DEFAULT, company: parts[0] };
}
