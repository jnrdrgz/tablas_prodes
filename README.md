# Tablador - Prode de Futbol

Sistema web para gestionar torneos de predicciones de futbol con amigos via WhatsApp.

## Stack

- **Backend**: Express.js + Prisma + PostgreSQL
- **Frontend**: React + Vite + Tailwind CSS

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- PM2 (para produccion)

## Instalacion

### 1. Clonar e instalar dependencias

```bash
npm install
```

### 2. Configurar base de datos

Crear archivo `backend/.env`:

```env
DATABASE_URL="postgresql://usuario:password@localhost:5432/tablador?schema=public"
PORT=3001
```

### 3. Crear la base de datos y migrar

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Actualizar despues de cambios (torneos archivados / captura de imagen)

```bash
# Backend: aplicar la migracion que agrega Tournament.archived
cd backend
npx prisma migrate deploy   # en desarrollo: npx prisma migrate dev
npx prisma generate

# Frontend admin: ahora usa html-to-image (igual que el publico)
cd ../frontend
npm install
```

## Desarrollo

Correr backend y frontend en terminales separadas:

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Frontend en: http://localhost:5173
Backend en: http://localhost:3001

## Produccion

### 1. Build del frontend

```bash
cd frontend
npm run build
```

### 2. Configurar Express para servir frontend

En produccion, configurar un reverse proxy (nginx) o servir el build desde Express.

### 3. PM2

```bash
# Iniciar backend
cd backend
pm2 start src/index.js --name tablador-backend

# Ver logs
pm2 logs tablador-backend

# Reiniciar
pm2 restart tablador-backend
```

