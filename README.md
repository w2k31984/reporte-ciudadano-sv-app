# Reporte Ciudadano SV

App para que una persona reporte un problema de la ciudad con foto y ubicación, y para que el equipo lo siga en un mapa.

## Requisitos

- Node.js 20 o más nuevo
- Un proyecto de Supabase

## Instalación

```bash
npm install
```

Copiá las variables de abajo a un archivo `.env.local` en la raíz. Ese archivo no se sube a git.

En un proyecto nuevo, ejecutá `schema.sql` completo en Supabase, SQL Editor.

Si la base ya existía, no hace falta volver a correr todo el archivo. Ejecutá en SQL Editor el bloque `submit_report` (desde `create or replace function public.submit_report` hasta su `grant execute`) y el `update storage.buckets` del bucket `report-photos`. Sin esa función, el formulario no puede devolver el código y a la vez impedir que el rol anónimo lea la tabla `reports`.

Creá el usuario del panel en Supabase: Authentication, Users, Add user, con correo y contraseña.

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

## Variables de entorno

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | Dirección del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente y servidor | Clave publicable. Con ella el anónimo solo puede crear reportes y consultar un código |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | Revisa y borra fotos del bucket privado. No la uses en el navegador ni le pongas el prefijo `NEXT_PUBLIC_` |
| `VISION_API_KEY` | Solo servidor | Clave de Gemini para sugerir la categoría |
| `VISION_MODEL` | Solo servidor | Por ejemplo `gemini-3.8-flash` |
| `NEXT_PUBLIC_APP_URL` | Cliente y servidor | Dirección pública, sin barra al final. El QR de `/qr` apunta a `{NEXT_PUBLIC_APP_URL}/reportar`. Si no está, usa el host de la petición |

Ejemplo:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
VISION_API_KEY=...
VISION_MODEL=gemini-3.8-flash
NEXT_PUBLIC_APP_URL=https://tu-app.vercel.app
```

## Desplegar en Vercel

1. Subí el repositorio a GitHub.
2. En Vercel, Import Project y elegí ese repositorio. El framework es Next.js.
3. En Environment Variables cargá las seis variables de arriba. `NEXT_PUBLIC_APP_URL` tiene que ser la URL pública de Vercel, por ejemplo `https://reporte-ciudadano.vercel.app`.
4. Deploy.
5. En el teléfono de la demo, el QR de `/qr` abre `/reportar` en esa URL.

El panel está en `/admin`. En la demo, `/admin?demo=1` muestra el botón de reporte de prueba.

## Límites del reporte

- La foto puede pesar hasta 5 MB y tiene que ser JPG, PNG o WebP.
- Cada dispositivo puede enviar 5 reportes por hora. Una misma IP puede enviar hasta 40 en esa hora.
