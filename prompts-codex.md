# Reporte Ciudadano SV — Prompts para Codex

Usá estos prompts **en orden**, uno por sesión de trabajo. Después de cada uno, corré la app, verificá el resultado con la lista de "Listo cuando..." y hacé commit antes de seguir.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Storage, Realtime, Auth) + react-leaflet con OpenStreetMap + un modelo de visión por API para clasificar la foto.

---

## Antes de empezar (manual, 20 min)

1. Crear proyecto en Supabase y ejecutar `schema.sql` en el SQL Editor.
2. Crear un usuario administrador en Authentication > Users.
3. Crear el repo y guardar el archivo `AGENTS.md` de abajo en la raíz.
4. Crear `.env.local` con:
   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   VISION_API_KEY=
   VISION_MODEL=
   ```

### AGENTS.md (contexto permanente para Codex)

```
# Proyecto: Reporte Ciudadano SV
App para que ciudadanos reporten problemas urbanos (baches, luminarias, basura,
fugas de agua, drenaje, arboles caidos) con foto y ubicacion, y para que un
administrador les de seguimiento en un mapa en tiempo real.

## Reglas
- Next.js App Router, TypeScript estricto, Tailwind. Sin librerias de UI pesadas.
- Diseño mobile-first en la parte ciudadana (probar en 390px de ancho).
- Panel admin pensado para pantalla grande (proyector), pero usable en tablet.
- Toda la interfaz en español de El Salvador, tono cercano y claro.
- Base de datos: Supabase. El esquema esta en schema.sql y NO se modifica sin avisar.
- Las claves secretas nunca van al cliente. La clasificacion con IA se hace en una
  ruta de servidor (app/api/classify).
- Mapa: react-leaflet con OpenStreetMap, cargado con dynamic import y ssr: false.
- Categorias validas: bache, luminaria, basura, fuga_agua, drenaje, arbol_caido, otro.
- Estados validos: recibido, en_proceso, resuelto.
- Mantener el codigo simple: es un MVP para una demo en vivo de 2 minutos.
```

---

## Prompt 1 — Base del proyecto

```
Lee AGENTS.md y schema.sql. Crea el proyecto Next.js con TypeScript y Tailwind.
Configura el cliente de Supabase (uno para navegador y uno para servidor) usando las
variables de entorno. Crea las rutas vacias:
- /            portada ciudadana con boton grande "Reportar un problema" y campo para consultar por codigo
- /reportar    formulario de reporte
- /seguimiento consulta de estado por codigo
- /admin/login inicio de sesion del administrador
- /admin       panel (protegido)
Agrega un layout con encabezado simple, colores sobrios y tipografia legible.
Incluye un archivo lib/types.ts con los tipos de Report, ReportCategory y ReportStatus.
```
**Listo cuando:** `npm run dev` levanta, las 5 rutas cargan y la portada se ve bien a 390px.

---

## Prompt 2 — Flujo ciudadano: crear reporte

```
Implementa /reportar como un flujo de 3 pasos en una sola pantalla:
1. Foto: boton para tomar foto con la camara del celular (input file con
   capture="environment") o elegir de galeria. Mostrar vista previa.
   Comprimir la imagen en el navegador a maximo 1280px de lado antes de subirla.
2. Ubicacion: pedir geolocalizacion del navegador (navigator.geolocation). Mostrar un
   mapa pequeno con un marcador que el usuario pueda arrastrar para corregir.
   Si niega el permiso, permitir tocar el mapa para elegir el punto.
3. Detalles: categoria (botones grandes con icono), descripcion opcional y un
   checkbox obligatorio: "Acepto que mi foto se use para atender este reporte".
Al enviar: subir la foto al bucket report-photos, insertar el reporte en la tabla
reports y mostrar una pantalla de exito con el codigo de seguimiento en grande y
un boton para copiarlo.
Maneja estados de carga, errores de red y evita envios duplicados.
```
**Listo cuando:** desde un celular real, un reporte con foto aparece en la tabla `reports` de Supabase con su `tracking_code`.

---

## Prompt 3 — Clasificación con IA

```
Crea la ruta de servidor app/api/classify/route.ts:
- Recibe la foto (base64 o URL firmada) por POST.
- Llama a un modelo de vision usando VISION_API_KEY y VISION_MODEL.
- El prompt debe pedir SOLO un JSON con: category (una de las categorias validas),
  summary (maximo 12 palabras en español) y confidence (0 a 1). Si la imagen no
  muestra un problema urbano, category = "otro" y confidence baja.
- Valida la respuesta con zod. Si falla o tarda mas de 8 segundos, devuelve
  category "otro" y un mensaje neutro, sin romper el flujo.
