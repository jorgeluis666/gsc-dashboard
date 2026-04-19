# Dashboard GSC · Lima Retail

Dashboard SEO para Google Search Console. Vanilla JS puro, sin frameworks ni build steps.

## Estructura

```
dashboard-GSC-SEO/
├── index.html          # Entrada principal
├── css/
│   └── styles.css      # Todos los estilos
├── js/
│   ├── parser.js       # Parsing y normalización de CSVs de GSC
│   ├── drive.js        # Integración OAuth con Google Drive
│   └── app.js          # Estado, lógica de tabs y render
├── .gitignore
└── README.md
```

## Uso rápido (carga manual)

1. Abre `index.html` en el navegador (o en GitHub Pages).
2. Pulsa **↑ Subir CSV** y selecciona uno o varios archivos de GSC.
3. Confirma la etiqueta del período y guarda.
4. Navega por los tabs: **Overview → Oportunidades → Variación → Ideas**.

## Formato de archivos CSV

Los exports de GSC deben ser comparaciones semanales. El formato es:

```
Label, DD/M/YY-DD/M/YY Clics, DD/M/YY-DD/M/YY Clics, ... (8 columnas)
```

El parser detecta automáticamente el tipo de cada archivo (Consultas, Páginas, Gráfico, Dispositivos, Países) por los encabezados o por el contenido de la primera fila.

Cada carga de comparación crea **2 snapshots** automáticamente: período A (más reciente) y período B (anterior).

## Integración con Google Drive

Permite sincronizar automáticamente sin subir archivos manualmente.

### Configuración OAuth

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) → crea un proyecto.
2. Activa la **Google Drive API**.
3. Credenciales → **ID de cliente OAuth 2.0** → tipo: Aplicación web.
4. En "Orígenes autorizados de JavaScript" agrega el dominio donde está publicado el dashboard (ej: `https://jorgeluis666.github.io`).
5. Copia el **Client ID**.

### Estructura de carpetas en Drive

La carpeta es plana (sin subcarpetas). Los archivos se nombran con el patrón:

```
PERIODO_TipoArchivo.csv
```

Ejemplo:

```
📁 GSC-Lima-Retail/          ← pega el ID de esta carpeta en Configuración
   📄 2026-W14_Consultas.csv
   📄 2026-W14_Páginas.csv
   📄 2026-W14_Gráfico.csv
   📄 2026-W14_Dispositivos.csv
   📄 2026-W14_Países.csv
   📄 2026-W15_Consultas.csv
   📄 2026-W15_Páginas.csv
   ...
```

El prefijo antes del guion bajo (`2026-W14`) se usa como identificador del período. El dashboard agrupa los archivos por período y solo importa los nuevos al pulsar **Actualizar datos**.

### Conectar Drive desde el dashboard

1. Tab **Configuración** → pega el Client ID y el Folder ID → **Guardar**.
2. Pulsa **Conectar con Google** → autoriza en el popup.
3. Pulsa **↻ Actualizar datos** para importar períodos nuevos.

## Tabs

| Tab | Descripción |
|---|---|
| Overview | Métricas globales + 5 tablas de páginas (top clics, subidas y bajadas) |
| Oportunidades | Quick wins, snippet roto, transaccionales invisibles |
| Consultas | Todas las consultas con filtro de texto |
| Transaccionales | Páginas de servicio y consultas de Meta/Google/TikTok Ads |
| Seguimiento | Tracking de URLs puntuales con evolución semana a semana y notas |
| Ideas | A–D: temas sin cubrir, rank boost, puente de tráfico, soporte a páginas de servicio |
| Variación | Comparación entre dos snapshots (requiere 2+) |
| Configuración | Client ID OAuth + Folder ID de Drive |
| Snapshots | Gestión de todos los períodos cargados |

## Datos persistentes

Todo se guarda en `localStorage` bajo la clave `gsc_v2`. No se envía nada a ningún servidor.
