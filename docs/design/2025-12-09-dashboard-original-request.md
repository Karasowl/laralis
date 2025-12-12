# Solicitud Original del Usuario - Dashboard Mega Refactor

**Fecha**: 2025-12-09
**Usuario**: Isma (BOOX)
**Contexto**: Transcripción de voz describiendo problemas del Dashboard

---

## Transcripción Completa

Ok, hablemos del Dashboard. Todavía el Dashboard tiene muchos problemas. Vamos a ir paso por paso. La meta mensual. La meta mensual es un progreso hacia el punto de equilibrio en estos momentos. Pero debería ser un progreso, ehmmmm elegible. ¿En qué sentido? El punto de equilibrio debía ir a ser como una parte de la meta mensual que a través de colores se determinara, se marcara. Sin embargo no debe ser todo el progreso mensual. Uno debe poder a través de un slider en un modo de configuración determinar cuál es tu meta mensual y que cuando pase por el punto equilibrio también se marque y que además uno pueda ver cuánto le falta para ese punto de equilibrio y también cuánto te falta para la meta mensual de la forma más amigable posible.

Otra cosa: La Inteligencia Artificial en estos momentos ya no hablando del Dashboard, sino que voy a hablar de algunos problemas que tenemos, no tiene acceso a cuántos días se han configurado, osea la configuración tiempo. La configuración tiempo tiene varias cuestiones. Una de ellas es cuántos días tú trabajas. La Inteligencia Artificial sigue diciendo que son 22 días cuando los días laborales que se colocaron en la configuración tiempo son 20. Es decir estoy hablando de un usuario en particular: BOOX que estoy determinando. Igual que la productividad es un 85% del tiempo real y se trabaja 8 horas por día programada. Entonces si eso es así deberé ser capaz de calcular el sistema cuántos son los minutos y poder determinar por los tratamientos que se han hecho, cuál es el índice más menos de eficiencia que tiene la clínica o por lo menos saber cuántos minutos se está desaprovechando Pero eso Lara, por desgracia, la Inteligencia Artificial no tiene acceso a ello En la configuración del tiempo tenemos el desglose de costo fijo y eso nos da el costo por minuto y el costo por hora. Está bien.

Eh? Pero bueno volvamos entonces al Dashboard. En el Dashboard nos dice desglose por días, semanas y meses. Sin embargo ese desglose por día, semana y mes que aparece en una de las cartas no hace nada. Osea no veo cuál es el objetivo y dice desglose por día, semana y mes y comparar con un periodo anterior Pero no veo dónde cambia y si cambia algo debajo, si eso cambia algo debajo que no veo que cambie nada pues está muy lejos de la configuración desglosar por y comparar con tan lejos que cambiarlo encima para buscar lo debajo es un problema de usabilidad que no se resuelve.

El botón actualizar también es un botón en el Dashboard que no existe en ningún otro lugar y no sé para qué existe en el Dashboard en este caso.

Otra cosa que nos está sucediendo es que no estamos utilizando bien las llamadas a la API Yo veo que si ya la aplicación cargó los pacientes una vez y yo voy a Insight ¿porque cuando voy a pacientes de nuevo los está cargando de nuevo? Si me das una buena razón para ello está bien. Por ejemplo me puedes decir que esta aplicación tiene usuarios de una misma clínica y que si hay algún cambio no se va a ver en tiempo real En ese caso el botón actualizar debería encontrarse entonces en la barra superior o en el caso del Mobile en la barra lateral o quizás en ambos casos en la barra lateral para que sea más fácil quizás abajo botón de refresh para refrescar el sistema pero eso lo haríamos si tuviéramos mejor manejo de las llamadas a la API ahí sí tendría sentido.

También cuando toco personalizado en el Dashboard (sobre todo cuando toco personalizado en el Mobile), algunos iconos se solapan con el texto que marca el Día, Mes y Año porque no está bien optimizado el Mobile del Dashboard. De hecho, no está tan bien optimizado que el botón actualizar está a un lado hay un espacio muy grande entre el título Dashboard y el subtítulo panel de control, y las primeras tarjetas. Entonces, es necesario llamar un agente UI Designer para mejorar el Dashboard porque realmente no está bien optimizado.

La actividad reciente también debería estar minimizada por defecto y tener quizás una o dos actividades recientes, y luego, si uno quiere expandir, puede ver el resto.

El desglose de servicio por categoría, que es un gráfico de pastel, también en Mobile se solapa y se superpone un texto al otro porque no está bien optimizado.