En /reportar, cuando el usuario elige la foto, llama a esta ruta y preselecciona la
categoria sugerida con una etiqueta "Sugerido por IA" que el usuario puede cambiar.
Guarda ai_category, ai_summary y ai_confidence al enviar el reporte.
```
**Listo cuando:** fotos de un bache, una luminaria y basura sugieren la categoría correcta en menos de 5 segundos, y una foto irrelevante cae en "otro" sin errores.

---

## Prompt 4 — Seguimiento del ciudadano

```
Implementa /seguimiento:
- Campo para escribir el codigo (formato SV-XXXXXX), con validacion.
- Llama a la funcion RPC get_report_status y muestra el estado como una linea de
  tiempo de 3 pasos: Recibido, En proceso, Resuelto, con el paso actual resaltado.
- Si el codigo no existe, mensaje amable de error.
La portada tambien debe permitir entrar aqui con el codigo. Al final del flujo de
crear reporte, agrega un enlace directo al seguimiento con el codigo ya cargado.
```
**Listo cuando:** cambiar el estado en Supabase se refleja al recargar `/seguimiento`.

---

## Prompt 5 — Panel admin: login y mapa en tiempo real

```
Implementa el panel de administrador:
1. /admin/login con correo y contraseña usando Supabase Auth. Proteger /admin con
   middleware: sin sesion, redirigir a login.
2. /admin: pantalla dividida. Izquierda (70%) mapa react-leaflet centrado en
   San Salvador; derecha (30%) lista de reportes recientes.
3. Marcadores por reporte con color segun estado (rojo recibido, ambar en proceso,
   verde resuelto) y un icono o inicial segun categoria.
4. Suscribete con Supabase Realtime a INSERT y UPDATE en la tabla reports. Los
   reportes nuevos deben aparecer en el mapa y en la lista SIN recargar, con una
   animacion breve de destaque y un contador "Total / Recibidos / En proceso / Resueltos"
   que se actualice solo.
5. Al hacer clic en un marcador o en un item de la lista: abrir un panel de detalle
   con foto (URL firmada del bucket privado), categoria, resumen de IA, descripcion,
   fecha y codigo.
Limpia la suscripcion al salir de la pagina.
```
**Listo cuando:** con dos ventanas abiertas, un reporte enviado desde el celular aparece en el mapa admin en menos de 3 segundos.

---

## Prompt 6 — Gestión de estados y moderación

```
En el panel de detalle del admin agrega:
- Botones para cambiar el estado (recibido -> en proceso -> resuelto). Actualiza la
  tabla reports y confirma con un aviso breve.
- Boton "Ocultar reporte" (is_hidden = true) con confirmacion, para moderar
  contenido inapropiado. Los ocultos no se muestran en el mapa.
- Historial de cambios leido de report_events.
- Filtros arriba de la lista: por estado y por categoria.
Asegurate de que el cambio de estado tambien se propague en tiempo real a otras
ventanas del panel abiertas.
```
**Listo cuando:** cambiar un estado en una ventana actualiza el color del marcador en otra, y el ciudadano lo ve en `/seguimiento`.

---

## Prompt 7 — Modo demo y pulido

```
Prepara la app para una demo en vivo:
1. Pagina /qr que muestre un QR grande apuntando a la URL publica de /reportar,
   con el texto "Reporta un problema de tu ciudad".
2. En /admin, un modo pantalla completa que oculte controles secundarios y muestre
   el contador total en grande.
3. Un boton oculto (solo visible con ?demo=1) que genere un reporte de prueba
   aleatorio alrededor del centro de San Salvador, por si falla la conexion del publico.
4. Pantallas de carga (skeletons), mensajes de error claros y estados vacios.
5. Revisa accesibilidad basica: contraste, tamaños tactiles minimos de 44px y
   etiquetas en formularios.
```
**Listo cuando:** podés hacer la demo completa de 2 minutos sin tocar el código.

---

## Prompt 8 — Seguridad y revisión final

```
Revisa el proyecto y corrige:
- Que ninguna clave secreta llegue al cliente.
- Limites: tamaño maximo de foto (5 MB), tipos permitidos (jpeg, png, webp), y
  limite simple de reportes por IP/dispositivo para evitar spam.
- Que las politicas RLS de schema.sql se cumplan desde la app (el anon no puede leer
  la tabla reports).
- Manejo de errores en todas las llamadas a Supabase y a la API de vision.
- README con instrucciones de instalacion, variables de entorno y como desplegar en Vercel.
Lista los riesgos que queden pendientes.
```
**Listo cuando:** desplegado en Vercel, probado con datos móviles y con el README completo.

---

## Guion de demo (2 minutos)

1. **(0:00)** «En El Salvador reportar un bache es difícil. Miren cómo puede ser en 20 segundos.»
2. **(0:15)** Mostrar el QR. Pedir a 3 o 4 asistentes que escaneen y reporten algo real de la zona.
3. **(0:45)** Pantalla del panel: los reportes aparecen en el mapa en vivo; mostrar la categoría sugerida por la IA.
4. **(1:15)** Abrir un reporte, cambiarlo a «en proceso» y mostrar el cambio en el celular del asistente.
5. **(1:40)** Cierre: «Esto es un piloto listo para una alcaldía. Si querés probarlo en tu comunidad, hablemos.»

**Plan B:** video grabado de esta misma demo + el botón de reportes de prueba (`?demo=1`).
