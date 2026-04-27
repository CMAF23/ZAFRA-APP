# 🍬 Zafra

**Sistema de gestion de ventas para Zafra**

Una aplicación web profesional para registrar, rastrear y gestionar la venta de dulces con análisis empresarial, recomendaciones IA y reportes detallados.

## ✨ Características

✅ **Catálogo dinámico** - Crear, editar y eliminar dulces  
✅ **Registro de ventas diarias** - Entrada rápida con cálculo automático de comisiones  
✅ **Control de inventario FIFO** - Rastreo de bolsas por fecha de compra  
✅ **Recuperación de inversión** - Visualización en tiempo real de cuándo se recupera la inversión  
✅ **Gestión de comisiones** - 12% automático sobre ventas diarias, agrupadas por semana  
✅ **Análisis de rentabilidad** - Márgenes, ganancias acumuladas y proyecciones  
✅ **Recomendaciones IA** - Algoritmo EMA que aprende los patrones de venta día a día  
✅ **Recibos impresos** - Generación de recibos diarios y semanales  
✅ **Dashboard analítico** - Gráficos de ventas y métricas KPI  

## 🚀 Inicio Rápido

### 1. Requisitos previos

- **Node.js 18+** - [descargar](https://nodejs.org/)
- **MongoDB 4.4+** - [descargar](https://www.mongodb.com/try/download/community)

### 2. Instalación

```bash
# Clonar o descargar el repositorio
cd dulceria

# Instalar dependencias
npm install

# Crear archivo .env (opcional - usa localhost por defecto)
cp .env.example .env
```

### 3. Configurar MongoDB

**Opción A: MongoDB localmente (RECOMENDADO para desarrollo)**

```bash
# Linux/Mac
brew services start mongodb-community

# Windows
# Ir a Services y buscar "MongoDB Server" → Start

# Verificar conexión
mongosh
```

**Opción B: MongoDB Atlas (nube)**

1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crear cluster gratuito
3. Copiar connection string
4. Actualizar `.env`:
   ```
   MONGODB_URI=mongodb+srv://usuario:contraseña@cluster.mongodb.net/dulceria
   ```

**Opción C: Docker (limpiar instancia y dejarla en 27017)**

```bash
# 1) Si tienes algo en 27018, bórralo
docker ps -a --format 'table {{.Names}}\t{{.Ports}}'
docker rm -f mongo-27018 2>/dev/null || true

# 2) Reiniciar una instancia limpia en 27017
docker rm -f m-server 2>/dev/null || true
docker run -d \
   --name m-server \
   -p 27017:27017 \
   -v dulceria_mongo_data:/data/db \
   mongo:7.0

# 3) Verificar que responde
mongosh "mongodb://127.0.0.1:27017/dulceria"
```

### 4. Ejecutar la aplicación

```bash
# Desarrollo (con hot-reload)
npm run dev

# Producción
npm start

# La app estará disponible en: http://localhost:3000
```

### 5. Vista de compañera (solo sus datos)

- URL compañera: `http://localhost:3000/vendedora`
- La página usa endpoints `/api/companera/*` y ahora se protegen con `COMPANERA_API_KEY`.
- Las ventas registradas desde esa vista se guardan con `source='companera'` y sí aparecen en tu panel principal.

Variables recomendadas en `.env`:

```env
COMPANERA_API_KEY=tu-clave-secreta
CORS_ORIGIN=
```

Si frontend y backend viven en dominios distintos, configura `CORS_ORIGIN` con lista separada por comas.

## 📊 Uso

### Dashboard
- **Vista general** de ventas hoy, comisiones y estado de bolsas
- **Gráfico** de ventas últimos 7 días
- **Recuperación de inversión** por bolsa con indicador visual

### Ventas del Día
1. Selecciona dulces y cantidad vendida
2. Sistema calcula total esperado automáticamente
3. Ingresa dinero recibido
4. Sistema muestra si hay diferencia o falta dinero
5. Genera recibo al 12% de comisión

### Inventario
- Registra nuevas bolsas de dulces
- Visualiza progreso de recuperación (FIFO)
- Bolsas se marcan en **verde** cuando recuperan inversión
- Muestra ganancia acumulada por bolsa

### Catálogo
- Gestiona precios de dulces
- Sugerencias automáticas de precios (márgenes inteligentes)
- Cálculo de rentabilidad por bolsa

### Semana
- Resumen de ventas Lun-Vie (hasta 6 PM)
- Total de comisiones por semana
- Recibos semanales para el vendedor

### Recomendaciones IA
- Análisis de patrones de venta por día de semana
- Sugerencias de cantidad a entregar cada día
- Ingreso estimado
- Nivel de confianza (Alta/Media/Baja)

## 🛠 Estructura del Proyecto

```
dulceria/
├── server.js           # Backend Express + MongoDB
├── public/
│   └── index.html      # Frontend (HTML + CSS + JS completo)
├── package.json        # Dependencias
├── .env                # Variables de entorno (local)
└── README.md           # Este archivo
```

## 📝 API Endpoints

```
POST   /api/seed                    # Cargar datos iniciales
GET    /api/candies                 # Listar dulces
POST   /api/candies                 # Crear dulce
PUT    /api/candies/:id             # Editar dulce
DELETE /api/candies/:id             # Desactivar dulce

GET    /api/bolsas                  # Listar bolsas
POST   /api/bolsas                  # Crear bolsa
DELETE /api/bolsas/:id              # Desactivar bolsa

GET    /api/ventas                  # Historial de ventas
GET    /api/ventas/hoy              # Ventas de hoy
POST   /api/ventas                  # Registrar venta

GET    /api/semanas                 # Historial de semanas
GET    /api/semanas/actual          # Semana actual
POST   /api/semanas/:id/cerrar      # Marcar semana como pagada

GET    /api/dashboard               # Datos completos para dashboard
GET    /api/recomendaciones         # Recomendaciones IA
GET    /api/candies/precios-sugeridos # Análisis de precios
```

## 🧠 Algoritmo de Recomendaciones

El sistema usa **EMA (Exponential Moving Average)** para aprender patrones:

1. **Por día de semana** - Analiza últimos 30 días, filtrando Lun-Vie
2. **EMA α=0.4** - Factor de suavizado que pesa más datos recientes
3. **Buffer de seguridad** - +15% para EMA, +20% para promedio general
4. **Confianza** - Alta (4+ datos), Media, o Baja (<2 días)

Ejemplo:
- Si el lunes vendiste: [15, 18, 12, 20] piezas de un dulce
- Sistema calcula EMA y sugiere ~17 piezas + 15% buffer = **20 piezas**

## 💾 Base de Datos

### Backups automáticos

Cada operación exitosa de escritura (`POST/PUT/PATCH/DELETE`) dispara un backup comprimido con `mongodump` en la carpeta `backups/`.

Variables de entorno disponibles:

```env
BACKUP_ON_WRITE=true
BACKUP_DIR=./backups
BACKUP_DEBOUNCE_MS=2000
BACKUP_KEEP_FILES=80
```

Restaurar un backup:

```bash
mongorestore --uri="mongodb://127.0.0.1:27017/dulceria" --gzip --archive=./backups/archivo.archive.gz --drop
```

### Modelos

**Candy** - Catálogo de dulces
- nombre, piezasPorBolsa, costoPorBolsa, precioUnitario

**Bolsa** - Lote de compra (inventario FIFO)
- candyId, cantidadBolsas, costoTotal, piezasTotales
- piezasVendidas, dineroRecuperado, gananciaAcumulada, recuperada

**Venta** - Registro diario de ventas
- fecha, detalles[], totalEsperado, totalRecibido, diferencia
- comisionCalculada, semanaId

**Semana** - Agrupación Lun-Vie 6PM
- fechaInicio, fechaFin, totalVentas, totalComision
- numeroDias, pagado, fechaPago

## 🐛 Solución de Problemas

### Error: "ECONNREFUSED" en MongoDB
```
MongoDB no está corriendo. Ejecuta:
ubuntu: sudo systemctl start mongodb
```

### Error: "No hay dulces"
```
Haz POST a /api/seed para cargar datos iniciales
```

### Precios incorrectos
```
Verifica en Catálogo → Precios Sugeridos
Actualiza según márgenes deseados
```

## 📦 Deployment (Producción)

Nota importante: GitHub Pages solo sirve frontend estático. Para que funcione la base de datos necesitas backend separado (Render/Railway/Vercel) + MongoDB (Atlas o VPS).

Ejemplo recomendado:
- Frontend admin + compañera en GitHub Pages
- Backend Express en Render/Railway
- MongoDB en Atlas

Para usar `indexv.html` desde GitHub Pages, define en navegador:

```js
localStorage.setItem('zafraApiBase', 'https://tu-backend.com')
```

Luego recarga y la vista usará `https://tu-backend.com/api/...`.

Si vas a publicar ambas vistas hoy mismo:

1. Despliega este backend (Render/Railway) y define variables:
   `MONGODB_URI`, `COMPANERA_API_KEY`, `CORS_ORIGIN`.
2. Admin online: `https://tu-backend.com/admin`
3. Vendedora online: `https://tu-backend.com/vendedora`
4. Si sirves frontend por separado (GitHub Pages/Vercel), abre consola y ejecuta:

```js
localStorage.setItem('zafraApiBase', 'https://tu-backend.com')
```

5. En vista de vendedora ingresa la clave `COMPANERA_API_KEY` cuando la solicite.

### Heroku
```bash
heroku login
heroku create nombre-app
git push heroku main
```

### Railway/Render
- Conecta repositorio Git
- Configura variables de entorno
- Deploy automático

### Azure/AWS
- Variables de entorno: `MONGODB_URI`
- Port: `process.env.PORT || 3000`
- Comando: `npm start`

## 📄 Licencia

Desarrollado como proyecto de nivel ingeniería.

## 👨‍💻 Soporte

¿Preguntas? Revisa los logs de la consola del navegador (F12) y terminal.

---

**🍬 ¡A vender delicioso!**
