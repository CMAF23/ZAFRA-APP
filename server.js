require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const cors = require('cors');

const app = express();
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
//  MongoDB CONNECTION
// ─────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dulceria';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅  MongoDB conectado:', MONGODB_URI))
  .catch(err => console.error('❌  Error MongoDB:', err.message));

// ─────────────────────────────────────────────
//  BACKUPS AUTOMÁTICOS (snapshot con mongodump)
// ─────────────────────────────────────────────
const BACKUP_ON_WRITE = process.env.BACKUP_ON_WRITE !== 'false';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'backups');
const BACKUP_DEBOUNCE_MS = Number(process.env.BACKUP_DEBOUNCE_MS || 2000);
const BACKUP_KEEP_FILES = Number(process.env.BACKUP_KEEP_FILES || 80);
const APP_TIMEZONE_OFFSET_MINUTES = Number(process.env.APP_TIMEZONE_OFFSET_MINUTES || -360);

let backupTimer = null;
let backupRunning = false;
let backupPending = false;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function getBackupFileName() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `dulceria_${ts}.archive.gz`;
}

function pruneOldBackups() {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter(name => name.endsWith('.archive.gz'))
      .map(name => ({
        name,
        fullPath: path.join(BACKUP_DIR, name),
        mtime: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    const toDelete = files.slice(BACKUP_KEEP_FILES);
    for (const f of toDelete) {
      fs.unlinkSync(f.fullPath);
    }
  } catch (err) {
    console.log('⚠️ No se pudo limpiar backups antiguos:', err.message);
  }
}

function runMongoBackup(reason = 'api-write') {
  if (!BACKUP_ON_WRITE) return;
  if (backupRunning) {
    backupPending = true;
    return;
  }

  ensureBackupDir();
  backupRunning = true;
  const outputFile = path.join(BACKUP_DIR, getBackupFileName());
  const args = ['--uri', MONGODB_URI, `--archive=${outputFile}`, '--gzip'];

  execFile('mongodump', args, (err) => {
    backupRunning = false;

    if (err) {
      console.log(`⚠️ Backup falló (${reason}):`, err.message);
    } else {
      console.log(`💾 Backup creado (${reason}): ${outputFile}`);
      pruneOldBackups();
    }

    if (backupPending) {
      backupPending = false;
      runMongoBackup('pending-write');
    }
  });
}

function scheduleMongoBackup(reason = 'api-write') {
  if (!BACKUP_ON_WRITE) return;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    runMongoBackup(reason);
  }, BACKUP_DEBOUNCE_MS);
}

