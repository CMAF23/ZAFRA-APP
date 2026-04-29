# ✅ Guía de Pruebas: Sistema de Archivo de Agotados

## Requisitos Previos
- MongoDB corriendo en `localhost:27017`
- Servidor Node.js iniciado: `npm start`
- Navegador abierto en `http://localhost:3000`

## Escenario de Prueba Completo

### 1. Verificar que la Nueva Pestaña Existe ✅

**Pasos:**
1. Abre la aplicación en el navegador
2. Mira la barra de pestañas en el header (fondo gradiente naranja/rosa)
3. Desplázate a la derecha en la barra de pestañas

**Resultado Esperado:**
- Ves una nueva pestaña **"📁 Archivo Agotados"** al final

---

### 2. Verificar Endpoints API 🔌

**Prueba 1: GET /api/agotados (lista de agotados)**
```bash
curl http://localhost:3000/api/agotados
# Retorna: [] (array vacío si no hay datos)
```

**Prueba 2: GET /api/agotados/resumen (estadísticas)**
```bash
curl http://localhost:3000/api/agotados/resumen
# Retorna: [] (array vacío sin datos)
```

---

### 3. Flujo Completo: Archivar una Bolsa 🛍️

#### Paso 1: Créate datos de prueba
1. Ve a pestaña **"📦 Inventario"**
2. Haz clic en el botón **"➕ Agregar Bolsa"**
3. Completa con:
   - **Dulce:** Selecciona uno (ej: "Klubi Re mix")
   - **Cantidad de bolsas:** 1
   - **Costo total:** 50
4. Haz clic en **"Agregar Bolsa"** ✅

#### Paso 2: Vende todas las piezas
1. Ve a pestaña **"💰 Ventas del Día"**
2. Selecciona el dulce que acabas de agregar
3. En "Cantidad a vender" ingresa el número de piezas (ej: si la bolsa tiene 50 piezas, ingresa 50)
4. Haz clic en **"Registrar Venta"** ✅
5. Marca como "Recuperada" si lo deseas

#### Paso 3: Verifica que está agotada
1. Vuelve a **"📦 Inventario"**
2. Busca tu bolsa
3. Verifica:
   - **Disponibles:** 0
   - Badge rojo: **"Agotado"**

#### Paso 4: Archiva la bolsa
1. En la fila de la bolsa agotada, busca el botón **"📁"** (carpeta)
2. Haz clic en **"📁"**
3. Se abrirá un prompt pidiendo notas:
   - Ingresa: "Prueba de archivado - Agotada por alta demanda"
   - O déjalo vacío
4. Presiona **Enter** o **OK** ✅

**Resultado esperado:**
- Toast/notificación: "✅ Bolsa archivada exitosamente"
- La bolsa desaparece del inventario activo

#### Paso 5: Verifica en Archivo
1. Haz clic en pestaña **"📁 Archivo Agotados"**
2. Verifica que la tabla muestra:
   - ✅ Tu bolsa archivada
   - ✅ Fecha de hoy
   - ✅ 0 o número de piezas
   - ✅ Dinero recuperado
   - ✅ Ganancia calculada

**Estadísticas esperadas:**
- 📊 Productos Archivados: 1
- 🛍️ Bolsas Agotadas: 1
- 💰 Dinero Recuperado: $X.XX
- 📈 Ganancia Total: $X.XX

---

### 4. Flujo: Archivar una Distribución 👩‍💼

#### Paso 1: Crea una distribución
1. Ve a pestaña **"👩‍💼 Distribución"**
2. Haz clic en **"➕ Registrar Entrega"**
3. Completa:
   - **Dulce:** Selecciona uno
   - **Cantidad:** 100 piezas
   - Mantén otros valores por defecto
4. Haz clic en **"Registrar"** ✅

#### Paso 2: Marca como entregado/vendido
1. En la tabla de distribuciones, verá un campo de entrada **"Dinero Devuelto"**
2. (Opcional) Ingresa un monto si fue parcialmente devuelto
3. La distribución mostra status "Disponible"

#### Paso 3: Verifica que está agotada
1. Si todas las piezas se vendieron, verás el badge **"Agotado"** (rojo)

#### Paso 4: Archiva la distribución
1. En esa fila, busca el botón **"📁"** (solo aparece si está agotada)
2. Haz clic en **"📁"**
3. Ingresa notas opcionales:
   - "Vendido completamente"
4. Presiona **Enter** o **OK** ✅

**Resultado esperado:**
- Toast/notificación de éxito
- Aparece inmediatamente en "Archivo Agotados"

---

### 5. Prueba de Filtros 🔍

**En la pestaña "📁 Archivo Agotados":**