Igual, todo en el dashboard no está bien optimizado. En la meta mensual, nada de eso está bien optimizado. Cuando me refiero a "bien optimizado" hasta ahora, es optimizado a nivel de UI y UX. O sea, al haber menos espacio y no estar bien ordenados los elementos, se superponen o se desordenan.

Los ingresos del período (en este caso, por ejemplo, si ponemos los ingresos de hoy o los ingresos de esta semana), está bien, pero es que debería haber una sección donde me dice los ingresos, me dice los gastos, pero por ejemplo, me dice que hay 74 pesos de gastos en esta semana contra la semana anterior. Pero cuando yo voy a los gastos para ver dónde están esos 74 pesos y pongo también desde Asta, que de hecho en los gastos los filtros deberían ser igual que están los filtros en pacientes o los filtros en tratamiento (que son filtros más modernos), pero lo filtro en los gastos son filtros toscos distintos a los demás y debemos refactorizarlo para que sean similares a nuestros filtros.

Pero, bueno, si yo pongo por ejemplo, "esta semana también" para filtrar por gastos, yo no veo así. Veo un gasto de 74 pesos, está bien, es un insumo muy bueno. Si ahí tienes razón, el gasto está bien, el gasto de esta semana está bien.

Pero el tema de los pacientes activos: nosotros necesitamos saber dos cosas:

- Necesitamos saber pacientes activos, que son los que se han hecho un tratamiento en los últimos 90 días.
- Necesitamos saber pacientes fidelizados, que son los que se han hecho tratamientos. No sé, determínalo tú buscando en internet cómo se puede llamar un paciente fidelizado, cuánto tiene que hacerse en qué periodo, pero necesitamos también saber cuántos son los pacientes atendidos en el periodo.

No es cierto, o sea, en el periodo, no solamente en porque, por ejemplo, ahora mismo yo juego esta semana y los pacientes activos no me salen. No se adejo con esta semana, siguen siendo 147 pacientes activos. Pongo hoy y me siguen siendo 147 pacientes activos. Entonces, como hay cosas del dashboard que no se actualizan con los filtros y deberían actualizarse con los filtros, eeeh.

La utilidad bruta, hay cosas que no se entiende. O sea, la utilidad bruta, ¿qué significa? Y cuando se ponga, debería haber una especie de icono de información en estos lugares difíciles al lado del texto, donde, cuando tú lo toques, sale un cuadrado suficientemente grande que te explique, te desclose los cálculos hechos, por ejemplo, "utilidad bruta", te diría: "bueno, tantos tratamientos que han traído tanto dinero menos tal cosa que es tanto dinero", bueno, te da este cálculo. Eso debería existir, porque ahora mismo no sé si está bien o está mal la utilidad bruta, tampoco sé si está bien o está mal, y qué cosa es, son términos difíciles para una persona normal que se enfrente al sistema, y la ganancia neta, ¿cuál es la diferencia entre la utilidad bruta y la ganancia neta? En este caso, y por qué y cómo se calcula.

El ticket promedio, bueno, en ese caso, no hace falta tanto, o sea, no todo necesita esa información, ese botón de información.

Pacientes necesarios, 8 por día, 8 al día para alcanzar el punto equilibrio, no se ve bien, o sea, no tiene icono en mobile, cuando el ticket promedio sí tiene icono.

Pacientes actuales, está bien, o sea, eso está bien, tiene el icono. Tiene todo planeado contra real, tiene que explicarte también cuáles son gastos planeados contra gastos reales en ese caso.

Pero hay un problema con los iconos, y es que en gastos planeados contra gastos reales, dice salario de la doctora Lara, te pone un 8 000, después de poner una flechita hacia la derecha, después de poner 000. No debería ser porque, si lo que me estás diciendo es que lo planeaban eran 8 000 y lo gastado fueron 000, no es cierto, porque el salario de la doctora Lara sí se gastó, sí se gastó. Lo que pasa es que no se colocó con el mismo término.

Entonces, no sé hasta qué punto, para resolver ese problema en gastos, debiéramos tener menos categorías, porque, por ejemplo, el gasto, cuando se crea un gasto, tienes muchas cosas: fecha de gasto, que está bien, monto, que está bien, concepto. El monto dice que es en MXN. Nosotros debemos tener una configuración a nivel de sistema que sea de región horaria y también, por ahora, de precio (o sea, de moneda), para que eso no fuera algo el monto y todos los cálculos que sean no sean algo fijo, o sea, hardcoded, sino que sean algo dinámico según la configuración del sistema, y que esa configuración llame una API de precio (o sea, de cambios de moneda) en el tiempo real, para que si cambias toda la moneda del sistema, pues también cambien los montos según esa moneda.

