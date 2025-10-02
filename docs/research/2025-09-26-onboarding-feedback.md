# 2025-09-26 Feedback de prueba con usuaria (Android + web)

**Fuente**: Sesion de acompaniamiento durante el flujo de configuracion inicial y modulos basicos.
**Objetivo**: Documentar hallazgos para planear fixes de corto plazo y mejoras de onboarding.

## Problemas criticos (bloquean completar configuracion inicial)

- **Onboarding Android sin CTA visible**
  - Observacion: En la primera pantalla de bienvenida el boton "Siguiente" queda oculto bajo el fold y requiere hacer scroll.
  - Impacto: La usuaria no avanza sin ayuda. En dispositivos pequenos la configuracion inicial queda bloqueada.
  - Accion sugerida: Ajustar layout para que el CTA principal tenga posicion fija / margen inferior suficiente.

- **Configuracion de tiempo no guarda**
  - Observacion: Tras llenar dias=26, horas=8 y productividad=80%, el sistema arroja error "debe ser al menos una hora y al menos un dia" o "no hay clinica seleccionada".
  - Impacto: Bloquea el avance del onboarding; sin configuracion de tiempo no se puede continuar con tarifas.
  - Accion sugerida: Revisar validaciones, asignacion de clinica por defecto y mensajes de error.

- **Tarifario inutilizable tras crear servicio**
  - Observacion: Aunque se creo el servicio "Limpieza dental", el tarifario no lo muestra y exige "al menos una tarifa requerida".
  - Impacto: Detiene el flujo. La configuracion inicial queda incompleta.
  - Accion sugerida: Sincronizar servicios recien creados con el modulo de tarifas y revisar dependencias.

## Prioridad alta (problemas de claridad y consistencia)

- **Formulario de registro**
  - Campo Apellido ocupa media columna en mobile; parece que solo acepta un apellido. Pedimento: moverlo debajo de Nombre para dar espacio.
  - Tras registrarse no se informa que se envio un codigo al correo; la usuaria no busca el email.
  - Email de confirmacion sin diseno ni copy amigable.

- **Toasts e indicadores de progreso**
  - Faltan confirmaciones claras al crear activos/insumos/servicios durante la configuracion inicial.
  - Toast de error con "claves duplicadas" al crear servicio (probable mensaje bruto de base de datos).

- **Navegacion e i18n**
  - En workspace aparecen textos "settings", "clinic" sin traducir.
  - Botones de clinica / workspace no navegan a sus paginas.
  - Icono de Aralis deberia llevar a un estado de progreso de configuracion, no al dashboard inexistente.
  - Cambio de idioma en login no persiste preferencia del usuario.

- **Jerarquia de acciones**
  - Boton "Configurar tiempo" no luce interactivo; falta affordance.
  - En configuracion inicial, boton primario deberia resaltarse y "Cancelar configuracion" pasar a estado destructivo (rojo).
  - Botones para "Agregar" (activos, tarifas, etc.) deben quedar por encima del scroll en Android para que no se oculten.

- **Consistencia de datos clave**
  - Activo creado en depreciacion no aparece luego en costos fijos.
  - Tarjetas de insumos no muestran precio por porcion ni total en Android.
  - Tarjetas de servicios carecen de resumen de insumos y acciones rapidas.

## Mejoras de experiencia (prioridad media)

- Proveer ejemplos en campos clave (activos, servicios, recetas) para guiar a usuarios nuevos.
- Aclarar que "precio base" en servicios es un dato calculado/no editable.
- Elevar la seccion de "insumos relacionados" dentro de la modal de servicio y advertir cuando falta completar pasos obligatorios.
- Ajustar copy: en configuracion inicial se mezcla "Recetas" vs "Servicios" causando confusion.
- Mostrar toast cuando se completa una categoria de configuracion inicial para reforzar progreso (gamificacion ligera).
- Al abrir secciones de onboarding por primera vez, aplicar efecto visual que resalte el boton principal (overlay opaco + foco temporal).

## Problemas especificos de Android / mobile

- Icono de "palomita" (IME action Done) no cierra el teclado ni confirma el campo.
- Teclado virtual impide hacer scroll dentro de modales largas; falta ajuste de viewport o comportamiento de cierre al tocar fuera.
- Al cambiar idioma desde login en Android, algunas pantallas siguen apareciendo en ingles.

## Siguientes pasos propuestos

1. Corregir formulario de registro (layout + toast informativo) y revisar copy del email de confirmacion.
2. Auditar flujo de configuracion de tiempo y dependencias con clinica seleccionada.
3. Revisar integracion servicios -> tarifario y mensajes de error.
4. Planificar un barrido de i18n y navegacion dentro del workspace.
5. Priorizar mejoras mobile (botones visibles, teclado) en sprints dedicados.

