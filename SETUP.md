# 🔧 GUÍA COMPLETA DE INSTALACIÓN - DulceríaManager

## ⚠️ PROBLEMAS ENCONTRADOS Y SOLUCIONADOS

### ✅ PROBLEMAS YA ARREGLADOS

| Problema | Estado | Solución |
|----------|--------|----------|
| `pakage.json` (typo) | ✅ ARREGLADO | Renombrado a `package.json` |
| Node.js no en PATH | ✅ INSTALADO | v18.19.1 disponible |
| npm no disponible | ✅ INSTALADO | v9.2.0 disponible |
| Dependencias faltantes | ✅ INSTALADAS | `npm install` ejecutado |
| README.md vacío | ✅ CREADO | Documentación completa |
| .env.example vacío | ✅ COMPLETADO | Variantes de configuración |

### ❌ FALTANTE CRÍTICO: MONGODB

**El ÚNICO problema pendiente es instalar MongoDB.**

Sin MongoDB, verás este error al iniciar:

```
❌ Error MongoDB: connect ECONNREFUSED 127.0.0.1:27017
```

---

## 📥 INSTALAR MONGODB

### OPCIÓN 1: MongoDB Community (LOCAL) - RECOMENDADO PARA DESARROLLO

#### Linux Ubuntu/Debian

```bash
# 1. Actualizar sistema
sudo apt-get update
sudo apt-get install -y curl gnupg

# 2. Importar clave GPG MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg

# 3. Agregar repositorio MongoDB
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 4. Instalar MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# 5. Iniciar servicio
sudo systemctl start mongod
sudo systemctl enable mongod  # Inicia automáticamente al boot

# 6. VERIFICAR que funciona
mongosh
```

Si ves el prompt `>`, MongoDB está funcionando. Escribe `exit`.

---

#### Windows

**Opción A: Instalador oficial**

1. Descargar: https://www.mongodb.com/try/download/community
2. Ejecutar instalador `.msi`
3. Seleccionar "Install MongoDB as a Service"
4. MongoDB inicia automáticamente
5. Verificar: Abre PowerShell y ejecuta:

```powershell
mongosh
```

**Opción B: Chocolatey (si lo tienes instalado)**

```powershell
choco install mongodb-community
mongosh
```

---

#### macOS

```bash
# Con Homebrew (RECOMENDADO)
brew tap mongodb/brew
brew install mongodb-community

# Iniciar
brew services start mongodb-community

# Verificar
mongosh
```

---

### OPCIÓN 2: MongoDB Atlas (NUBE) - MEJOR PARA PRODUCCIÓN

**Ventajas:** Sin instalación, respaldo automático, acceso desde cualquier lugar

**Pasos:**

1. Ir a https://www.mongodb.com/cloud/atlas
2. Crear cuenta (gratis)
3. Crear cluster M0 (Free Tier)
4. Esperar 5-10 minutos a que se cree
5. Buscar "Drivers" → Node.js
6. Copiar connection string: `mongodb+srv://...`
7. En `.env` reemplazar:

```env
MONGODB_URI=mongodb+srv://tuUsuario:tuPassword@cluster.mongodb.net/dulceria
```

8. Crear Database user con password segura
9. Whitelist tu IP (0.0.0.0 para desarrollo)

---

### OPCIÓN 3: Docker (PARA DESARROLLADORES)

```bash
# Instalar Docker desde: https://www.docker.com/get-started

# Ejecutar MongoDB en container
docker run -d -p 27017:27017 --name mongodb mongo:7.0

# Verificar
mongosh

# Parar
docker stop mongodb

# Reiniciar
docker start mongodb
```

### REINICIAR INSTANCIA (de 27018 → 27017)

Si accidentalmente estabas trabajando en `27018`, limpia esa instancia y levanta una nueva en `27017`:

```bash
# Ver contenedores y puertos
docker ps -a --format 'table {{.Names}}\t{{.Ports}}'

# Eliminar contenedor viejo que use 27018 (ajusta el nombre si cambia)
docker rm -f mongo-27018 2>/dev/null || true

# Levantar Mongo limpio en 27017 con volumen persistente
docker rm -f m-server 2>/dev/null || true
docker run -d \
   --name m-server \
   -p 27017:27017 \
   -v dulceria_mongo_data:/data/db \
   mongo:7.0

# Verificar
mongosh "mongodb://127.0.0.1:27017/dulceria"
```

Con esto, la app debe conectarse con:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/dulceria
```

### BACKUP AUTOMÁTICO EN CADA CAMBIO

El backend crea un `mongodump` comprimido por cada escritura API exitosa (`POST/PUT/PATCH/DELETE`).

Variables de entorno sugeridas en `.env`:

```env
BACKUP_ON_WRITE=true
BACKUP_DIR=./backups
BACKUP_DEBOUNCE_MS=2000
BACKUP_KEEP_FILES=80
```

Restaurar respaldo:

```bash
mongorestore --uri="mongodb://127.0.0.1:27017/dulceria" --gzip --archive=./backups/archivo.archive.gz --drop
```

---

## ✅ VERIFICAR QUE MONGODB FUNCIONA

```bash
# Terminal 1: Conectarse a MongoDB
mongosh

# Deberías ver:
# > 

# Terminal 2: Ejecutar la app
cd /home/manuel-flores/dulceria
npm start

# Verás: ✅ MongoDB conectado: mongodb://127.0.0.1:27017/dulceria
```

---

## 🚀 EJECUTAR LA APP

Una vez MongoDB esté corriendo:

```bash
# Terminal 1: INICIAR MONGODB (si es local)
sudo systemctl start mongod
# O si es Docker: docker start mongodb

# Terminal 2: INICIAR LA APP
cd /home/manuel-flores/dulceria
npm start

# Ver:
# 🍬  DulceríaApp corriendo en → http://localhost:3000
# 📦  Primer uso: POST http://localhost:3000/api/seed
```

---

## 🌐 ACCEDER A LA APP

1. Abre navegador: http://localhost:3000
2. Automáticamente sembrará datos iniciales (10 dulces)
3. ¡Listo! Empieza a registrar ventas

---

## 📌 CHECKLIST FINAL

- [ ] Node.js 18+ instalado (`node -v`)
- [ ] npm 9+ instalado (`npm -v`)
- [ ] MongoDB 7.0+ instalado y corriendo (`mongosh` funciona)
- [ ] Dependencias instaladas (`npm install` completado)
- [ ] `.env` existe y está configurado
- [ ] `npm start` inicia sin errores de MongoDB
- [ ] http://localhost:3000 abre la app
- [ ] Dashboard muestra datos iniciales

---

## 🐛 ERRORES COMUNES

### "ECONNREFUSED 127.0.0.1:27017"
❌ MongoDB no está corriendo
✅ Solución:
```bash
sudo systemctl start mongod  # Linux
brew services start mongodb-community  # macOS
# Windows: Services → MongoDB Server → Start
```

### "MongooseError: Cannot connect"
❌ Connected string inválida en .env
✅ Solución: Verifica `MONGODB_URI` en `.env`

### "npm: command not found"
❌ Node.js no está en PATH
✅ Solución: Reinstala Node.js desde nodejs.org

---

## 💡 PRÓXIMOS PASOS

1. **Cargar datos iniciales**
   - La app lo hace automáticamente en primer inicio
   - También puedes: `POST http://localhost:3000/api/seed`

2. **Agregar tu primer dulce**
   - Ir a Catálogo → ➕ Nuevo Dulce
   - Rellenar: nombre, piezas/bolsa, costo, precio

3. **Registrar bolsas"
   - Ir a Inventario → ➕ Agregar Bolsa
   - Selecciona dulce y cantidad

4. **Registrar venta del día**
   - Ir a Ventas del Día
   - Ingresa cantidades vendidas
   - Ingresa dinero recibido
   - ¡Genera recibo!

---

**¿Todo bien? 🍬 ¡Listo para vender!**