Pero te decía que en registrar gastos tenemos concepto, tenemos proveedor o beneficiario. Son demasiadas cosas en gastos. Yo creo que en primera instancia debemos tener la fecha de gasto, está bien, el monto, el concepto, también número de factura, está bien. Bueno, proveedor déjalo entonces. Proveedor o beneficiario.

Pero debemos tener una correlación antes que nada. O sea poner: ¿este gasto tiene correspondencia con costo fijo, insumos o algo de eso? Es que sí. Y entonces que salga un selector para elegir la correspondencia. Si es con insumos, si es con lo que sea, si es con un insumo, si es con un gasto fijo, si es con un salario lo que sea. Pero algo que ya se haya colocado en la configuración inicial de la clínica es importante y de esa manera ya nos ahorramos el problema de que no se sepa que muchas veces el concepto no fue exactamente la forma en que se expresó ese gasto programado en costo fijo e insumo.

Yo creo que en gastos podemos tener tenemos dobles osea tenemos categorías y tenemos a la misma vez tipo de gasto. Y esos tipo de gastos creo que son bastante arbitrarios y jarcodeados, ese es el problema. Yo creo que ese tipo de gastos podríamos quitárnoslos porque al final es como cuando seleccionas una categoría ya tu estás seleccionando lo que sea el tipo de gastos.

Lo otro lo otro importante en este caso es que cuando hay un gasto de marketing se tome como como campaña o sea como Se refleje en los cálculos relacionados con marketing publicidad campaña todo lo pueda tomar de ahí eso ya se hace de hecho pero como los cambios que queremos hacer en gastos lo que no me gustaría que se perdieran porque el tipo de gasto no está bien optimizado al final lo que necesitamos es saber qué un gasto puede ser un gasto nuevo o puede ser un gasto está planificado entre los costos fijos y dentro de los costos variables y si es un gasto planificado entre los costos fijo y los variables, bueno selecciona lo de ahí no? y si es un gasto que no está planificado bueno, pues uno nuevo y colócalo y se acabó. Y si es un gasto que está planificado para marketing, osea dentro de los costos fijos y variables es relacionado con marketing pues bueno que el sistema lo sepa para que después haga todos los cálculos relacionados con marketing y lo siga haciendo.

Si está relacionado con costo fijo, que el sistema lo sepa. Si está relacionado con porque además debemos tener en cada costo fijo como cada costo fijo tiene una depreciación a tres años en este caso deberíamos ver cuánto se ha pagado o cuánto debería estar ahorrado para ese costo fijo entonces como que esa relación entre los gastos y lo que estuvo planificado nos va a ayudar para que el sistema entienda comprenda realmente cuánto se ha gastado de lo que estaba planificando. entonces esa correlación se puede hacer y también se pueden hacer gastos que no están correlacionados con nada planificado y eso también el sistema lo puede decir y saber.

El tema de repetir en cada período creo que no está funcionando no se repite no hay un cron job de ver cel o lo que sea que sea con el objetivo de que en tal período se añade al gasto y eso debería existir porque para algo está el selector de repetir en ese mismo período y actualizar el inventario en este caso no tenemos ni inventario habría que crear el inventario en este caso habría que crear el inventario para saber cuanto hay de stock de cada cosa y cuanto se va gastando al tu ingresar un gasto ya estás ingresando de un costo variable por ejemplo ya estás ingresando entonces algo que es inventarial o de un costo fijo también estás ingresando algo que es inventariado y ese inventario cuando lo gastas en un procedimiento por ejemplo cuando gastas algún costo variable algo que es está relacionado con un costo variable algún procedimiento ya se tiene que, sin que el usuario lo diga pero ya se tiene que quitar de ese inventario y tiene que haber alguna manera de actualizar ese inventario también normalmente es decir hoy si yo dije que un tratamiento usaba 4 guantes por poner un ejemplo y tuviste que registrar gastos yo compré 5 y tuviste que he hecho un tratamiento pero no tú piensas que me queda uno pero no ¿Por qué? Porque utilicé 3 en vez de 4 y por lo tanto me quedan 2 y yo lo puedo poner 3 lo puedo actualizar crear un activo con esta compra está bien pero no sé si está funcionando no sé si realmente está funcionando Todo eso hay que arreglarlo también en gasto Y a nivel de UI ya te digo los filtros del gasto están horribles y hay que tener cuidado las categorías porque están demasiado arcodeadas todo lo que te digo debe tener algún tipo de implicación en Supabase en migraciones en la manera que nosotros sembramos la semilla del SQL Inicial todo eso habría que autorizarlo y también tener en cuenta que no se puede romper nada lo que ya está hecho con nuestro cambio.

