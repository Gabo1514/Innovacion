# Buganvilla Tours 2.0

Portal turístico para Huacachina, Paracas, Nasca e Ica. Fotografía real de Buganvilla y Unsplash, tipografías Bricolage Grotesque, Instrument Serif y DM Sans, y una paleta de desierto al atardecer: noche cálida, arena, oro y magenta buganvilla. HTML5, CSS modular y JavaScript nativo, con API Python y SQLite para reservas. No requiere un compilador de frontend.

El catálogo permite buscar por destino y texto, ordenar por precio o duración, guardar favoritos, comparar hasta tres recorridos y consultar itinerarios. Mi viaje conserva una selección en este navegador, calcula estimaciones por grupo y permite descargar un resumen o preparar una consulta por WhatsApp. La portada tiene traducción ES/EN y precios referenciales PEN/USD/EUR; el checkout UTV sigue en español y permite PEN/USD. Las preferencias EUR pasan a PEN al reservar, con una indicación visible.

La ficha UTV incluye disponibilidad por salida, checkout, voucher con QR y PDF, y un panel operativo protegido. Las reservas se conservan en SQLite y se comparten entre los navegadores que usan este servidor.

## Cómo probarlo (para el equipo)

1. Instala **Python 3** desde https://www.python.org/downloads/ y marca **"Add Python to PATH"** durante la instalación.
2. Descarga el proyecto: botón verde **Code → Download ZIP** en GitHub (y descomprímelo) o `git clone https://github.com/Gabo1514/Innovacion.git`.
3. Haz doble clic en **`iniciar.cmd`**. La primera vez instala lo necesario y luego abre la página en el navegador (http://127.0.0.1:8000/).
4. Prueba una reserva en **Reservar UTV** con cualquier número de tarjeta de 13 a 19 dígitos, fecha futura y CVV (no se cobra nada).
5. Panel del operador: http://127.0.0.1:8000/admin.html — contraseña `Buganvilla2026!`.

Dónde está el código: `index.html` (portada), `tour-utv.html` (reserva), `voucher.html` (mi reserva), `admin.html` (panel), `css/` (estilos), `js/` (lógica del navegador) y `server.py` (servidor Python con SQLite).

## Iniciar

Haz doble clic en `iniciar.cmd`: abre el navegador y deja el servidor en segundo plano. También puedes ejecutar desde esta carpeta en PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

La dirección aparece en la consola y se abre automáticamente. El puerto inicial es 8000; si está ocupado, el lanzador busca uno libre hasta 8010. Un segundo inicio reutiliza el servidor de esta misma carpeta. El servidor escucha exclusivamente en la interfaz local. No abras los archivos HTML directamente: la reserva y el registro de correos requieren la API. Para otro puerto inicial, añade `-Port 8100`; `-NoBrowser` inicia sin abrir el navegador. El lanzador elige Python con ReportLab instalado y utiliza el runtime incluido en Codex cuando el Python del sistema no tiene esa biblioteca.

Para detener el servidor iniciado por el lanzador:

```powershell
$portal = Get-Content .runtime/inicio.json -Raw | ConvertFrom-Json
Stop-Process -Id $portal.processId
```

Alternativa con un entorno Python propio:

```powershell
python -m pip install -r requirements.txt
python server.py --port 8000
```

La base se crea automáticamente en `.runtime/buganvilla.sqlite3`. Puedes elegir una base separada con `python server.py --db ruta.sqlite3`. Los datos privados y el código del servidor no se sirven como archivos web.

## Demostración del producto

1. Abre la ficha UTV y selecciona fecha, turno, viajeros y complementos.
2. Al continuar, el servidor retiene los vehículos durante diez minutos. Cada reserva privada ocupa `ceil(pasajeros / 3)` UTV y valida el precio en el servidor.
3. Completa los datos del titular y de cada acompañante. El checkout acepta exclusivamente las tarjetas ficticias indicadas en pantalla para simular aprobación o rechazo. El servidor solo recibe el resultado de la simulación y la marca; nunca recibe números de tarjeta ni CVV.
4. Yape/Plin requiere un número de operación y un comprobante PNG, JPG o PDF de hasta 1 MB. El estado queda pendiente de revisión en el panel.
5. Consulta el voucher y descarga un PDF real. Su código QR abre la consulta del estado vigente; el enlace contiene un token privado que funciona como llave de acceso a esa reserva.

El panel está en [http://127.0.0.1:8000/admin.html](http://127.0.0.1:8000/admin.html). Contraseña inicial: `Buganvilla2026!`. Para cambiarla antes de iniciar:

```powershell
$env:BGV_ADMIN_PASSWORD = 'UnaContrasenaPropiaLarga'
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

La sesión del operador vence a las ocho horas. La cookie usa `HttpOnly` y `SameSite=Strict`. El acceso fallido repetido se limita. El botón de datos de demostración carga registros ficticios identificados con códigos `DEMO-`; cargarlo otra vez no los duplica.

## Implementación del plan

| Fase | Implementación |
| --- | --- |
| Identidad e interfaz | Catálogo adaptable, ficha con itinerario, inclusiones, recomendaciones, mapa y reserva móvil. |
| Disponibilidad | SQLite, calendario de 90 días, tres horas de anticipación según Lima, capacidad por vehículos, retenciones reales y prevención de sobreventa mediante transacciones. |
| Checkout y voucher | Precio calculado en el servidor, titulares y acompañantes, pagos simulados, comprobantes sujetos a revisión, estados auditados y PDF con QR. |
| Operación | Inicio de sesión, filtros, reservas, capacidad por turno, cierres operativos, métricas y exportación. |

Estados: `BORRADOR`, `PENDIENTE`, `CONFIRMADA`, `CANCELADA`, `REEMBOLSADA`, `COMPLETADA` y `EXPIRADA`. Las selecciones vencidas liberan su capacidad. Las reservas pendientes conservan sus vehículos hasta revisión o cancelación. Reducir la capacidad por debajo de las reservas y retenciones activas se rechaza; cerrar un turno suspende nuevas reservas y el pago de retenciones existentes.

## Validación

Las pruebas crean una base temporal y no modifican las reservas de la aplicación:

```powershell
python -m unittest discover -s tests -v
node --test tests/tests_checkout.mjs tests/tests_premium.mjs
```

Si tu Python no tiene ReportLab, utiliza el ejecutable elegido por el lanzador. Las pruebas incluyen concurrencia, vencimiento de retenciones, pasajeros, tarifas, pagos rechazados, comprobantes, permisos, estados, privacidad, búsqueda bilingüe, fechas según Lima, límite de comparación y recuperación de preferencias.

## Contenido y consultas

Los datos del catálogo están en `js/premium-data.js`; la traducción base está en `js/premium-i18n.js` y la redacción de portada en `js/premium-copy.js`. `css/experiencia.css` contiene todo el diseño de la portada y `js/experiencia-copy.js` sus textos ES/EN. `js/atlas.js` gestiona la portada cinematográfica: transición entre destinos, color de acento por destino, presentación automática con botón de pausa y sincronización con el catálogo. `js/experiencia.js` añade la introducción animada, la arena en suspensión, la hora de Ica y el atardecer calculado para Huacachina, la cinta de destinos, el manifiesto que se ilumina al desplazarse, los contadores, el recorrido UTV en scroll horizontal, el mapa interactivo del territorio, el parallax y las microinteracciones. Reserva, voucher y panel usan `css/experiencia-paginas.css` sobre `css/premium-bridge.css`, y `js/experiencia-paginas.js` para la portada animada, el progreso de la reserva, la tarjeta con relieve y el confeti de confirmación. `js/selector.js` y `css/selector.css` reemplazan los desplegables nativos por listas con la identidad del sitio (teclado, lector de pantalla y miniaturas de destino); el `<select>` original sigue oculto como fuente de verdad. La portada usa los videos publicados por la agencia (UTV en Huacachina, sobrevuelo de Nasca y glamping) solo en pantallas de 768 px o más y sin ahorro de datos, y la sección «Más del sur» enlaza los demás recorridos publicados en buganvillatours.com. Todas las animaciones respetan la preferencia del sistema de reducir el movimiento. La versión anterior de la portada quedó copiada en `.runtime/backups/antes-rediseno-2026-10-08/`. Se utilizan fotografías reales de Buganvilla Tours y paisajes verificados en Unsplash, con créditos consultables en el footer. Las reseñas se presentan como resúmenes con enlace a su fuente.

El contacto prepara una vista previa y enlaces WhatsApp/correo: no envía el mensaje automáticamente ni guarda esos datos personales en el navegador. El formulario de boletín registra correo, idioma, momento y versión de consentimiento en la tabla privada `newsletter` de SQLite. Valida los datos, evita duplicados y solo registra tras consentimiento expreso. La demostración todavía no envía boletines.

## Alcance para producción

Esta entrega permite presentar y probar un producto local completo. Los precios, turnos, capacidad, cambio de moneda y políticas son referenciales. El checkout no realiza cobros, transferencias, reembolsos, envíos de correo ni notificaciones automáticas. El enlace WhatsApp prepara un mensaje que el usuario puede enviar por su cuenta. El voucher es de demostración y no es un comprobante tributario.

Antes de ofrecer reservas reales, la agencia debe validar sus tarifas, ubicación exacta, condiciones, edades e inventario. El despliegue público requiere un servidor WSGI/ASGI o equivalente, HTTPS, gestión de usuarios y permisos, proveedor de pago con checkout tokenizado y webhooks firmados, conciliación real, comunicación transaccional, políticas de protección y retención de datos, copias de seguridad y observabilidad. `http.server` y la contraseña de ejemplo se usan exclusivamente para la demostración local.