function getZonedDateParts(date, offsetMinutes = APP_TIMEZONE_OFFSET_MINUTES) {
  const shifted = new Date(new Date(date).getTime() + (offsetMinutes * 60000));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function getZonedDateKey(date, offsetMinutes = APP_TIMEZONE_OFFSET_MINUTES) {
  const parts = getZonedDateParts(date, offsetMinutes);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

function getZonedDayBounds(date = new Date(), offsetMinutes = APP_TIMEZONE_OFFSET_MINUTES) {
  const parts = getZonedDateParts(date, offsetMinutes);
  const startUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0) - (offsetMinutes * 60000);
  const endUtc = Date.UTC(parts.year, parts.month - 1, parts.day, 23, 59, 59, 999) - (offsetMinutes * 60000);
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

// ─────────────────────────────────────────────
//  MODELOS
// ─────────────────────────────────────────────

/** Catálogo de dulces */
const candySchema = new mongoose.Schema({
  nombre:         { type: String, required: true, trim: true },
  piezasPorBolsa: { type: Number, required: true, min: 1 },
  costoPorBolsa:  { type: Number, required: true, min: 0 },
  precioUnitario: { type: Number, required: true, min: 0 },
  activo:         { type: Boolean, default: true },
}, { timestamps: true });
const Candy = mongoose.model('Candy', candySchema);

/**
 * Bolsa = un lote de compra de un dulce específico.
 * Se lleva control FIFO de piezas vendidas por lote.
 */
const bolsaSchema = new mongoose.Schema({
  candyId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Candy', required: true },
  cantidadBolsas:   { type: Number, default: 1 },
  costoTotal:       { type: Number, required: true },   // costoPorBolsa * cantidadBolsas
  piezasTotales:    { type: Number, required: true },   // piezasPorBolsa * cantidadBolsas
  piezasVendidas:   { type: Number, default: 0 },       // Solo de ventas reales
  piezasEntregadas: { type: Number, default: 0 },       // Entregadas a la compañera
  dineroRecuperado: { type: Number, default: 0 },       // piezasVendidas * precioUnitario (solo vendidas)
  gananciaAcumulada:{ type: Number, default: 0 },       // dineroRecuperado - costoTotal
  recuperada:       { type: Boolean, default: false },
  fechaCompra:      { type: Date, default: Date.now },
  activa:           { type: Boolean, default: true },
  notas:            String,
}, { timestamps: true });
const Bolsa = mongoose.model('Bolsa', bolsaSchema);

/** Detalle de un dulce dentro de una venta diaria */
const detalleSchema = new mongoose.Schema({
  candyId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Candy' },
  nombreDulce:    String,
  cantidadVendida:{ type: Number, default: 0 },
  precioUnitario: Number,
  subtotal:       Number,
});

/** Registro de ventas de un día */
const ventaSchema = new mongoose.Schema({
  fecha:              { type: Date, default: Date.now },
  diaSemana:          Number,   // 0=Dom … 6=Sáb
  source:             { type: String, enum: ['admin', 'companera'], default: 'admin' },
  paymentMethod:      { type: String, enum: ['efectivo', 'transferencia'], default: 'efectivo' },
  detalles:           [detalleSchema],
  totalEsperado:      { type: Number, required: true },
  totalRecibido:      { type: Number, required: true },
  diferencia:         Number,   // recibido - esperado (+ = sobrante, - = faltante)
  comisionCalculada:  Number,   // totalEsperado * 0.12
  semanaId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Semana' },
  notas:              String,
}, { timestamps: true });
const Venta = mongoose.model('Venta', ventaSchema);

/** Semana de trabajo (Lun 00:00 → Vie 23:59) */
const semanaSchema = new mongoose.Schema({
  fechaInicio:   { type: Date, required: true },
  fechaFin:      { type: Date, required: true },
  totalVentas:   { type: Number, default: 0 },
  totalComision: { type: Number, default: 0 },
  numeroDias:    { type: Number, default: 0 },
  pagado:        { type: Boolean, default: false },
  fechaPago:     Date,
}, { timestamps: true });
const Semana = mongoose.model('Semana', semanaSchema);

/**
 * Distribución = Producto entregado a la compañera de ventas.
 * Se registra: qué dulce, cuántas piezas, cuándo.
 * Se estima cuánta ganancia devería regresar basado en precio unitario.
 */
const distribucionSchema = new mongoose.Schema({
  fecha:             { type: Date, default: Date.now },
  candyId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Candy', required: true },
  cantidad:          { type: Number, required: true, min: 1 },
  precioUnitario:    { type: Number, required: true, min: 0 },
  subtotal:          { type: Number, required: true },        // cantidad * precioUnitario (costo)
  gananciasEsperada: { type: Number, required: true },        // subtotal * 0.12 (12% comisión)
  montoDevuelto:     { type: Number, default: 0 },            // dinero que la compañera devolvió
  pagado:            { type: Boolean, default: false },
  notas:             String,
  semanaId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Semana' },
}, { timestamps: true });
const Distribucion = mongoose.model('Distribucion', distribucionSchema);

/**
 * ProductoAgotado = Registro histórico de productos que se agotaron.
 * Guarda información de bolsas/distribuciones archivadas con fecha exacta de agotamiento.
 */
const productoAgotadoSchema = new mongoose.Schema({
  tipo:              { type: String, enum: ['bolsa', 'distribucion'], required: true },
  candyId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Candy', required: true },
  nombreDulce:       String,
  cantidad:          { type: Number, required: true },        // piezas totales o cantidad entregada
  costoTotal:        { type: Number, default: 0 },            // para bolsas
  precioUnitario:    { type: Number, default: 0 },
  dineroRecuperado:  { type: Number, default: 0 },            // para bolsas
  gananciaAcumulada: { type: Number, default: 0 },            // para bolsas
  fechaAgotamiento:  { type: Date, default: Date.now },       // cuándo se agotó
  fechaCompra:       { type: Date },                           // para bolsas (cuándo se compró)
  semana:            String,                                  // "2026-W17" o similar
  bolsaId:           mongoose.Schema.Types.ObjectId,          // referencia a la bolsa (si aplica)
  distribucionId:    mongoose.Schema.Types.ObjectId,          // referencia a la distribución (si aplica)
  notas:             String,
}, { timestamps: true });
const ProductoAgotado = mongoose.model('ProductoAgotado', productoAgotadoSchema);

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function getWeekBounds(date = new Date()) {
  const day = date.getDay();                        // 0=Dom
  const daysFromMon = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setDate(monday.getDate() - daysFromMon);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

async function getOrCreateCurrentWeek() {
  const { monday, friday } = getWeekBounds();
  let semana = await Semana.findOne({ fechaInicio: monday, pagado: false });
  if (!semana) semana = await Semana.create({ fechaInicio: monday, fechaFin: friday });
  return semana;
}

function recalcBolsaFinanzas(bolsa, precioUnitario) {
  bolsa.dineroRecuperado = parseFloat((bolsa.piezasVendidas * precioUnitario).toFixed(2));
  bolsa.gananciaAcumulada = parseFloat((bolsa.dineroRecuperado - bolsa.costoTotal).toFixed(2));
  bolsa.recuperada = bolsa.dineroRecuperado >= bolsa.costoTotal;
}

/**
 * Actualiza inventario FIFO al registrar una venta.
 * - source=admin: descuenta de piezas disponibles.
 * - source=companera: mueve piezas de entregadas -> vendidas.
 */
async function updateBolsas(candyId, cantidadVendida, precioUnitario, source = 'admin') {
  const bolsas = await Bolsa.find({ candyId, activa: true }).sort('fechaCompra');

  let restante = cantidadVendida;

  if (source === 'companera') {
    for (const b of bolsas) {
      if (restante <= 0) break;
      if (!b.piezasEntregadas || b.piezasEntregadas <= 0) continue;
      const deEsta = Math.min(restante, b.piezasEntregadas);
      b.piezasEntregadas -= deEsta;
      b.piezasVendidas += deEsta;
      recalcBolsaFinanzas(b, precioUnitario);
      await b.save();
      restante -= deEsta;
    }
  }

  // Fallback: si faltan piezas por registrar, toma de las disponibles.
  for (const b of bolsas) {
    if (restante <= 0) break;
    const usadas = (b.piezasVendidas || 0) + (b.piezasEntregadas || 0);
    const disponibles = Math.max(0, (b.piezasTotales || 0) - usadas);
    if (disponibles <= 0) continue;

    const deEsta = Math.min(restante, disponibles);
    b.piezasVendidas += deEsta;
    recalcBolsaFinanzas(b, precioUnitario);
    await b.save();
    restante -= deEsta;
  }

  if (restante > 0) {
    console.warn(`⚠️ Stock insuficiente al registrar venta de ${candyId}. Faltó registrar: ${restante}`);
  }
}

/**
 * Actualiza inventario de bolsas al registrar una DISTRIBUCIÓN a la compañera.
 * Marca piezas como entregadas (no vendidas aún).
 */
async function addDistribution(candyId, cantidadEntregada) {
  const bolsas = await Bolsa.find({
    candyId,
    activa: true,
    $expr: { $lt: [
      { $add: ['$piezasVendidas', '$piezasEntregadas'] },
      '$piezasTotales'
    ] },
  }).sort('fechaCompra');

  let restante = cantidadEntregada;
  for (const b of bolsas) {
    if (restante <= 0) break;
    const usadas = b.piezasVendidas + b.piezasEntregadas;
    const disponibles = b.piezasTotales - usadas;
    const deEsta = Math.min(restante, disponibles);
    b.piezasEntregadas += deEsta;
    await b.save();
    restante -= deEsta;
  }
}

function addToMap(map, key, value) {
  if (!key) return;
  map[key] = (map[key] || 0) + value;
}

async function getCompaneraStockSummary() {
  const candies = await Candy.find({ activo: true }).sort('nombre').select('_id nombre precioUnitario');
  const distribuciones = await Distribucion.find().select('candyId cantidad');
  const ventas = await Venta.find({ source: 'companera' }).select('detalles');

  const entregadasPorCandy = {};
  for (const d of distribuciones) {
    addToMap(entregadasPorCandy, d.candyId?.toString(), d.cantidad || 0);
  }

  const vendidasPorCandy = {};
  for (const v of ventas) {
    for (const det of v.detalles || []) {
      addToMap(vendidasPorCandy, det.candyId?.toString(), det.cantidadVendida || 0);
    }
  }

  return candies.map(c => {
    const candyId = c._id.toString();
    const totalEntregadas = entregadasPorCandy[candyId] || 0;
    const vendidas = vendidasPorCandy[candyId] || 0;
    const disponibles = Math.max(0, totalEntregadas - vendidas);
    return {
      candyId,
      nombre: c.nombre,
      precioUnitario: c.precioUnitario,
      totalEntregadas,
      vendidas,
      disponibles,
    };
  }).filter(r => r.totalEntregadas > 0);
}

async function reconcileBolsasFromHistory() {
  const candies = await Candy.find({ activo: true }).select('_id precioUnitario');
  const distribuciones = await Distribucion.find().select('candyId cantidad');
  const ventas = await Venta.find().select('source detalles');

  const entregadasPorCandy = {};
  for (const d of distribuciones) {
    addToMap(entregadasPorCandy, d.candyId?.toString(), d.cantidad || 0);
  }

  const vendidasCompaneraPorCandy = {};
  const vendidasAdminPorCandy = {};
  for (const v of ventas) {
    for (const det of v.detalles || []) {
      const id = det.candyId?.toString();
      const qty = det.cantidadVendida || 0;
      if (!id || qty <= 0) continue;
      if (v.source === 'companera') addToMap(vendidasCompaneraPorCandy, id, qty);
      else addToMap(vendidasAdminPorCandy, id, qty);
    }
  }

  let bolsasActualizadas = 0;
  for (const candy of candies) {
    const candyId = candy._id.toString();
    const bolsas = await Bolsa.find({ candyId, activa: true }).sort('fechaCompra');
    if (!bolsas.length) continue;

    const totalEntregadas = entregadasPorCandy[candyId] || 0;
    const totalVendidasCompanera = vendidasCompaneraPorCandy[candyId] || 0;
    const totalVendidasAdmin = vendidasAdminPorCandy[candyId] || 0;

    let porAsignarVendidas = totalVendidasCompanera + totalVendidasAdmin;
    let porAsignarEntregadas = Math.max(0, totalEntregadas - totalVendidasCompanera);

    for (const b of bolsas) {
      b.piezasVendidas = 0;
      b.piezasEntregadas = 0;
      b.dineroRecuperado = 0;
      b.gananciaAcumulada = 0;
      b.recuperada = false;
    }

    for (const b of bolsas) {
      if (porAsignarVendidas <= 0) break;
      const deEsta = Math.min(porAsignarVendidas, b.piezasTotales || 0);
      b.piezasVendidas = deEsta;
      porAsignarVendidas -= deEsta;
    }

    for (const b of bolsas) {
      if (porAsignarEntregadas <= 0) break;
      const capacidad = Math.max(0, (b.piezasTotales || 0) - (b.piezasVendidas || 0));
      if (capacidad <= 0) continue;
      const deEsta = Math.min(porAsignarEntregadas, capacidad);
      b.piezasEntregadas = deEsta;
      porAsignarEntregadas -= deEsta;
    }

    for (const b of bolsas) {
      recalcBolsaFinanzas(b, candy.precioUnitario || 0);
      await b.save();
      bolsasActualizadas += 1;
    }
  }

  return { ok: true, bolsasActualizadas };
}

// Dispara backup automático en cada escritura HTTP exitosa.
app.use('/api', (req, res, next) => {
  if (!BACKUP_ON_WRITE) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      scheduleMongoBackup(`${req.method} ${req.originalUrl}`);
    }
  });

  next();
});