### Ejemplo de configuracion PM2 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'tablador-backend',
    script: './backend/src/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      DATABASE_URL: 'postgresql://usuario:password@localhost:5432/tablador'
    }
  }]
}
```

### Ejemplo Nginx

```nginx
server {
    listen 80;
    server_name tablador.tudominio.com;

    location / {
        root /path/to/tablador/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Uso

### Flujo basico

1. **Crear mapeos** - En la pagina principal, agregar mapeos de numeros de telefono a nombres (ej: "+54 9 381 574-8792" -> "Pablo")

2. **Crear torneo** - Crear un nuevo torneo con nombre descriptivo

3. **Crear fecha** - Dentro del torneo, crear una nueva fecha (gameweek)

4. **Agregar partidos** - En la fecha, agregar los partidos en formato:
   ```
   Boca - River
   Racing - Independiente
   San Lorenzo - Huracan
   ```

5. **Cargar predicciones** - Pegar el texto copiado de WhatsApp con las predicciones:
   ```
   [1/21, 21:39] PMolina: Boca 2-1 River
   Racing 1-0 Independiente
   San Lorenzo 0-0 Huracan
   [1/21, 23:13] +54 9 381 574-8792: Boca 1-1 River
   Racing 2-1 Independiente
   ...
   ```

   Si los mensajes se copian desde **WhatsApp Web**, usar el boton **Cargar Predicciones (WP Web)**. Ese formato se lee linea por linea: cada mensaje empieza con `[hora, fecha] Nombre:` y las lineas siguientes son parte de ese mensaje:
   ```
   [15:19, 9/4/2026] Juan Rodríguez: Boca 2-1 River
   Racing 1-0 Independiente
   [16:17, 9/4/2026] +54 9 3512 87-0987: Boca 1-1 River
   Racing 2-1 Independiente
   ```
   Los mensajes sin resultados (charla del grupo) se ignoran. Si una persona manda varios mensajes con resultados, se toma solo el que tiene mas resultados (su prode); si empatan, el ultimo. Asi un "vamos 2-0" mandado despues no pisa el primer partido.

   **Cargar faltantes con 9-9** (checkbox, apagado por defecto): si se activa, despues de cargar, todos los participantes que aparecen en la tabla de puntos del torneo (hasta esta fecha) y no tienen ninguna prediccion en esta fecha quedan con `9-9` en todos los partidos (prode no enviado / invalido / anulado). No toca a quien ya cargo predicciones en la fecha.

   **Validar antes de cargar** (checkbox, apagado por defecto): el boton pasa a decir **Validar** y, en vez de cargar, muestra una tabla con lo que se va a cargar (resultado por partido de cada participante, quien ya tenia prode y se actualiza, a quien le faltan o sobran resultados, y quienes se completarian con 9-9). No se guarda nada hasta apretar **Confirmar carga**. Si se cambia el texto o alguna opcion, hay que volver a validar.

6. **Cargar resultados** - Cuando terminen los partidos, cargar los resultados reales

7. **Ver tabla** - La tabla de puntos se calcula automaticamente

### Torneos suscritos

Un torneo puede "suscribirse" a otro. Esto significa que:
- Las fechas se crean automaticamente cuando se crean en el torneo principal
- Los partidos se copian automaticamente
- Los resultados se sincronizan
- Las predicciones son independientes (cada torneo tiene sus propias predicciones)

Util para tener el mismo fixture con diferentes grupos de amigos.

### Torneos archivados

Desde el admin (`/tournaments` o la pagina del torneo) se puede **Archivar** un torneo:

- Deja de aparecer en el frontend publico (lista y detalle devuelven 404)
- Sigue visible en el admin, pintado en color ambar con el cartel `ARCHIVADO`
- No suma en la **Tabla General**, pero si en la **Tabla Historica**
- Se puede **Desarchivar** en cualquier momento (no se borra nada)

La API expone:
- `GET /api/tournaments` -> solo activos; `?includeArchived=true` -> todos (lo usa el admin)
- `PUT /api/tournaments/:id/archive` con body `{ "archived": true|false }`
- `GET /api/general-table` -> Tabla General (solo activos); `?includeArchived=true` -> Tabla Historica

### Tablas General e Historica

Ambas estan disponibles en el admin y en el publico:
- `/general` - Tabla General: suma solo torneos NO archivados
- `/historica` - Tabla Historica: suma todos los torneos, incluidos los archivados

### Otras Tablas (solo admin)

En el admin el link **Otras Tablas** (`/tablas/general`) junta todas las tablas en pestañas. `/general` y `/historica` redirigen ahi.

- **Tabla General** y **Tabla Historica**: las de siempre.
- **General sin Plenos**: solo torneos activos. Cada acierto de ganador/empate vale 1 punto, sea pleno o no.
- **Plenos Seguidos** (historico): la racha mas larga de partidos seguidos con resultado exacto de cada participante.
- **Simples Seguidos** (historico): la racha mas larga de partidos seguidos acertando al menos ganador/empate (un pleno tambien cuenta).
- **Puntos en una Fecha** (historico): la mejor fecha de cada participante (puntos, desempate por plenos).
- **Puntos por Equipo** (historico): para cada equipo, quien sumo mas puntos en los partidos de ese equipo. Formato `[equipo] [participante] [puntos]`. Los equipos salen de la descripcion del partido (`Boca - River`); se agrupan sin importar tildes ni mayusculas.

Reglas de las rachas: se recorren los partidos en orden (fecha por fecha, partido por partido) de los torneos que jugo cada participante. Un 9-9 o no mandar prode corta la racha; los partidos sin resultado cargado (o anulados con 9-9) se saltean.

La API: `GET /api/other-tables` devuelve `{ sinPlenos, plenosSeguidos, simplesSeguidos, puntosEnUnaFecha, puntosPorEquipo }`.

### Puntuacion

- **Pleno (resultado exacto)**: 3 puntos
- **Acierto de ganador/empate**: 1 punto
- **Error**: 0 puntos

Desempate: plenos > goles totales predichos

## Comandos utiles

### Borrar toda la base de datos

```bash
cd backend
npm run db:wipe
```

Esto elimina todos los datos: torneos, fechas, partidos, predicciones, mapeos e inputs de WhatsApp.

### Cargar mapeos desde archivo

```bash
cd backend
npm run db:seed-mappings
```

Lee el archivo `mappings.txt` en la raiz del proyecto y carga los mapeos. Formato del archivo:
```
+54 9 381 574-8792=Pablo
+54 9 381 456-3246=Juan
```

### Debug del parser

Ir a `/debug` en el frontend para probar el parser de WhatsApp sin guardar datos. El selector **Parser** permite elegir entre el formato WhatsApp y el de WP Web.

## Notas

- El resultado "9-9" se considera como prediccion en blanco (no se cuenta)
- Los puntos se calculan on-the-fly, no se guardan en la DB
- La tabla de torneo muestra puntos acumulados HASTA la fecha seleccionada
- Todos los inputs de WhatsApp se guardan en la tabla `WhatsappInput` para auditoria/backup
