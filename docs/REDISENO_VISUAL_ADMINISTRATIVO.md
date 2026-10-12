# Modernización visual administrativa

## Alcance
Sistema compartido inspirado en la claridad administrativa de Buk, sin incorporar su marca. Conserva los logos, la paleta corporativa y los módulos existentes. Nunito Sans sustituye Poppins por petición expresa de esta fase.

El piloto es Gestión de Convocatorias. Los estilos comunes se aplican transversalmente a las vistas y ventanas existentes: Selección, Formación/OJT, Talento, Analítica y Administración. Calidad y Mejora no aparece como módulo independiente en el repositorio revisado; no se inventaron pantallas ni funcionalidades.

## Archivos de esta intervención
- `index.html`: carga de Nunito Sans 400/500/600/700.
- `src/index.css`: tokens de densidad, tipografía, bordes, sombras, formularios, tablas, foco y adaptación móvil.
- `src/views/ConvocatoriasView.tsx`: clases del piloto, sin cambiar cálculos ni controles.
- `src/components/layout/Header.tsx`: una sola línea de ubicación y botón de navegación móvil.
- `src/components/layout/Sidebar.tsx`: presentación compartida y cierre del menú móvil al navegar.
- `src/App.tsx`: estado exclusivamente visual de apertura del menú móvil.

No se modificaron servicios, autenticación, permisos, rutas, integraciones, reglas ni datos como parte de este rediseño. Se conservaron los cambios previos del árbol de trabajo.

## Verificación realizada
- `npm run check`: correcto.
- `npm run build`: correcto; advertencia de bundle Firebase mayor a 500 kB, no bloqueante y fuera del alcance visual.
- Sesión administrativa real en localhost: búsqueda por código reduce Convocatorias de 2 a 1; Limpiar restaura ambas; Filtros expande/contrae; Nueva convocatoria abre y Cancelar cierra sin escribir datos.
- Formación: Capacitaciones y dashboard renderizan estados vacíos reales, sin gráficos inventados.
- Administración: tabla de 5 usuarios renderizada sin desbordamiento del documento.
- Viewports 1440x900, 1024x768 y 390x844: sin desbordamiento horizontal del documento en las vistas revisadas. Las tablas anchas conservan desplazamiento interno.
- Menú móvil abre y permite navegar a Panel de Formación; se cierra tras seleccionar la vista.

Estas comprobaciones son visuales y de navegación, no una certificación de todas las operaciones CRUD ni de todos los roles. No se guardaron formularios ni se alteraron datos reales. No se desplegó a producción.

## Extensión global posterior al piloto
La envoltura `talent-view` de App aplica el sistema a todas las vistas actuales, no solo a Convocatorias: encabezados, superficies y cards, textos secundarios, formularios, tablas, tooltips de gráficos y ventanas. El formulario de login adopta los mismos radios y tipografía, preservando el video, posición y autenticación.

Revisión adicional con sesión ADMIN, sin guardar datos: Directorio de candidatos (1 fila), Pipeline (2 convocatorias), Panel de Formación, Capacitaciones, Capacitaciones asignadas, Participantes, OJT, Contrataciones y Altas, Reportería y SLAs, Usuarios (5 filas) y Configuración. Todas renderizaron contenido sin desbordamiento horizontal del documento a 1440px. Los flujos operativos de grupos vacíos no pueden validarse con esta sesión sin crear datos; no se crearon registros ficticios. Los cambios adicionales se centralizaron en `src/index.css` y la clase de presentación en `src/App.tsx`.
