# Reporte Ciudadano SV

App para que una persona reporte un problema de su ciudad con foto y ubicación, y para que un administrador le dé seguimiento en un mapa en tiempo real.

Las categorías son bache, luminaria, basura, fuga de agua, drenaje, árbol caído y otro. Los estados son recibido, en proceso y resuelto.

## Rutas

| Ruta | Quién la usa |
| --- | --- |
| `/` | Portada. Desde aquí se entra a reportar o a consultar un código |
| `/reportar` | Formulario en tres pasos: foto, lugar en el mapa y detalles |
| `/seguimiento` | Consulta el estado con el código `SV-XXXXXX` |
| `/qr` | QR grande para la demo. Abre `/reportar` |
| `/admin/login` | Ingreso del equipo de administración |
| `/admin` | Mapa y lista de reportes. El detalle permite cambiar el estado, ocultar el reporte y ver el historial con fecha y hora |
| `/admin?demo=1` | Igual que el panel, más un botón para crear un reporte de prueba cerca del centro de San Salvador |

## Requisitos

- Node.js 20 o más nuevo
- Un proyecto de Supabase

## Instalación

```bash
npm install
```

Copiá las variables de la sección siguiente a un archivo `.env.local` en la raíz. Ese archivo no se sube a git.

En un proyecto nuevo, ejecutá `schema.sql` completo en el SQL Editor de Supabase.

Si la base ya existía, no hace falta volver a correr todo el archivo. Ejecutá el bloque `submit_report` (desde `create or replace function public.submit_report` hasta su `grant execute`) y el `update storage.buckets` del bucket `report-photos`. Sin esa función, el formulario guarda el reporte por un camino de respaldo. Con ella, el rol anónimo recibe solo el código y no puede leer la tabla `reports`.

Creá el usuario del panel en Supabase: Authentication, Users, Add user, con correo y contraseña. Cualquier usuario autenticado entra al panel.

```bash
npm run dev
```

La app queda en `http://localhost:3000`.

Otros comandos:

```bash
npm run lint
npm run build
npm start
```

## Variables de entorno

| Variable | Dónde | Para qué |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | Dirección del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente y servidor | Clave publicable. Con ella el anónimo solo puede crear reportes y consultar un código |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | Revisa y borra fotos del bucket privado, y lee el código recién creado si `submit_report` todavía no está instalada. No la uses en el navegador ni le pongas el prefijo `NEXT_PUBLIC_` |
| `VISION_API_KEY` | Solo servidor | Clave de Gemini para sugerir la categoría a partir de la foto |
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

## Probar en el celular

Con `npm run dev`, la terminal muestra una dirección de la red, por ejemplo `http://192.168.1.5:3000`. El celular tiene que estar en la misma red Wi-Fi.

Para que el QR use esa dirección, ponela en `NEXT_PUBLIC_APP_URL` y reiniciá el servidor.

## Demo en vivo

1. Abrí `/qr` en el proyector. El código apunta a la URL pública de `/reportar`.
2. Entrá al panel en `/admin`. El botón de pantalla completa agranda el total y oculta los controles secundarios.
3. Si falla la conexión del público, entrá a `/admin?demo=1` y usá el botón de reporte de prueba.

## Límites del reporte

- La foto puede pesar hasta 5 MB y tiene que ser JPG, PNG o WebP.
- Cada dispositivo puede enviar 5 reportes por hora. Una misma IP puede enviar hasta 40 en esa hora.
- El límite vive en la memoria del servidor. Se reinicia al recargar el proceso y no se comparte entre varias instancias.

## Desplegar en Vercel

1. Subí el repositorio a GitHub.
2. En Vercel, Import Project y elegí ese repositorio. El framework es Next.js.
3. En Environment Variables cargá las seis variables de arriba. `NEXT_PUBLIC_APP_URL` tiene que ser la URL pública de Vercel, por ejemplo `https://reporte-ciudadano.vercel.app`.
4. Deploy.
5. En el teléfono de la demo, el QR de `/qr` abre `/reportar` en esa URL.

El panel queda en `/admin`.
