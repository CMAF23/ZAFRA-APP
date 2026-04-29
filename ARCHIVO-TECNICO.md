# 📁 Sistema de Archivo de Agotados - Resumen Técnico

## 🎯 Qué se Implementó

Tu solicitud fue: *"Quiero que los productos agotados se guarden en una carpeta/apartado organizados por fecha y tipo, registrando cuándo se agotó."*

### ✅ Solución Entregada

Un **sistema completo de archivo de productos agotados** que:

1. **Guarda productos agotados** con:
   - ✓ Fecha exacta de agotamiento
   - ✓ Tipo (bolsa comprada o distribución)
   - ✓ Producto (nombre y ID)
   - ✓ Dinero recuperado y ganancia
   - ✓ Notas opcionales

2. **Organiza los datos**:
   - ✓ Por **fecha** (más recientes primero)
   - ✓ Por **tipo** (bolsa/distribución)
   - ✓ Por **dulce específico**
   - ✓ Por **mes y año**

3. **Interfaz visual**:
   - ✓ Nueva pestaña "📁 Archivo Agotados"
   - ✓ Botones 📁 en Inventario (para bolsas)
   - ✓ Botones 📁 en Distribución (para entregas)
   - ✓ Tabla con estadísticas de resumen
   - ✓ Filtros dinámicos

---

## 📊 Estructura Técnica

### 🗄️ Base de Datos (MongoDB)

**Nueva Colección: `ProductoAgotado`**

```javascript
{
  _id: ObjectId,
  tipo: "bolsa" | "distribucion",              // Tipo de producto
  candyId: ObjectId,                            // Referencia al dulce
  nombreDulce: String,                          // "Obleas", "Klubi", etc.
  cantidad: Number,                             // Piezas totales
  costoTotal: Number,                           // $ invertido (solo bolsas)
  precioUnitario: Number,                       // Precio por pieza
  dineroRecuperado: Number,                     // $ sacado vendiendo
  gananciaAcumulada: Number,                    // dinero - costo
  fechaAgotamiento: Date,                       // ¡Cuándo se agotó!
  fechaCompra: Date,                            // Cuándo se compró
  semana: String,                               // "2026-W17" para organización
  bolsaId: ObjectId,                            // Si es bolsa
  distribucionId: ObjectId,                     // Si es distribución
  notas: String,                                // Comentarios optionales
  createdAt: Date,                              // Timestamp automático
  updatedAt: Date                               // Timestamp automático
}
```

---

### 🔌 API REST (Backend)

```
GET    /api/agotados
  → Lista todos los agotados
  → Params: tipo (bolsa/dist), dulce (ID), mes (mes), anio (año)
  
GET    /api/agotados/resumen
  → Estadísticas: total, por mes, por tipo, por dulce
  
POST   /api/agotados/archivar-bolsa/:bolsaId
  → Archiva una bolsa específica
  → Body: { notas: "optional" }
  
POST   /api/agotados/archivar-distribucion/:distribucionId
  → Archiva una distribución específica
  → Body: { notas: "optional" }
  
DELETE /api/agotados/:id
  → Elimina un registro del archivo
```

**Ejemplo de respuesta GET:**
```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "tipo": "bolsa",
    "nombreDulce": "Obleas",
    "cantidad": 150,
    "costoTotal": 47.00,
    "dineroRecuperado": 90.00,
    "gananciaAcumulada": 43.00,
    "fechaAgotamiento": "2026-04-28T18:30:45.123Z",
    "fechaCompra": "2026-04-21T00:00:00.000Z",
    "semana": "2026-W17",
    "notas": "Alta demanda en fin de semana"
  }
]
```

---

### 🎨 Frontend (HTML/JavaScript)

#### Nueva Pestaña
```html
<button class="tab-btn" onclick="showTab('agotados')">📁 Archivo Agotados</button>
```

#### Componentes
- **Filtros**: Dropdown de Tipo, Dulce, y Mes
- **Estadísticas**: 4 KPI cards con números
- **Tabla**: Mostrar registros con acciones
- **Botones**: Archivar (📁) en Inventario y Distribución

#### Funciones JavaScript

```javascript
// Carga datos de agotados como tabla
async function loadAgotados()

// Limpia todos los filtros
function resetFiltrosAgotados()

// Elimina un registro del archivo
async function deleteAgotado(id)

// Archiva una bolsa desde inventario
async function archivarBolsa(bolsaId)

// Archiva una distribución
async function archivarDistribucion(distribucionId)
```

---

## 📁 Archivos Modificados/Creados

### Modificados
| Archivo | Cambios |
|---------|---------|
| `server.js` | +Modelo ProductoAgotado, +5 rutas API |
| `public/index.html` | +Pestaña, +Tabla, +Filtros, +Funciones JS |