También tenemos un problema en "Gastos": tenemos como una especie de recuadro de información molesto que nos dice cómo se relaciona con "Costo Fijo". Ese tipo de recuadro está bien cuando es un recuadro clickeable en un botón de información, como el que te decía que tiene que ver algunos lugares del dashboard. Si lo queremos poner en "Gastos", por ejemplo, sería al lado del título de "Gasto", estaría el botón de información. Tú lo tocas y, entonces, te sale el recuadro, pero te sale de tal manera que lo puedas cerrar y no siga otro problema.

Otro problema es que en mobile, la mayoría de los botones de acción están a la derecha. Yo sé que, al final, están a la derecha en desktop, aquí se justifica, pero ¿qué pasa en mobile? Que crean un espacio en blanco a la izquierda del botón, que se ve raro, y eso deberíamos arreglarlo también.

En cuanto al dashboard, hay que tener cuidado porque las tablas del dashboard te pone, por ejemplo, una "K" al lado de cualquier cifra, por ejemplo, en "Ingresos contra Gasto", que es una gráfica. Tu pones tu gasto, por ejemplo, que fue de 8 mil pesos, y está cerca de un 10 mil con una "K", y eso suena a como no se 1 millón en vez de 10 mil. Así que tener cuidado en el dashboard.

También, en la parte de "Rentabilidad", te habla de "Ganancia Total". Esa "Ganancia Total" no sabemos cuál es la diferencia, por ejemplo, con la "Ganancia Bruta", la "Utilidad Bruta", la "Ganancia Neta". Entonces, hay que tenerle cuidado a eso.

"Ventas Totales" serían "Tratamientos Totales", así que no tiene ningún sentido poner "Ventas" y "ROI Promedio". Dice que 711, no se sabe cómo el "ROI" es 711, si al final, por ejemplo, en la "Ganancia Neta", te dice que es menos 11 mil, 822.71. Entonces, ¿hasta qué punto esos datos están bien colocados?

Y además, en ahí, en "Rentabilidad", en el dashboard, te dice que el periodo es una tarjeta jarcodeada que dice "periodo últimos 30 días". Ningún sentido tiene si al final tienes un seleccionador de periodo arriba. Un filtro no tiene ningún sentido.

Hay cosas en que me puedo equivocar que no son problemas, pero no tendrías que decir "Servicios por Ganancia Total". Bueno, ese está bien, ese no le veo problema.

"Pacientes contra Capacidad": lo primero que te dice son predicciones de ingreso. Lo primero que tendría que decirte es lo que te dice "Pacientes contra Capacidad", y la predicción de ingreso debería tener también una información al lado, o sea, una información que, cuando tú lo abras, te explica el desglose de por qué está llegando esa predicción, porque yo no sé si está bien, y además, no entiendo, por ejemplo, que el periodo es una semana, porque te dice "Próximo mes" 1470, cuando el periodo es una semana, "Próximo trimestre" 4310, y al cierre del año 1470, de nuevo. O sea, no tiene ningún sentido. Las cifras que te está dando.

Luego te dice que el servicio es más rentable es la consulta dental, porque tiene un 2174,5 de retorno de inversión, y después la limpieza dental, y después la resina, y no sabemos por qué saca esa conclusión.

Después te dice que la oportunidad de crecimiento es en 2.12 con Rodrigo, y tampoco te dice por qué saca esa conclusión. Entonces, necesitamos información, o sea, íconos de información que te digan por qué sacar esa conclusión de los desgloses, porque uno no tiene por qué creerle, y al final, la "Utilidad de Capacidad", que es prácticamente el nombre de ese paciente, está al final, es la última tarjeta, cosa que no debería ser.

Y después, en el periodo de este mes, te dice que es horas trabajadas 3 horas y 28 minutos de 8 horas disponibles, pero no te dice eso es en promedio, eso es en total, y no sé si está cambiando por el periodo que yo selecciono. Por eso, en esta semana, no te dice, o sea, tendría que decir un resumen que está basando. Y así que no tiene ningún sentido.

