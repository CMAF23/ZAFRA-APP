# 📁 Manual: Sistema de Archivo de Productos Agotados

## Descripción General
El sistema de **Archivo de Agotados** te permite registrar y organizar los productos (bolsas de compra y distribuciones) que ya no tienes en stock, con un histórico completo que incluye:
- Fecha exacta de agotamiento
- Tipo de producto (compra o distribución)
- Dinero recuperado y ganancia acumulada
- Organización por fecha y tipo de dulce

## 📊 Acceso

### Pestaña: "📁 Archivo Agotados"
En tu dashboard principal verás una nueva pestaña llamada **"Archivo Agotados"** junto con las demás pestañas (Inventario, Distribución, etc).

## 🛍️ Cómo Archivar una Bolsa Agotada

### Paso 1: Ir a Inventario
1. Haz clic en la pestaña **"📦 Inventario"**
2. Busca la bolsa que ya no tienes en stock

### Paso 2: Identificar Bolsa Agotada
La bolsa mostrará:
- "Disponibles: **0**" (o número negativo si algo salió mal)
- Badge rojo "**Agotado**"

### Paso 3: Archivar
1. En esa fila, verás un botón **"📁"** (carpeta)
2. Haz clic en **"📁"**
3. Se abrirá un cuadro de diálogo pidiendo notas opcionales:
   - Ejemplo: "Se agotó por alto consumo"
   - Puedes dejarlo vacío si prefieres
4. Confirma

✅ **¡Hecho!** La bolsa se archivará con:
- Fecha de hoy
- Hora exacta
- Dinero recuperado
- Ganancia total

## 👩‍💼 Cómo Archivar una Distribución Agotada

### Paso 1: Ir a Distribución
1. Haz clic en la pestaña **"👩‍💼 Distribución"**
2. Busca la distribución que ya completó

### Paso 2: Identificar Distribución Agotada
La distribución mostrará:
- Badge rojo "**Agotado**"

### Paso 3: Archivar
1. En esa fila, verás un botón **"📁"** (carpeta)
2. Haz clic en **"📁"**
3. Agrega notas opcionales si deseas
4. Confirma

✅ **¡Hecho!** Se archivará en tu histórico.

## 📋 Visualizar Archivo de Agotados

### 1. Pestaña Principal
En **"📁 Archivo Agotados"** verás:

**Estadísticas de Resumen:**
- 📊 Productos Archivados (total)
- 🛍️ Bolsas Agotadas
- 💰 Dinero Recuperado
- 📈 Ganancia Total

**Tabla de Agotados:**
- 📅 Fecha Agotada
- 🍬 Producto
- 📊 Cantidad (piezas)
- 💵 Costo (si es bolsa)
- 💰 Dinero Recuperado
- 📈 Ganancia
- 📝 Notas
- Botón 🗑️ para eliminar si fue error

### 2. Filtrado

Puedes filtrar por:

**Tipo:**
- Todos
- Bolsas Compradas (🛍️)
- Distribuciones (📦)

**Dulce:**
- Todos los dulces
- O selecciona uno específico (Klubi, Obleas, etc.)

**Mes:**
- Selecciona un mes y año específico
- Ejemplo: Abril 2026

**Botón "Limpiar Filtros":**
- Vuelve a mostrar todo desde el inicio

### 3. Ejemplo de Uso de Filtros

**Quiero ver todas las OBLEAS que se agotaron en Abril:**
1. Tipo → "Bolsas Compradas"
2. Dulce → "Obleas"
3. Mes → "2026-04" (Abril 2026)
4. ¡Verás exactamente eso!

## 💡 Casos de Uso

### Caso 1: Nuevas Compras
Acabas de comprar una nueva bolsa de **Obleas** pero todavía tienes dos arcadas:
1. Archiva la bolsa anterior con el botón 📁
2. Registra la fecha exacta (hoy)
3. Verás en "Archivo Agotados" cuándo se agotó y cuánta ganancia tuvo

### Caso 2: Seguimiento Mensual
Quieres saber qué dulces se agotaron en la última semana:
1. Abre "Archivo Agotados"
2. Selecciona el mes
3. Filtra por tipo "Bolsas Compradas"
4. ¡Verás el histórico completo!

### Caso 3: Análisis de Ganancia
Para ver cuánto dinero recuperaste de las **Papas Chidas** este mes:
1. Dulce → "Papas Chidas"
2. Tipo → "Bolsas Compradas"
3. Mes → Este mes
4. Lee la columna "💰 Dinero Recuperado"

## 🔄 Flujo Completoempleado

```
Inventario/Distribución
    ↓
Producto se agota (Disponibles = 0)
    ↓
Haces clic en 📁 (Archivar)
    ↓
Confirmas con notas opcionales
    ↓
Sistema guarda:
  ✓ Fecha exacta
  ✓ Tipo (bolsa/distribución)
  ✓ Producto
  ✓ Dinero recuperado
  ✓ Ganancia
    ↓
Aparece en "Archivo Agotados"
    ↓
Filtras y ves organizado por:
  → Fecha
  → Tipo
  → Producto
```

## ❓ Preguntas Frecuentes

**P: ¿Qué pasa si archivé algo por error?**
R: Haz clic en la bolsa/distribución original en Inventario/Distribución. Verá el estado actualizado. Puedes eliminar el registro del archivo si lo deseas con el botón 🗑️.

**P: ¿Se pierden los datos de la bolsa original?**
R: No, se guarda una copia en "Archivo Agotados" pero la bolsa sigue en Inventario marcada como "inactiva".

**P: ¿Puedo ver agotados de hace 6 meses?**
R: Sí, el sistema guarda todo el histórico. Filtra por el mes específico y verás todo.

**P: ¿Qué incluye "Dinero Recuperado"?**
R: La cantidad de dinero que sacaste vendiendo ese producto:
- Para bolsas: `piezas vendidas × precio unitario`
- Para distribuciones: `cantidad × precio de costo`

**P: ¿Qué es "Ganancia"?**
R: Para bolsas: `dinero recuperado - costo total`
- Si es positivo: ¡ganaste dinero! ✅
- Si es negativo: Perdiste dinero ⚠️

## 📞 Soporte

Si tienes problemas:
1. Verifica que el servidor esté corriendo (`npm start`)
2. Abre la consola del navegador (F12) y busca errores
3. Prueba archivando desde Inventario (es más fácil de depurar)
4. Revisa que la base de datos MongoDB esté conectada

¡Feliz gestión de tu dulcería! 🍬
