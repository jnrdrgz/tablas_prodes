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

6. **Cargar resultados** - Cuando terminen los partidos, cargar los resultados reales

7. **Ver tabla** - La tabla de puntos se calcula automaticamente

### Torneos suscritos

Un torneo puede "suscribirse" a otro. Esto significa que:
- Las fechas se crean automaticamente cuando se crean en el torneo principal
- Los partidos se copian automaticamente
- Los resultados se sincronizan
- Las predicciones son independientes (cada torneo tiene sus propias predicciones)

Util para tener el mismo fixture con diferentes grupos de amigos.

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

Ir a `/debug` en el frontend para probar el parser de WhatsApp sin guardar datos.

## Notas

- El resultado "9-9" se considera como prediccion en blanco (no se cuenta)
- Los puntos se calculan on-the-fly, no se guardan en la DB
- La tabla de torneo muestra puntos acumulados HASTA la fecha seleccionada
- Todos los inputs de WhatsApp se guardan en la tabla `WhatsappInput` para auditoria/backup