// ─────────────────────────────────────────────
//  ROUTE: SEED
// ─────────────────────────────────────────────
app.post('/api/seed', async (req, res) => {
  try {
    /*
     * Precios sugeridos calculados con margen ~50-130% sobre costo/pieza.
     * El usuario puede modificarlos en la sección "Catálogo".
     */
    const dulces = [
      { nombre: 'Palitos Hot Chili',  piezasPorBolsa: 25,  costoPorBolsa: 24,   precioUnitario: 2   },
      { nombre: 'Chidas Donitas',     piezasPorBolsa: 10,  costoPorBolsa: 48,   precioUnitario: 8   },
      { nombre: 'Trueno Pop',         piezasPorBolsa: 50,  costoPorBolsa: 43.5, precioUnitario: 2   },
      { nombre: 'Bubalo',             piezasPorBolsa: 47,  costoPorBolsa: 44.5, precioUnitario: 2   },
      { nombre: 'Oblea Coronado',     piezasPorBolsa: 10,  costoPorBolsa: 19.5, precioUnitario: 3   },
      { nombre: 'Carlos V',           piezasPorBolsa: 20,  costoPorBolsa: 54.5, precioUnitario: 5   },
      { nombre: 'Pelón Mini',         piezasPorBolsa: 18,  costoPorBolsa: 59.5, precioUnitario: 5   },
      { nombre: 'PicaGomas',          piezasPorBolsa: 100, costoPorBolsa: 65.5, precioUnitario: 1.5 },
      { nombre: 'Rica Sandía',        piezasPorBolsa: 40,  costoPorBolsa: 55,   precioUnitario: 3   },
      { nombre: 'Chipileta',          piezasPorBolsa: 30,  costoPorBolsa: 69.5, precioUnitario: 4   },
      { nombre: 'papas fuego caseras',      piezasPorBolsa: 10, costoPorBolsa: 51,   precioUnitario: 9.5 },
      { nombre: 'Kiubo Re mix',             piezasPorBolsa: 10, costoPorBolsa: 47,   precioUnitario: 8.5 },
      { nombre: 'Pulparindos',              piezasPorBolsa: 20, costoPorBolsa: 43.5, precioUnitario: 4.5 },
      { nombre: 'papas chidas Salsa negra', piezasPorBolsa: 5,  costoPorBolsa: 74,   precioUnitario: 27  },
    ];

    let insertados = 0;
    for (const dulce of dulces) {
      const result = await Candy.updateOne(
        { nombre: dulce.nombre },
        { $setOnInsert: dulce },
        { upsert: true }
      );
      insertados += result.upsertedCount || 0;
    }

    res.json({
      ok: true,
      msg: insertados > 0
        ? `${insertados} dulces agregados`
        : 'No había dulces nuevos para agregar',
      insertados,
      total: dulces.length,
      dulces,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─────────────────────────────────────────────
//  ROUTES: CANDIES (Catálogo)
// ─────────────────────────────────────────────
app.get('/api/candies', async (req, res) => {
  try {
    const candies = await Candy.find({ activo: true }).sort('nombre');
    res.json(candies);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/candies', async (req, res) => {
  try {
    const candy = await Candy.create(req.body);
    res.status(201).json(candy);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/candies/:id', async (req, res) => {
  try {
    const candy = await Candy.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!candy) return res.status(404).json({ error: 'No encontrado' });
    res.json(candy);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/candies/:id', async (req, res) => {
  try {
    await Candy.findByIdAndUpdate(req.params.id, { activo: false });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** Cálculo de precios sugeridos con análisis de margen */
app.get('/api/candies/precios-sugeridos', async (req, res) => {
  try {
    const candies = await Candy.find({ activo: true });
    const sugerencias = candies.map(c => {
      const cpp = c.costoPorBolsa / c.piezasPorBolsa;
      let precio;
      if (cpp < 1)   precio = 2;
      else if (cpp < 2)   precio = Math.ceil(cpp * 2.5 * 2) / 2;
      else if (cpp < 3.5) precio = Math.ceil(cpp * 2.0 * 2) / 2;
      else                precio = Math.ceil(cpp * 1.8 * 2) / 2;

      const ingresoBruto = precio * c.piezasPorBolsa;
      return {
        _id: c._id,
        nombre: c.nombre,
        costoPorPieza:   +cpp.toFixed(2),
        precioActual:    c.precioUnitario,
        precioSugerido:  precio,
        ingresoBruto:    +ingresoBruto.toFixed(2),
        gananciaTotal:   +(ingresoBruto - c.costoPorBolsa).toFixed(2),
        margen:          +(((ingresoBruto - c.costoPorBolsa) / c.costoPorBolsa) * 100).toFixed(1),
        piezasPorBolsa:  c.piezasPorBolsa,
      };
    });
    res.json(sugerencias);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  ROUTES: BOLSAS (Inventario)
// ─────────────────────────────────────────────
app.get('/api/bolsas', async (req, res) => {
  try {
    const bolsas = await Bolsa.find({ activa: true }).populate('candyId').sort('-fechaCompra');
    res.json(bolsas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bolsas', async (req, res) => {
  try {
    const { candyId, cantidadBolsas = 1, notas } = req.body;
    const candy = await Candy.findById(candyId);
    if (!candy) return res.status(404).json({ error: 'Dulce no encontrado' });

    const bolsa = await Bolsa.create({
      candyId,
      cantidadBolsas: +cantidadBolsas,
      costoTotal:    candy.costoPorBolsa  * cantidadBolsas,
      piezasTotales: candy.piezasPorBolsa * cantidadBolsas,
      notas,
    });
    await bolsa.populate('candyId');
    res.status(201).json(bolsa);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/bolsas/:id', async (req, res) => {
  try {
    await Bolsa.findByIdAndUpdate(req.params.id, { activa: false });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  ROUTES: VENTAS
// ─────────────────────────────────────────────
app.get('/api/ventas', async (req, res) => {
  try {
    const { limite = 50 } = req.query;
    const ventas = await Venta.find().sort('-fecha').limit(+limite);
    res.json(ventas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ventas/hoy', async (req, res) => {
  try {
    const { start: inicio, end: fin } = getZonedDayBounds();
    const ventas = await Venta.find({ fecha: { $gte: inicio, $lte: fin } }).sort('-fecha');
    const totales = ventas.reduce((acc, v) => ({
      esperado:   acc.esperado   + v.totalEsperado,
      recibido:   acc.recibido   + v.totalRecibido,
      diferencia: acc.diferencia + v.diferencia,
      comision:   acc.comision   + v.comisionCalculada,
    }), { esperado: 0, recibido: 0, diferencia: 0, comision: 0 });
    res.json({ ventas, totales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ventas', async (req, res) => {
  try {
    const { detalles, totalRecibido, notas, paymentMethod = 'efectivo' } = req.body;
    if (!detalles?.length) return res.status(400).json({ error: 'Sin detalles de venta' });

    const semana = await getOrCreateCurrentWeek();
    const ahora  = new Date();
    let totalEsperado = 0;
    const detallesOk = [];

    for (const d of detalles) {
      if (!d.cantidadVendida || +d.cantidadVendida <= 0) continue;
      const candy = await Candy.findById(d.candyId);
      if (!candy) continue;
      const subtotal = +d.cantidadVendida * candy.precioUnitario;
      totalEsperado += subtotal;
      detallesOk.push({
        candyId:         candy._id,
        nombreDulce:     candy.nombre,
        cantidadVendida: +d.cantidadVendida,
        precioUnitario:  candy.precioUnitario,
        subtotal,
      });
    }

    if (totalEsperado === 0) return res.status(400).json({ error: 'No hay dulces para registrar' });

    const diferencia         = parseFloat((totalRecibido - totalEsperado).toFixed(2));
    const comisionCalculada  = parseFloat((totalEsperado * 0.12).toFixed(2));

    const venta = await Venta.create({
      fecha: ahora,
      diaSemana: ahora.getDay(),
      detalles: detallesOk,
      paymentMethod,
      totalEsperado,
      totalRecibido: +totalRecibido,
      diferencia,
      comisionCalculada,
      semanaId: semana._id,
      notas,
    });

    // Actualizar totales de semana
    await Semana.findByIdAndUpdate(semana._id, {
      $inc: { totalVentas: totalEsperado, totalComision: comisionCalculada, numeroDias: 1 },
    });

    // Actualizar inventario FIFO
    for (const d of detallesOk) {
      await updateBolsas(d.candyId, d.cantidadVendida, d.precioUnitario, 'admin');
    }

    res.status(201).json(venta);
  } catch (e) {
    console.error('POST /api/ventas:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  DELETE VENTA: Revertir inventario y semana
// ─────────────────────────────────────────────
app.delete('/api/ventas/:id', async (req, res) => {
  try {
    const venta = await Venta.findById(req.params.id);
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    // 1. Revertir piezasVendidas en bolsas (FIFO inverso)
    for (const d of venta.detalles) {
      if (!d.cantidadVendida || d.cantidadVendida <= 0) continue;
      const candy = await Candy.findById(d.candyId);
      if (!candy) continue;

      const bolsas = await Bolsa.find({
        candyId: d.candyId,
        activa: true,
        piezasVendidas: { $gt: 0 },
      }).sort('-fechaCompra');

      let restante = d.cantidadVendida;
      for (const b of bolsas) {
        if (restante <= 0) break;
        const devolver = Math.min(restante, b.piezasVendidas);
        b.piezasVendidas   -= devolver;
        b.dineroRecuperado  = parseFloat((b.piezasVendidas * d.precioUnitario).toFixed(2));
        b.gananciaAcumulada = b.piezasVendidas > 0
          ? parseFloat((b.dineroRecuperado - b.costoTotal).toFixed(2))
          : 0;
        b.recuperada        = b.dineroRecuperado >= b.costoTotal;
        await b.save();
        restante -= devolver;
      }
    }

    // 2. Revertir totales de la semana
    if (venta.semanaId) {
      await Semana.findByIdAndUpdate(venta.semanaId, {
        $inc: {
          totalVentas:   -venta.totalEsperado,
          totalComision: -venta.comisionCalculada,
          numeroDias:    -1,
        },
      });
    }

    // 3. Eliminar la venta
    await Venta.findByIdAndDelete(req.params.id);

    res.json({ ok: true, msg: 'Venta eliminada y stock restaurado' });
  } catch (e) {
    console.error('DELETE /api/ventas:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  ROUTES: DISTRIBUCIONES (Entregas a Compañera)
// ─────────────────────────────────────────────
app.get('/api/distribuciones', async (req, res) => {
  try {
    const { limite = 100 } = req.query;
    const distribuciones = await Distribucion.find()
      .populate('candyId')
      .sort('-fecha')
      .limit(+limite);
    res.json(distribuciones);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/distribuciones/hoy', async (req, res) => {
  try {
    const { start: inicio, end: fin } = getZonedDayBounds();
    const distribuciones = await Distribucion.find({ fecha: { $gte: inicio, $lte: fin } })
      .populate('candyId')
      .sort('-fecha');
    const totales = distribuciones.reduce((acc, d) => ({
      cantidad:         acc.cantidad + d.cantidad,
      subtotal:         acc.subtotal + d.subtotal,
      gananciasEsperada: acc.gananciasEsperada + d.gananciasEsperada,
      montoDevuelto:    acc.montoDevuelto + d.montoDevuelto,
    }), { cantidad: 0, subtotal: 0, gananciasEsperada: 0, montoDevuelto: 0 });
    res.json({ distribuciones, totales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/distribuciones/stock', async (req, res) => {
  try {
    const stock = await getCompaneraStockSummary();
    res.json(stock);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/distribuciones', async (req, res) => {
  try {
    const { candyId, cantidad, notas } = req.body;
    if (!candyId || !cantidad || +cantidad <= 0) {
      return res.status(400).json({ error: 'Faltan datos: candyId, cantidad' });
    }

    const candy = await Candy.findById(candyId);
    if (!candy) return res.status(404).json({ error: 'Dulce no encontrado' });

    const semana = await getOrCreateCurrentWeek();
    const precioUnitario = candy.precioUnitario;
    const subtotal = parseFloat((cantidad * precioUnitario).toFixed(2));
    const gananciasEsperada = parseFloat((subtotal * 0.12).toFixed(2));  // 12%

    const distribucion = await Distribucion.create({
      fecha: new Date(),
      candyId,
      cantidad: +cantidad,
      precioUnitario,
      subtotal,
      gananciasEsperada,
      semanaId: semana._id,
      notas,
    });

    // Marcar como entregadas a la compañera (NO vendidas aún)
    await addDistribution(candyId, +cantidad);

    await distribucion.populate('candyId');
    res.status(201).json(distribucion);
  } catch (e) {
    console.error('POST /api/distribuciones:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Quita piezas entregadas del inventario cuando se cancela una distribución.
 */
async function removeDistribution(candyId, cantidadEntregada) {
  const bolsas = await Bolsa.find({
    candyId,
    activa: true,
  }).sort('-fechaCompra');

  let restante = cantidadEntregada;
  for (const b of bolsas) {
    if (restante <= 0) break;
    const aRestar = Math.min(restante, b.piezasEntregadas);
    b.piezasEntregadas -= aRestar;
    await b.save();
    restante -= aRestar;
  }
}

app.delete('/api/distribuciones/:id', async (req, res) => {
  try {
    const distribucion = await Distribucion.findByIdAndDelete(req.params.id);
    if (!distribucion) return res.status(404).json({ error: 'No encontrada' });
    
    // Revertir las piezas entregadas en el inventario
    await removeDistribution(distribucion.candyId, distribucion.cantidad);
    
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/distribuciones/:id', async (req, res) => {
  try {
    const { montoDevuelto, notas } = req.body;
    const previa = await Distribucion.findById(req.params.id);
    if (!previa) return res.status(404).json({ error: 'No encn ontrada' });
    const distribucion = await Distribucion.findByIdAndUpdate(
      req.params.id,
      { montoDevuelto: +montoDevuelto, notas, pagado: +montoDevuelto >= previa.gananciasEsperada },
      { new: true }
    );
    await distribucion.populate('candyId');
    res.json(distribucion);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/**
 * MIGRATION: Corrige datos antiguos donde distribuciones (sin vender)
 * estaban en piezasVendidas. Las mueve a piezasEntregadas si dineroRecuperado == 0.
 */
app.post('/api/bolsas/migrate', async (req, res) => {
  try {
    const bolsas = await Bolsa.find({ dineroRecuperado: 0, piezasVendidas: { $gt: 0 } });
    let corregidas = 0;
    for (const b of bolsas) {
      b.piezasEntregadas = (b.piezasEntregadas || 0) + b.piezasVendidas;
      b.piezasVendidas = 0;
      await b.save();
      corregidas++;
    }
    res.json({ ok: true, msg: `${corregidas} bolsas corregidas`, actualizadas: corregidas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/bolsas/reconciliar', async (req, res) => {
  try {
    const result = await reconcileBolsasFromHistory();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  ROUTES: SEMANAS
// ─────────────────────────────────────────────
app.get('/api/semanas', async (req, res) => {
  try {
    const semanas = await Semana.find().sort('-fechaInicio').limit(12);
    res.json(semanas);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/semanas/actual', async (req, res) => {
  try {
    const semana = await getOrCreateCurrentWeek();
    const ventas = await Venta.find({ semanaId: semana._id }).sort('fecha');
    res.json({ semana, ventas });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/semanas/:id/cerrar', async (req, res) => {
  try {
    const semana = await Semana.findByIdAndUpdate(
      req.params.id,
      { pagado: true, fechaPago: new Date() },
      { new: true }
    );
    if (!semana) return res.status(404).json({ error: 'Semana no encontrada' });
    res.json(semana);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  ROUTE: DASHBOARD
// ─────────────────────────────────────────────
app.get('/api/dashboard', async (req, res) => {
  try {
    const { start: inicio, end: fin } = getZonedDayBounds();

    const ventasHoy = await Venta.find({ fecha: { $gte: inicio, $lte: fin } });
    const totalHoy     = ventasHoy.reduce((a, v) => a + v.totalEsperado, 0);
    const comisionHoy  = ventasHoy.reduce((a, v) => a + v.comisionCalculada, 0);
    const recibidoHoy  = ventasHoy.reduce((a, v) => a + v.totalRecibido, 0);

    const semana = await getOrCreateCurrentWeek();

    const bolsas = await Bolsa.find({ activa: true }).populate('candyId').sort('fechaCompra');

    // Ventas últimos 7 días para gráfica
    const hace7 = new Date(inicio.getTime() - (6 * 24 * 60 * 60 * 1000));
    const ventas7 = await Venta.find({ fecha: { $gte: hace7 } });
    const porDia = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(hace7.getTime() + (i * 24 * 60 * 60 * 1000));
      porDia[getZonedDateKey(d)] = 0;
    }
    for (const v of ventas7) {
      const k = getZonedDateKey(v.fecha);
      if (k in porDia) porDia[k] += v.totalEsperado;
    }

    res.json({
      hoy: {
        totalVentas: +totalHoy.toFixed(2),
        recibido:    +recibidoHoy.toFixed(2),
        comision:    +comisionHoy.toFixed(2),
        registros:   ventasHoy.length,
      },
      semana: {
        _id:          semana._id,
        inicio:       semana.fechaInicio,
        fin:          semana.fechaFin,
        totalVentas:  semana.totalVentas,
        totalComision:semana.totalComision,
        numeroDias:   semana.numeroDias,
        pagado:       semana.pagado,
      },
      bolsas: bolsas.map(b => ({
        _id:               b._id,
        nombre:            b.candyId?.nombre || '—',
        costoTotal:        b.costoTotal,
        piezasTotales:     b.piezasTotales,
        piezasVendidas:    b.piezasVendidas,
        dineroRecuperado:  b.dineroRecuperado,
        gananciaAcumulada: b.gananciaAcumulada,
        recuperada:        b.recuperada,
        porcentaje:        Math.min(100, +(b.dineroRecuperado / b.costoTotal * 100).toFixed(1)),
        fechaCompra:       b.fechaCompra,
      })),
      grafica7dias: Object.entries(porDia).map(([fecha, total]) => ({ fecha, total: +total.toFixed(2) })),
    });
  } catch (e) {
    console.error('GET /api/dashboard:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
//  ROUTE: RECOMENDACIONES IA
//  Algoritmo: EMA por día-de-semana + promedio
//  general como fallback + buffer de seguridad
// ─────────────────────────────────────────────
app.get('/api/recomendaciones', async (req, res) => {
  try {
    const candies = await Candy.find({ activo: true });
    const hace30  = new Date(); hace30.setDate(hace30.getDate() - 30);

    // Solo ventas de Lun-Vie
    const ventas = await Venta.find({
      fecha:     { $gte: hace30 },
      diaSemana: { $gte: 1, $lte: 5 },
    });

    const hoyDia  = new Date().getDay();
    const ALPHA   = 0.4;  // factor de suavizado EMA

    const recomendaciones = candies.map(candy => {
      const porDia = {};   // { diaSemana: [cantidades] }
      let totalVendido = 0, diasConVenta = 0;

      for (const v of ventas) {
        const det = v.detalles.find(d => d.candyId?.toString() === candy._id.toString());
        if (det && det.cantidadVendida > 0) {
          (porDia[v.diaSemana] = porDia[v.diaSemana] || []).push(det.cantidadVendida);
          totalVendido += det.cantidadVendida;
          diasConVenta++;
        }
      }

      let cantidad = 10, confianza = 'Sin datos', razon = 'Sin historial. Cantidad base sugerida.';

      if (diasConVenta >= 2) {
        const promGeneral = totalVendido / diasConVenta;

        if (porDia[hoyDia]?.length >= 2) {
          // EMA sobre el día específico de la semana
          const datos = porDia[hoyDia];
          let ema = datos[0];
          for (let i = 1; i < datos.length; i++) ema = ALPHA * datos[i] + (1 - ALPHA) * ema;
          cantidad   = Math.ceil(ema * 1.15);
          confianza  = datos.length >= 4 ? 'Alta' : 'Media';
          razon      = `EMA α=0.4 sobre ${datos.length} ${DIAS[hoyDia]}s · buffer +15%`;
        } else {
          cantidad   = Math.ceil(promGeneral * 1.20);
          confianza  = diasConVenta >= 5 ? 'Media' : 'Baja';
          razon      = `Promedio general (${diasConVenta} días) · buffer +20%`;
        }
      }

      // Límites razonables
      cantidad = Math.max(3, Math.min(cantidad, candy.piezasPorBolsa * 3));

      return {
        candyId:         candy._id,
        nombre:          candy.nombre,
        precioUnitario:  candy.precioUnitario,
        piezasPorBolsa:  candy.piezasPorBolsa,
        cantidad,
        ingresoEstimado: +(cantidad * candy.precioUnitario).toFixed(2),
        confianza,
        razon,
        diasConDatos:    diasConVenta,
      };
    });

    const totalEstimado = +recomendaciones.reduce((a, r) => a + r.ingresoEstimado, 0).toFixed(2);
    res.json({
      recomendaciones,
      totalEstimado,
      diaAnalizado: DIAS[hoyDia],
      fecha: new Date(),
      algoritmo: 'EMA (α=0.4) por día-de-semana + fallback promedio general',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  ROUTES: COMPAÑERA (Vista vendedora)
//  Estos endpoints son los que usa indexv.html
// ─────────────────────────────────────────────

const COMPANERA_API_KEY = process.env.COMPANERA_API_KEY || '';

app.use('/api/companera', (req, res, next) => {
  if (!COMPANERA_API_KEY) return next();
  const apiKey = req.headers['x-companera-key'];
  if (apiKey !== COMPANERA_API_KEY) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
});

/**
 * GET /api/companera/inventario
 * Devuelve el stock disponible para la compañera:
 * piezas entregadas - piezas ya registradas como vendidas
 */
app.get('/api/companera/inventario', async (req, res) => {
  try {
    const candies = await Candy.find({ activo: true }).sort('nombre');
    const result = [];

    for (const c of candies) {
      const distribuciones = await Distribucion.find({ candyId: c._id });
      const totalEntregadas = distribuciones.reduce((a, d) => a + d.cantidad, 0);

      const ventas = await Venta.find({
        source: 'companera',
        'detalles.candyId': c._id,
      });
      let vendidas = 0;
      for (const v of ventas) {
        const det = v.detalles.find(d => d.candyId?.toString() === c._id.toString());
        if (det) vendidas += det.cantidadVendida;
      }

      const disponibles = Math.max(0, totalEntregadas - vendidas);

      result.push({
        _id: c._id,
        nombre: c.nombre,
        precioUnitario: c.precioUnitario,
        totalEntregadas,
        vendidas,
        disponibles,
      });
    }

    res.json(result.filter(r => r.totalEntregadas > 0));
  } catch (e) {
    console.error('GET /api/companera/inventario:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/companera/venta
 * La compañera registra una venta.
 */
app.post('/api/companera/venta', async (req, res) => {
  try {
    const { detalles, totalRecibido = 0, notas, paymentMethod = 'efectivo' } = req.body;
    if (!detalles?.length) return res.status(400).json({ error: 'Sin detalles de venta' });

    const semana = await getOrCreateCurrentWeek();
    const ahora  = new Date();
    let totalEsperado = 0;
    const detallesOk = [];

    for (const d of detalles) {
      if (!d.cantidadVendida || +d.cantidadVendida <= 0) continue;
      const candy = await Candy.findById(d.candyId);
      if (!candy) continue;
      const subtotal = +d.cantidadVendida * candy.precioUnitario;
      totalEsperado += subtotal;
      detallesOk.push({
        candyId:         candy._id,
        nombreDulce:     candy.nombre,
        cantidadVendida: +d.cantidadVendida,
        precioUnitario:  candy.precioUnitario,
        subtotal,
      });
    }

    if (totalEsperado === 0) return res.status(400).json({ error: 'No hay dulces para registrar' });

    const diferencia        = parseFloat((+totalRecibido - totalEsperado).toFixed(2));
    const comisionCalculada = parseFloat((totalEsperado * 0.12).toFixed(2));

    const venta = await Venta.create({
      fecha: ahora,
      diaSemana: ahora.getDay(),
      source: 'companera',
      paymentMethod,
      detalles: detallesOk,
      totalEsperado,
      totalRecibido: +totalRecibido,
      diferencia,
      comisionCalculada,
      semanaId: semana._id,
      notas,
    });

    await Semana.findByIdAndUpdate(semana._id, {
      $inc: { totalVentas: totalEsperado, totalComision: comisionCalculada, numeroDias: 1 },
    });

    for (const d of detallesOk) {
      await updateBolsas(d.candyId, d.cantidadVendida, d.precioUnitario, 'companera');
    }

    res.status(201).json(venta);
  } catch (e) {
    console.error('POST /api/companera/venta:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/companera/ventas/hoy
 * Las ventas de hoy + totales
 */
app.get('/api/companera/ventas/hoy', async (req, res) => {
  try {
    const { start: inicio, end: fin } = getZonedDayBounds();
    const ventas = await Venta.find({
      source: 'companera',
      fecha: { $gte: inicio, $lte: fin },
    }).sort('-fecha');
    const totales = ventas.reduce((acc, v) => ({
      esperado: acc.esperado + v.totalEsperado,
      comision: acc.comision + v.comisionCalculada,
    }), { esperado: 0, comision: 0 });
    res.json({ ventas, totales });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/**
 * GET /api/companera/comision
 * Comisión acumulada de la semana actual
 */
app.get('/api/companera/comision', async (req, res) => {
  try {
    const semana = await getOrCreateCurrentWeek();
    const { start: inicio, end: fin } = getZonedDayBounds();
    const ventasHoy = await Venta.find({
      source: 'companera',
      fecha: { $gte: inicio, $lte: fin },
    });
    const ventasSemana = await Venta.find({
      source: 'companera',
      semanaId: semana._id,
    });

    const totalVentasSemana = ventasSemana.reduce((a, v) => a + v.totalEsperado, 0);
    const totalComisionSemana = ventasSemana.reduce((a, v) => a + v.comisionCalculada, 0);
    const comisionHoy = ventasHoy.reduce((a, v) => a + v.comisionCalculada, 0);

    res.json({
      semana: {
        totalVentas:   +totalVentasSemana.toFixed(2),
        totalComision: +totalComisionSemana.toFixed(2),
        numeroDias:    new Set(ventasSemana.map(v => new Date(v.fecha).toDateString())).size,
        inicio:        semana.fechaInicio,
        fin:           semana.fechaFin,
      },
      hoy: {
        comision: +comisionHoy.toFixed(2),
        ventas:   ventasHoy.length,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────
//  CATCH-ALL → frontend
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
//  RUTAS: ARCHIVO DE PRODUCTOS AGOTADOS
// ─────────────────────────────────────────────

/**
 * GET /api/agotados
 * Lista todos los productos agotados, filtrados por tipo, fecha, etc.
 */
app.get('/api/agotados', async (req, res) => {
  try {
    const { tipo, dulce, mes, anio } = req.query;
    let filtro = {};

    if (tipo && ['bolsa', 'distribucion'].includes(tipo)) {
      filtro.tipo = tipo;
    }
    if (dulce) {
      // Evitar invocar la clase ObjectId como función (lanza "Class constructor ObjectId...")
      // Mongoose acepta strings como valores de filtro para _id, por lo que simplemente
      // usamos el id recibido si es válido. Si no es válido, omitimos el filtro.
      if (mongoose.Types.ObjectId.isValid(dulce)) {
        filtro.candyId = dulce;
      }
    }
    if (mes && anio) {
      const start = new Date(anio, mes - 1, 1);
      const end = new Date(anio, mes, 0, 23, 59, 59, 999);
      filtro.fechaAgotamiento = { $gte: start, $lte: end };
    }

    const agotados = await ProductoAgotado
      .find(filtro)
      .populate('candyId', 'nombre')
      .sort({ fechaAgotamiento: -1 })
      .lean();

    res.json(agotados);
  } catch (err) {
    console.error('GET /api/agotados ERROR', { query: req.query, stack: err.stack || err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/agotados/archivar-bolsa/:bolsaId
 * Archiva una bolsa agotada.
 */
app.post('/api/agotados/archivar-bolsa/:bolsaId', async (req, res) => {
  try {
    // Validar que el ID sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(req.params.bolsaId)) {
      return res.status(400).json({ error: 'ID de bolsa inválido' });
    }

    const bolsa = await Bolsa.findById(req.params.bolsaId).populate('candyId');
    if (!bolsa) return res.status(404).json({ error: 'Bolsa no encontrada' });

    const semanaNum = new Date(bolsa.fechaCompra).toISOString().split('W')[1] || '';
    const year = new Date(bolsa.fechaCompra).getFullYear();

    const agotado = await ProductoAgotado.create({
      tipo: 'bolsa',
      candyId: bolsa.candyId._id,
      nombreDulce: bolsa.candyId.nombre,
      cantidad: bolsa.piezasTotales,
      costoTotal: bolsa.costoTotal,
      precioUnitario: bolsa.candyId.precioUnitario,
      dineroRecuperado: bolsa.dineroRecuperado,
      gananciaAcumulada: bolsa.gananciaAcumulada,
      fechaAgotamiento: new Date(),
      fechaCompra: bolsa.fechaCompra,
      semana: `${year}-W${semanaNum}`,
      bolsaId: bolsa._id,
      notas: req.body.notas || '',
    });

    // Marcar bolsa como inactiva
    await Bolsa.findByIdAndUpdate(req.params.bolsaId, { activa: false });

    scheduleMongoBackup('archivar-bolsa');
    res.json({ ok: true, message: '✅ Bolsa archivada', agotado });
  } catch (err) {
    console.error('Error archivando bolsa:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/agotados/archivar-distribucion/:distribucionId
 * Archiva una distribución agotada.
 */
app.post('/api/agotados/archivar-distribucion/:distribucionId', async (req, res) => {
  try {
    // Validar que el ID sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(req.params.distribucionId)) {
      return res.status(400).json({ error: 'ID de distribución inválido' });
    }

    const dist = await Distribucion.findById(req.params.distribucionId).populate('candyId');
    if (!dist) return res.status(404).json({ error: 'Distribución no encontrada' });

    const semanaNum = new Date(dist.fecha).toISOString().split('W')[1] || '';
    const year = new Date(dist.fecha).getFullYear();

    const agotado = await ProductoAgotado.create({
      tipo: 'distribucion',
      candyId: dist.candyId._id,
      nombreDulce: dist.candyId.nombre,
      cantidad: dist.cantidad,
      precioUnitario: dist.precioUnitario,
      fechaAgotamiento: new Date(),
      fechaCompra: dist.fecha,
      semana: `${year}-W${semanaNum}`,
      distribucionId: dist._id,
      notas: req.body.notas || '',
    });

    // Marcar distribución como pagada/entregada
    await Distribucion.findByIdAndUpdate(req.params.distribucionId, { pagado: true });

    scheduleMongoBackup('archivar-distribucion');
    res.json({ ok: true, message: '✅ Distribución archivada', agotado });
  } catch (err) {
    console.error('Error archivando distribución:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/agotados/resumen
 * Resumen de productos agotados por mes/tipo.
 */
app.get('/api/agotados/resumen', async (req, res) => {
  try {
    const resumen = await ProductoAgotado.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$fechaAgotamiento' },
            month: { $month: '$fechaAgotamiento' },
            tipo: '$tipo',
            candyId: '$candyId',
            nombreDulce: '$nombreDulce',
          },
          cantidad: { $sum: '$cantidad' },
          dineroRecuperado: { $sum: '$dineroRecuperado' },
          ganancia: { $sum: '$gananciaAcumulada' },
          items: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
    ]);

    res.json(resumen);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/agotados/:id
 * Elimina un registro de producto agotado.
 */
app.delete('/api/agotados/:id', async (req, res) => {
  try {
    await ProductoAgotado.findByIdAndDelete(req.params.id);
    scheduleMongoBackup('eliminar-agotado');
    res.json({ message: '✅ Registro eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/vendedora', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indexv.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
console.log("🔥 LLEGÓ ANTES DE app.listen");
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server en http://0.0.0.0:${PORT}`);
});
mongoose.connection.once('open', () => {
  console.log('🟢 Mongo listo, ejecutando reconciliación de bolsas...');

  setTimeout(async () => {
    try {
      const result = await reconcileBolsasFromHistory();
      console.log(`✅ Reconciliación ejecutada (${result.bolsasActualizadas} bolsas)`);
    } catch (e) {
      console.log('⚠️ Reconciliación omitida:', e.message);
    }
  }, 500);
});