# Transcripción: Settings, Filtros, UX y Notificaciones

**Fecha**: 2025-12-15
**Usuario**: Isma
**Estado**: 🔲 Pendiente de desglosar en issues

---

## Transcripción Completa

A todos los otros filtros de la aplicación, es decir, la UI de los filtros del Dashboard y cómo se utilizan. Están retrasados en relación a los filtros de tratamiento de gastos. Los filtros de tratamiento de gastos y otros filtros son más modernos que los filtros del Dashboard. Hay que actualizarlos desde el Dashboard para unificar todos los filtros en un mismo sistema de UI. Aunque, por supuesto, cada vista tenga sus propias peculiaridades y cosas que filtrar distinta de otra.

Lo otro que vas a hacer con otra gente es que en "puntos de equilibrio", el progreso mensual dice que faltan 23 días restantes, y sin embargo estamos al día 14 de este mes. No hay manera de que faltan 23 días, si estamos al día 14 de este mes, y si para colmo los días configurados son 20. Entonces, hay que ver eso del progreso mensual, que está en el punto equilibrio. Porque creo que el progreso mensual de Insights, o sea del Dashboard, está mejor. Por tanto, también hay que cambiarle el nombre a Insights y ponerle Dashboard.

En punto de equilibrio, debería estar el análisis de contribución, pero también debería estar en el dashboard, ¿no crees? Pero el análisis de contribución del dashboard debería ser el calculado, basado en los tratamientos de los últimos 90 días, no sino de todos. O sea, si en los tratamientos de los últimos 90 días, como sucede en el punto de equilibrio.

O sea, en el punto de equilibrio, gracias a un análisis de los tratamientos de los últimos 90 días, en simular escenarios, se te da automáticamente un porcentaje de costo variable que se basa en tu histórico. Así también, en el dashboard, deberías hablarte de cuál es el porcentaje de ganancia de cada tratamiento aproximado, basado en los tratamientos de los últimos 90 días. Esto hazlo con otro agente.

Y en sentido general, te digo la verdad: hay problemas con ese sistema porque no se entiende. Es muy difícil de entender. O sea, es como que un punto de equilibrio se convierte a veces en una vista llena de puzles, o sea, llena de elementos que no tienen su propio sentido de cuestión, sino que es como metidos ahí uno por el otro, haciendo una especie de vitral con diferentes cristales, así con diferentes tarjetas con diferentes conceptos, que a veces son hasta difíciles de entender.

La tarjeta que dice "resumen de lenguaje claro" es horrible a nivel de UI. O sea, ¿quién pone en la UI algo que se llama "resumen de lenguaje claro"? No tiene ningún sentido. Así no se hace una aplicación.

Otro agente más para arreglar la cuenta y el perfil. Dice que el teléfono no hay teléfono, y sin embargo ya habíamos configurado un teléfono.

Pero, más importante aún, si la zona horaria se establece por clínica o se establece por cuenta, eso no se ha definido. Y a mí me parece que hay una contraposición entre lo que dice "cuenta" y "perfil de zona horaria", "temas" y "notificaciones". Esas cosas ya están en otros lugares de la configuración y no deberían repetirse ahí.

Además, "cuenta" y "perfil" es raro porque tiene una tarjeta donde te muestra la información y otra tarjeta que simplemente dice "Editar". Y así, esas no son las mejores prácticas UI y UX para este tipo de lugares en configuración.

Porque además en "Cuenta" y "Perfil" y todo lo de "Configuración", no hay un "Ir atrás". No hay ningún tipo de navegación para poder salir de donde estás, ir a otro lugar o ir atrás.

Que, por supuesto, de todo lo que te he dicho hasta ahora, no hay que inventar nada nuevo. Hay que ver lo que ya está hecho antes de hacer algo nuevo. No sé, aquí, inventes algo desde cero como has hecho otras veces. Hay que editar lo que ya está para mejorarlo y, si hay un patrón que se parece en otros lugares, pues entonces ese patrón hay que imitarlo.

Y después, decirme cuál patrón imitaste de qué vista tomaste tal elemento y eso lo colocaste en este o si no, decirme que no había ningún elemento y entonces, por tanto, lo tuviste que crear. En ese caso, guarda en tu memoria que eso es un patrón de código que debemos seguir siempre. Always revisar a ver si ya está algún patrón similar. Si no, imagínate: empezamos a tener flechas de diversos tipos, patrones de diseño de diversos tipos, para hacer una misma cosa en diversos lugares, porque simplemente te olvidas de la historia de lo que hay atrás.

