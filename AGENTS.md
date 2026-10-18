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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->