#### Filtro 1: Por Tipo
1. Haz clic en dropdown **"Tipo"**
2. Selecciona **"Bolsas Compradas"**
3. La tabla debería mostrar Solo bolsas
4. Cambia a **"Distribuciones"** - solo distribuciones
5. Selecciona **"Todos"** - ambas

**Resultado:** Tabla se actualiza dinámicamente

#### Filtro 2: Por Dulce
1. Haz clic en dropdown **"Dulce"**
2. Selecciona un dulce específico (ej: "Portal")
3. La tabla solo muestra ese dulce

**Resultado:** Solo aparecen registros de ese producto

#### Filtro 3: Por Mes
1. Haz clic en input **"Mes"**
2. Selecciona un mes (ej: Abril 2026 = 2026-04)
3. Solo muestra agotados de ese mes

**Resultado:** Filtrado por fecha

#### Botón: Limpiar Filtros
1. Con filtros activos, haz clic en **"Limpiar Filtros"**
2. Se borran todos los filtros
3. Aparecen todos los registros nuevamente

---

### 6. Pruebas Avanzadas 🚀

#### Test 1: Múltiples Agotados
1. Archiva 5 bolsas diferentes
2. Verifica que la estadística **"Productos Archivados"** dice **5**

#### Test 2: Cálculo de Ganancia
1. Archiva una bolsa que te dejó ganancia positiva
2. Archiva una que te dejó ganancia negativa (costo > recuperado)
3. Verifica que la **"Ganancia Total"** suma ambas correctamente

#### Test 3: Eliminación desde Archivo
1. En tabla de agotados, haz clic en botón **"🗑️"** de un registro
2. Se abrirá un confirm: "¿Eliminar registro?"
3. Confirma
4. El registro desaparece de la tabla
5. Las estadísticas se actualizan

#### Test 4: Búsqueda por Período
1. Archiva bolsas en diferentes meses
2. Filtra por mes de Enero
3. Luego por mes de Febrero
4. Verifica que solo muestra del mes seleccionado

---

### 7. Pruebas de Error 🐛

#### Caso 1: Eliminar ID inválido
```bash
curl -X DELETE http://localhost:3000/api/agotados/invalid-id
# Respuesta esperada: Error de validación MongoDB
```

#### Caso 2: Archivar bolsa inexistente
```bash
curl -X POST http://localhost:3000/api/agotados/archivar-bolsa/000000000000000000000000 \
  -H "Content-Type: application/json" \
  -d '{"notas":"test"}'
# Respuesta esperada: {"error": "Bolsa no encontrada"}
```

---

### 8. Checklist Final ✨

- [ ] Pestaña "📁 Archivo Agotados" visible
- [ ] Botón 📁 aparece en bolsas agotadas del Inventario
- [ ] Botón 📁 aparece en distribuciones agotadas
- [ ] Archivado de bolsa funciona correctamente
- [ ] Archivado de distribución funciona correctamente
- [ ] Tabla muestra todos los archivados
- [ ] Filtro por Tipo funciona
- [ ] Filtro por Dulce funciona
- [ ] Filtro por Mes funciona
- [ ] "Limpiar Filtros" borra todo
- [ ] Estadísticas se actualizan correctamente
- [ ] Botón eliminar (🗑️) funciona
- [ ] Toast/notificaciones aparecen
- [ ] Respuesta API es válida JSON
- [ ] Base de datos guarda registros

---

## 📝 Notas para Depuración

**Si algo no funciona:**

1. **Abre la consola del navegador (F12)**
   - Ve a pestaña "Console"
   - Busca mensajes de error rojo

2. **Revisa los logs del servidor**
   - Terminal donde ejecutaste `npm start`
   - Busca "error" o "Error"

3. **Verifica MongoDB**
   ```bash
   mongo
   > use dulceria
   > db.productosagotados.find()  # Debería mostrar los archivados
   ```

4. **Intenta hacer refresh (F5)**
   - A veces los datos caché causan problemas

5. **Limpia el cache del navegador**
   - F12 → Network → disable cache
   - Luego F5 para recargar

---

## 🎯 Resultado Final Esperado

Después de todas las pruebas, deberías tener:

```
📁 Archivo Agotados
├─ Estadísticas
│  ├─ Productos: 5+
│  ├─ Bolsas: 3+
│  ├─ Dinero: $150+
│  └─ Ganancia: $50+
├─ Filtros
│  ├─ Tipo: Funcional
│  ├─ Dulce: Funcional
│  └─ Mes: Funcional
└─ Tabla
   ├─ Registros visibles
   ├─ Botones funcionales
   └─ Datos correctos
```

¡Listo para usar en producción! 🚀