Las notificaciones tienen alertas por correo, pero yo no he podido probar todavía la primera alerta. No sé cuáles son las alertas que tienen. El mismo caso con alertas por SMS. Yo creo que no existen todavía, ni hay ninguna configuración que lo permita.

Notificaciones push: todavía, nosotros no tenemos un icono de notificaciones con las notificaciones pertinentes, ni un sistema que nos diga internamente qué notificaciones tendría ahí el usuario.

En "contraseña", no sé si estará funcionando de verdad. La cambié. Y la autentificación de dos factores, tampoco sé si estará funcionando.

Y de nuevo tenemos notificaciones dentro de las integraciones, a pesar de que las tenemos también en "Preferencias". Es decir, se repiten cosas; la configuración está mal hecha de plano.

Hay traducciones que faltan, por ejemplo, en "Reiniciar" y "Eliminar". Hay traducciones que faltan del i18n settings > reset > description, por ejemplo, una de las cosas que falta ahí.

Luego, interesante que todo eso está dentro del apartado de configuración en la navegación de la barra lateral, y después hay cosas que se repiten en esa navegación. Por ejemplo, "Espacios de trabajo" vuelve a ser como un enlace directo que está en la navegación, a pesar de que está dentro de configuración. "Preferencias", "Seguridad", "Exportar", "Importar" vuelve a repetirse. Creo que la configuración debiera estar en otro lugar.

Todo esto que te acabo de decir, guárdalo en algún lugar, para irlo consultando poco a poco hasta que se arreglen todos los errores.

Y a veces yo no sé si la ganancia que se está tomando es la ganancia después de descontar los costos variables, los costos fijos y todo eso. El dinero que te queda para gastar es tu dinero. Eso no aparece en ningún lado en rentabilidad. Lo que aparece creo que es la ganancia (más bien los ingresos menos los gastos), pero muchos de esos ingresos no es el dinero real que tú tienes en la mano. Por ejemplo, un tratamiento con Rodrigo de endodoncia. Tú nunca ves todo el dinero porque es otro doctor que se lleva una parte, y tú llevas nada más una ganancia.

---

## Temas Identificados (para desglosar en issues)

### 🔴 P0 - Críticos

1. **Punto de equilibrio: "23 días restantes" incorrecto** - Estamos a día 14, días configurados son 20, no puede faltar 23
2. **Teléfono no aparece en Cuenta/Perfil** - Ya se configuró pero no se muestra
3. **Traducciones faltantes** - `settings.reset.description` y otros

### 🟡 P1 - Importantes

4. ~~**Filtros del Dashboard desactualizados**~~ - ✅ COMPLETADO (SmartFilters implementado)
5. **Renombrar "Insights" a "Dashboard"** - Consistencia de nombres
6. **Análisis de contribución en Dashboard** - Basado en últimos 90 días (como punto equilibrio)
7. **Punto de equilibrio: UX confusa** - "Vitral de tarjetas" difícil de entender
8. **Tarjeta "Resumen de lenguaje claro"** - Nombre horrible para UI
9. **Configuración duplicada** - Notificaciones aparece en Preferencias E Integraciones
10. **Navegación duplicada en sidebar** - Workspaces, Preferencias, Seguridad, Export/Import repetidos
11. **Sin navegación "Ir atrás"** - En toda la sección de Configuración

### 🟢 P2 - Mejoras

12. **Cuenta/Perfil: UI con tarjeta separada "Editar"** - No es buena práctica UX
13. **Zona horaria: ¿por clínica o por cuenta?** - No está definido
14. **Notificaciones por email** - Sin probar, no se sabe qué alertas hay
15. **Notificaciones SMS** - Probablemente no existen todavía
16. **Notificaciones push** - Sin icono ni sistema interno de notificaciones
17. **Cambio de contraseña** - Sin verificar si funciona
18. **2FA** - Sin verificar si funciona
19. **Rentabilidad: ¿ganancia real?** - No descuenta comisiones de otros doctores

### 📋 Reglas a recordar

- **SIEMPRE buscar patrones existentes** antes de crear algo nuevo
- **Documentar** qué patrón se imitó o si se creó uno nuevo
- **Evitar** crear elementos visuales inconsistentes (flechas, botones, etc.)

---

## Relacionado

- Ver también: `docs/design/2025-12-09-dashboard-original-request.md` (23 issues del dashboard - completadas)

---

**Archivo creado**: 2025-12-15