### Creados
| Archivo | Propósito |
|---------|----------|
| `ARCHIVO-AGOTADOS.md` | Manual de usuario (184 líneas) |
| `PRUEBAS-ARCHIVO.md` | Guía de pruebas técnicas (271 líneas) |
| `.../memories/repo/archive-system.md` | Doc técnica de memoria |

---

## 🎬 Flujo de Uso Típico

```
1. Usuario ve bolsa agotada en Inventario
   ↓
2. Hace clic en botón 📁
   ↓
3. Se abre prompt preguntando notas
   ↓
4. Se archiva con fecha/hora automática
   ↓
5. Aparece en "Archivo Agotados"
   ↓
6. Usuario filtra por mes/tipo/dulce para análisis
   ↓
7. Ve estadísticas: cuánta ganancia tuvo ese producto
```

---

## 💾 Datos que se Registran

Para cada producto agotado:

| Dato | Ejemplo | Propósito |
|------|---------|----------|
| **Fecha** | 28 Apr 2026 | Saber cuándo se agotó |
| **Tipo** | Bolsa | Diferenciar origen |
| **Producto** | Obleas | Qué se agotó |
| **Cantidad** | 150 piezas | Volumen |
| **Costo** | $47.00 | Inversión |
| **Recuperado** | $90.00 | Dinero sacado |
| **Ganancia** | $43.00 | Utilidad |
| **Notas** | "Alta demanda" | Contexto |

---

## 🔍 Características Especiales

### 1️⃣ Agotamiento Automático
- Cuando una bolsa llega a 0 disponibles, muestra badge "Agotado"
- Se habilita el botón 📁 solo si está agotada

### 2️⃣ Archivos Permanentes
- Los registros archivados **nunca se pierden**
- Se guardan para siempre en la BD
- Se pueden ver meses después

### 3️⃣ Filtros Dinámicos
```
Tipo:  ○ Todos  ○ Bolsas  ○ Distribuciones
Dulce: [Dropdown con todos los dulces]
Mes:   [Picker de mes/año 2026-04]
```

### 4️⃣ Estadísticas en Tiempo Real
- Suma automática de dinero recuperado
- Cálculo de ganancia total
- Contador de productos archivados

### 5️⃣ Backup Automático
- Cada archivado triggers un backup de MongoDB
- Se mantienen los últimos 80 backups

---

## 🚀 Cómo Usar

### Iniciar
```bash
npm start
# Servidor corriendo en http://localhost:3000
```

### Probar Endpoint
```bash
curl http://localhost:3000/api/agotados
# [Retorna array de agotados]
```

### Usar en Frontend
1. Abre http://localhost:3000 en navegador
2. Ve a pestaña "📁 Archivo Agotados"
3. Archiva una bolsa desde Inventario
4. ¡Véla en el archivo!

---

## 📈 Casos de Uso Reales

### Caso 1: Análisis de Productos
*"¿Cuál producto me genera más ganancia?"*
1. Filtra por tipo: "Bolsas"
2. Filtra por mes actual
3. Lee la columna "Ganancia"
4. Identifica los top productos

### Caso 2: Historial de Compras
*"¿Cuándo se agotó la última bolsa de Obleas?"*
1. Filtra por dulce: "Obleas"
2. Mira la fecha más reciente
3. ¡La información está ahí!

### Caso 3: Seguimiento Inventario
*"¿Cuántos productos se agotaron esta semana?"*
1. Filtra por mes actual
2. Cuenta el número en tabla
3. O lee la estadística "Productos Archivados"

---

## ✨ Beneficios

| Beneficio | Antes | Después |
|-----------|-------|---------|
| **Histórico** | No había | ✅ Completo |
| **Organización** | Desorden | ✅ Por fecha/tipo |
| **Análisis** | Imposible | ✅ Fácil con filtros |
| **Trazabilidad** | ❌ Se perdía | ✅ Registrado siempre |
| **Ganancia Tracking** | Manual | ✅ Automático |

---

## 🎯 Próximas Mejoras (Opcionales)

Si en el futuro quieres:

- **Exportar a CSV**: Todos los agotados del mes
- **Gráficos**: Visualization de agotados por tiempo
- **Alertas**: Notificación cuando se agota algo
- **Predicciones**: ML para predecir cuándo se agota
- **Reportes**: PDF mensual de agotados

Solo avísame y las implemento.

---

## 📞 Soporte Rápido

**¿El botón 📁 no aparece?**
→ Asegurate que el producto tenga "Disponibles: 0"

**¿No ve el archivo?**
→ Refresh (Ctrl+R) o limpia cache (F12 → Network → Disable Cache)

**¿Los datos no se guardan?**
→ Verifica MongoDB: `mongosh` → `use dulceria` → `db.productosagotados.find()`

**¿Falla al archivar?**
→ Abre console (F12) y busca el error rojo

---

**Sistema completado y listo para usar en producción.** 🎉

Todos los archivos están en git, documentados y probados.
