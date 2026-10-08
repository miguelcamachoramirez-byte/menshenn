# Gestor de Reportes

Aplicacion web construida con **Next.js 14 (App Router)**, **TypeScript**, **Prisma** y **PostgreSQL** para crear, listar y eliminar reportes.

Cada reporte guarda:

- **Autor** (quien hace el reporte)
- **Destinatario** (a quien va dirigido)
- **Fecha**
- **Detalle** (opcional)

Incluye un loader mientras cargan los datos y un estado vacio cuando no existen reportes.

---

## Requisitos

- Node.js 18 o superior
- Una base de datos PostgreSQL (local o en la nube: Neon, Supabase, Railway, etc.)

---

## Puesta en marcha local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea un archivo `.env` a partir del ejemplo y pon tu cadena de conexion:

   ```bash
   cp .env.example .env
   ```

   Edita `DATABASE_URL` con los datos de tu PostgreSQL:

   ```
   DATABASE_URL="postgresql://usuario:contrasena@localhost:5432/reportes?schema=public"
   ```

3. Crea las tablas en la base de datos:

   ```bash
   npm run db:push
   ```

4. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Abre http://localhost:3000

---

## Scripts disponibles

| Script             | Descripcion                                          |
| ------------------ | ---------------------------------------------------- |
| `npm run dev`      | Servidor de desarrollo                               |
| `npm run build`    | Genera el cliente Prisma y compila para produccion   |
| `npm run start`    | Arranca la app ya compilada                          |
| `npm run db:push`  | Sincroniza el esquema Prisma con la base de datos    |
| `npm run db:studio`| Abre Prisma Studio para ver/editar datos             |

---

## API

| Metodo | Ruta                 | Descripcion                 |
| ------ | -------------------- | --------------------------- |
| GET    | `/api/reports`       | Lista todos los reportes    |
| POST   | `/api/reports`       | Crea un reporte             |
| DELETE | `/api/reports/:id`   | Elimina un reporte por id   |

Cuerpo esperado en POST:

```json
{
  "author": "Juan Perez",
  "recipient": "Gerencia",
  "reportDate": "2026-10-08",
  "content": "Texto opcional"
}
```

---

## Despliegue

### Opcion recomendada: Vercel + PostgreSQL gestionado

1. Sube el repositorio a GitHub.
2. Crea una base de datos PostgreSQL en un proveedor como [Neon](https://neon.tech), [Supabase](https://supabase.com) o [Railway](https://railway.app) y copia su cadena de conexion.
3. En [Vercel](https://vercel.com), importa el repositorio.
4. En **Settings > Environment Variables** agrega:

   ```
   DATABASE_URL = <tu cadena de conexion de PostgreSQL>
   ```

5. Despliega. El comando de build (`prisma generate && next build`) ya esta configurado.
6. La primera vez, aplica el esquema a la base de datos de produccion ejecutando localmente (apuntando a la DB de produccion):

   ```bash
   npx prisma db push
   ```

   > Para proyectos con historial de cambios usa migraciones: `npx prisma migrate deploy`.

### Otras plataformas (Railway, Render, Fly.io)

- Define la variable de entorno `DATABASE_URL`.
- Comando de build: `npm run build`
- Comando de inicio: `npm run start`

---

## Estructura del proyecto

```
app/
  api/reports/route.ts        GET (listar) y POST (crear)
  api/reports/[id]/route.ts   DELETE (eliminar)
  components/Loader.tsx        Loader reutilizable
  globals.css                  Estilos
  layout.tsx                   Layout raiz
  page.tsx                     Vista principal (formulario + lista)
lib/prisma.ts                  Cliente Prisma (singleton)
prisma/schema.prisma           Modelo de datos
```

---

# menshenn