Por último, el mismo problema lo tenemos en Marketing. Tenemos incluso un ícono de información en marketing al lado de CAC (por ejemplo), y al lado de LTV, pero ese ícono de información en Mobile no se puede tocar, no saca nada. En Desktop tampoco saca nada cuando le pasas por al lado de un hover; está roto eso. Y al final, lo que termina siendo es que el título (el nombre del título) se sea más pequeño y está debajo del ícono. Yo sé que en Desktop tiene que estar debajo del ícono, pero en Mobile no. Perdón, en Mobile tiene que estar debajo del ícono, pero en Desktop no. Y además, se ve raro; se ve distinto a los otros íconos, a los otros títulos. No hay una consistencia, por ejemplo, en los títulos de las tarjetas de resumen en el dashboard, de rentabilidad en el dashboard, de pacientes con otra capacidad.

Y por eso es que no sabemos cuál es el CAC, por ejemplo, está en cero (Costo por Acquisición de Clientes), a pesar de que en gastos sí se han registrado datos con la categoría de marketing. Eso sí se ha hecho, y sin embargo, el Costo por Acquisición de Clientes está en cero, cosa que no debería ser, y la tasa de conversión LITs a pacientes, ¿cómo la sabes? Dice que está en un 27,7%, pero ¿cómo sabes? Si tú no sabes cuántos han sido LITs y cuántos han sido pacientes, tú no recibes los mensajes.

Entonces, yo creo que hay un tunel ahí, que hay una cosa jarcodeada igual que la tendencia de adquisición. No sé hasta qué punto esté bien o esté siendo jarcodeada igual que la ROE por campaña, que aparece sin nada cuando realmente tenemos muchas campañas y te dice "Crea tu primera campaña". No deberías poder crear campaña desde ahí; esto es nada más para visualizar las campañas, que se crean desde Mercadotecnia. En mercadotecnia tenemos, entre todas las plataformas, una que se llama Meta Ads, Facebook, Internet y ella tiene creadas dos campañas que ya se ven que tienen pacientes adjudicados. Y sin embargo, a pesar de ello, en Insight en Marketing, te dice que crees la campaña como si no hubiera ninguna campaña.

Después hay una tabla de evolución del Costo por Acquisición que te dice que el Costo por Acquisición objetivo es decir, si el año 74 y el actual es de cero. Y como rayos se saben cual es el objetivo, cual es el actual y el costo por adquisición promedio te pone de 14 pesos 54 centavos los últimos 12 meses. Yo creo que nada de esto está relacionado con la realidad. No hay forma de saber eso, o por lo menos, si hay forma de saber el Costo por Adquisición, pero no se está calculando.

Igual siempre aparece "selecciona períodos de luzar por día y comparar con periodos anteriores". Cosas así y nada de eso se aplica. Ni funciona en el dashboard en sentido general.

Hay que arreglar todo esto. Es necesario desglosar todo lo que te he dicho en tareas, en un PR, quizás bien profundo, bien intenso, que no pierda detalles de lo que yo he explicado, e ir arreglando uno a uno con diferentes agentes en background, para poder tener hasta 8 o 9 agentes que vayan resolviendo problemas.

---

## Temas Identificados (para referencia)

### Prioridad 0 - Críticos
1. **Meta Mensual Configurable** - Slider para configurar, dos marcadores, mostrar cuánto falta
2. **Filtros de Fecha No Funcionan** - Pacientes activos siempre 147, granularidad sin efecto
3. **CAC en Cero** - A pesar de gastos de marketing registrados
4. **Tooltips Explicativos** - Utilidad bruta, ganancia neta, ROI sin explicación
5. **Lara sin acceso a configuración de tiempo** - Dice 22 días cuando son 20

### Prioridad 1 - Importantes
6. **UI Mobile Rota** - Textos solapados, iconos solapados, espacios excesivos
7. **Actividad Reciente** - Debería estar colapsada por defecto
8. **Gastos** - Filtros toscos, categorías redundantes, correlación con planificados
9. **Cron de Gastos Recurrentes** - No funciona
10. **Predicciones sin Sentido** - Números que no cambian con el periodo

### Prioridad 2 - Mejoras
11. **Cache de Datos** - Recarga innecesaria al navegar
12. **Botón Actualizar** - No existe en otros módulos
13. **MXN Hardcodeado** - Debería ser configurable
14. **Inventario** - No existe, mencionado como necesidad futura

---

**Archivo creado**: 2025-12-11
**Propósito**: Documentar la solicitud original completa para referencia futura y auditorías de implementación
