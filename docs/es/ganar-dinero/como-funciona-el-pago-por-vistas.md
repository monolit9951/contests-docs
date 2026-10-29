---
title: "Cómo funciona el pago por vistas: qué vistas cuentan y se pagan"
description: "Cómo se cuentan las vistas válidas en el pago por vistas: umbral, tope por clip, estado de la tarea y la diferencia entre un monto acreditado y un pago recibido."
provenance: { snapshot_date: "2026-08-23", source: "darebay-prod" }
numbers_used:
- ppv_cpm_band_low
- ppv_cpm_band_high
- ppv_cpm_median
- ppv_min_views_threshold_live
- ppv_default_min_views_threshold
- ppv_max_per_work_typical
seo: true
landing: true
hero:
  kicker: "Guía · 2026"
  lede: "Cómo se cuentan las vistas válidas en el pago por vistas: umbral, tope por clip, estado de la tarea y la diferencia entre un monto acreditado y un pago recibido. Sigue un envío a través de cuatro registros separados: el contador público del video, el último contador guardado en la tarea, el monto aprobado y el estado de la liquidación o del retiro."
  takeaways:
  - "Un registro que separa las vistas del dinero recibido."
  - "El tope es un parámetro de la tarea y se aplica por separado a cada envío válido. Revisa en la ficha si hay un tope o si no lo hay; un límite usado en un ejemplo es solo un supuesto."
cta:
  title: "Elige una tarea en la que las cuentas estén claras antes de empezar"
  lede: "La tarifa, el umbral y el tope se fijan antes de que nadie abra un editor, la plataforma lee tu contador y el resultado queda registrado a tu nombre. Elige una tarea para la red en la que ya publicas, publica el clip y envía el enlace."
---

## La cadena completa: del presupuesto al pago

1. **El cliente publica las condiciones y la forma de pago.** La ficha indica la tarifa, el umbral y el tope, si lo hay. Las tareas con fondo en la plataforma reservan allí el dinero; en las tareas de pago directo del organizador, la plataforma no guarda el fondo y el organizador se encarga de liquidar.
2. **El clipper (o clipero) publica y comprueba la admisión.** Sigue el método de envío que indique la tarea: manda el enlace del video o conecta una cuenta donde se admita. Un hashtag por sí solo no confirma la admisión; comprueba que el trabajo aparece en tu lista.
3. **Un moderador revisa las condiciones y la plataforma lee las vistas.** Nadie escribe la cifra a mano: un contador independiente lee el contador de vistas publicado en el sitio. Un envío con un crecimiento sospechoso queda en espera: es una pausa, no una eliminación.
4. **La fórmula fija el monto.** Al final, el sistema calcula el pago de cada envío: `vistas / 1000 × tarifa`. El umbral es una condición de entrada, no un descuento, y el tope limita lo que gana cada envío.
5. **El monto se registra a nombre del autor.** La plataforma crea una acreditación con un estado que el cliente no puede recalcular ni borrar. Donde la tarea muestra «Cobrar ahora», la acreditación de un envío aprobado puede asegurarse antes del final, y ese clip deja de ganar: el botón se habilita cuando todo el monto acreditado cumple 24 horas, así que en un clip que todavía suma vistas el plazo vuelve a empezar.
6. **El remanente sin repartir vuelve al cliente.** En una tarea con fondo en la plataforma, la plataforma guarda el presupuesto y devuelve la parte no gastada al saldo del cliente; con pago directo no hay nada que devolver.

## Parámetros de la tarea: tarifa, umbral, tope y red

| Parámetro | Valor | Qué significa |
|---|---|---|
| Tarifa | La fija la ficha de la tarea | El cliente la indica al crear la tarea |
| Umbral de vistas | Lo fija el cliente en la ficha (valor predeterminado del sistema: 1000 vistas) | La condición de entrada: por debajo, un clip no gana nada; por encima, se pagan todas las vistas del contador |
| Tope por envío | Lo fija la ficha de la tarea | Lo máximo que puede ganar un envío |
| Red | La fija la tarea | Las estadísticas se recogen en TikTok, YouTube, Instagram y los demás sitios que indique la tarea |

La tarifa y el umbral se fijan al crear la tarea, el tope solo puede subirse después, y la ficha muestra cada uno antes de que envíes. Las cifras de DareBay salen de sus propias páginas públicas<!-- source: https://darebay.com/en/earnings/how-much-clipping-pays 2026-09-24 -->.

## De dónde sale la cifra de vistas y quién la confirma

Un contador independiente lee el contador de vistas publicado en el sitio, en el enlace que enviaste. Las dos partes ven el mismo número y en ningún punto de la cadena se introducen datos a mano. La plataforma no vuelve a contar a su manera, y por encima solo actúan la moderación y las comprobaciones básicas. El contador se actualiza varias veces al día, así que la cifra de tu panel puede ir unas horas por detrás del sitio; el valor final se fija al cerrar la tarea, y las vistas que lleguen después ya no cuentan.

## El umbral no se descuenta: cuentan todas las vistas

El umbral es una condición de admisión, no un descuento: solo decide si el envío entra en el reparto del presupuesto. El cliente lo fija en el campo «mínimo de vistas»; si lo deja vacío, el sistema pone su valor predeterminado de **1000 vistas**, y el cliente puede poner cualquier cifra, hasta una sola vista. El valor exacto siempre está en la ficha antes de que envíes.

Un ejemplo: un umbral de 1000 vistas, una tarifa de US$1,00 por cada 1000 vistas y un envío que llegó a 6000 vistas.

- **Cómo lo cuenta DareBay:** 6000 / 1000 × US$1,00 = **US$6,00**; las 6000 vistas entran en el cálculo.
- **Si el umbral se descontara:** solo contaría el resto, 5000 / 1000 × US$1,00 = **US$5,00**.

| Vistas del envío | Umbral de la tarea | Qué entra en el cálculo |
|---|---|---|
| 800 | 1000 | nada, no se superó el umbral |
| 1000 | 1000 | 1000 vistas |
| 6000 | 1000 | 6000 vistas |

El tramo más valioso de una tarea son los últimos cientos de vistas antes del umbral: convierten un cero en un pago por todas las vistas.

## Qué vistas entran en el cálculo

| Vistas | En el cálculo | Nota |
|---|:-:|---|
| El contador del video en el sitio de la tarea | Sí | El valor público en tu enlace |
| Las vistas acumuladas antes de superar el umbral | Sí | El umbral no se descuenta |
| Las vistas posteriores a la recolección final de datos | No | El contador se toma al cerrar la tarea |
| Una copia del video en otro sitio o en otra cuenta | No | Un enlace por envío |
| Un video borrado u ocultado antes del cierre | No | No queda nada que leer ni confirmar |
| Una publicación de foto en lugar de un video en Instagram | No | Una foto no tiene contador de vistas |
| Un envío rechazado por la moderación | No | No participa en el reparto |

La plataforma toma el número que muestra el contador público del sitio y no hace su propia deduplicación, así que mantén el video publicado hasta que termine la tarea.

## Crecimiento sospechoso: la espera y sus tres desenlaces

Un envío cuyo patrón de crecimiento parece sospechoso se marca y queda en espera: su acreditación se pausa hasta la revisión. Es una pausa seguida de una decisión de moderación con tres desenlaces posibles: el envío pasa y todas sus vistas entran en el cálculo; sigue en espera y, cuando vence el plazo de revisión, es posible un pago por él; o la moderación lo rechaza y no hay dinero por él. Por eso comprar vistas es una mala apuesta: las pagas por adelantado, mientras que nada garantiza un pago por ese envío.

## El cálculo es automático y el retiro es una solicitud

**El sistema calcula.** Nadie escribe cifras a mano: la fórmula es determinista, las mismas vistas con la misma tarifa dan el mismo monto, y el resultado se registra como una acreditación con un estado que ves en la tarea. En una tarea con fondo en la plataforma, tus ganancias llegan automáticamente a tu saldo cuando termina, o antes con «Cobrar ahora» donde la tarea lo muestre.

**La plataforma hace el resto.** Pide un retiro desde 10 USDT: el 10% (por defecto) se descuenta dentro de la solicitud y ves el monto que recibirás antes de confirmar. Cada solicitud se revisa antes de salir, para que el dinero llegue a la billetera correcta. Detrás está la propia tarea: el presupuesto de una tarea con fondo en la plataforma ya está congelado en DareBay, el cálculo ya está registrado en un estado y no se puede rehacer a favor de nadie. Participar no le cuesta nada a un clipper y los pagos de los concursos tienen una comisión del 0%; la comisión de retiro es el único cargo. Consulta [qué comisiones cobra DareBay](/en/help/what-commission) (en inglés).

## Qué pasa con un presupuesto sin gastar

El presupuesto de una tarea de pago por vistas se gasta según las vistas realmente conseguidas, así que casi siempre queda una parte que nadie ganó: menos envíos de los esperados, algunos por debajo del umbral o un envío que llegó al tope. En una tarea con fondo en la plataforma, la parte sin gastar vuelve al saldo del cliente; con pago directo, el presupuesto nunca se retuvo por adelantado, así que no hay nada que devolver.

## Un registro que separa las vistas del dinero recibido

Sigue un envío a través de cuatro registros separados: el contador público del video, el último contador guardado en la tarea, el monto aprobado y el estado de la liquidación o del retiro. Una diferencia entre los dos primeros puede ser un retraso en la recolección; una diferencia entre los dos últimos es una cuestión de pago. Tratar los cuatro como un solo número manda la consulta al lugar equivocado del soporte.

Para una tarea ilustrativa con un umbral de 1000 vistas, una tarifa de US$2 y un tope de US$25, un clip aprobado con 800 vistas contabilizadas gana cero. Con 6000 vistas la fórmula da US$12; con 20.000 da US$40 antes del tope y US$25 después. Son datos de ejemplo elegidos a propósito, no una afirmación sobre campañas disponibles.

Antes de publicar, guarda la tarifa, el umbral, el tope, el plazo de envío y la forma de pago que indica la ficha. En el modo con fondo en la plataforma, distingue lo acreditado de una solicitud de retiro; en el modo de pago directo del organizador, pregunta qué comprobante de pago acompañará la liquidación. Si un monto te parece incorrecto, envía la URL del video, la URL de la tarea, el estado visible y la hora de la última sincronización. Mantén el video público mientras se revisa el trabajo.

## Preguntas frecuentes

### ¿Cuándo llega el dinero?

Tus ganancias llegan automáticamente a tu saldo cuando termina una tarea con fondo en la plataforma: en ese momento se hace el cálculo y se genera una acreditación con un estado.

Donde la tarea muestra «Cobrar ahora», un envío aprobado puede acreditarse antes, y ese clip deja de ganar; el botón se habilita cuando todo el monto acreditado cumple 24 horas, así que en un clip que sigue creciendo el plazo vuelve a empezar<!-- source: https://darebay.com/en/help/darebay-withdrawals 2026-09-24 -->. Desde el saldo, pide un retiro desde 10 USDT y la plataforma se encarga del resto; un envío en espera se resuelve aparte, incluso con un pago cuando vence el plazo.

### ¿Qué métodos de pago hay?

El asistente de retiro ofrece USDT a una billetera externa en la red TON, o puedes recibir el pago en Estrellas de Telegram: pide un retiro desde 10 USDT y la plataforma se encarga del resto; se descuenta un 10% (por defecto) del monto solicitado dentro de la propia solicitud y ves el monto que recibirás antes de confirmar. En las tareas de pago directo, el organizador te paga por su cuenta, con el método que fije la tarea; la plataforma nunca te pide enviar dinero por adelantado para «activar» un pago. Detalles: [cómo retirar dinero de DareBay](/es/ayuda/retirar-dinero).

### ¿Puedo enviar más de un clip?

Sí, salvo que las condiciones de esa tarea limiten los envíos de un mismo autor. El tope se aplica a cada envío, no al autor, así que cada video se cuenta por separado; las copias del mismo video no son varios envíos, sino un motivo para que la moderación lo revise.

### ¿Qué pasa si inflo mis vistas?

El envío queda en espera y su acreditación se detiene hasta la revisión; la moderación puede rechazarlo sin más, y entonces no participa en el reparto del presupuesto. El dinero que gastaste ya no vuelve; la parte de esa protección que ve el cliente está en [protección contra el fraude de vistas](/en/help/protection-from-view-fraud) (en inglés).

### ¿Se cuentan todas las vistas o solo las únicas?

La plataforma toma el número que muestra el contador público del sitio y no le aplica su propia deduplicación: lo que el sitio cuente como vista entra en el cálculo una vez superado el umbral.

## Qué leer después

- [Cuánto se gana haciendo clips](/es/ganar-dinero/cuanto-se-gana-haciendo-clips): la fórmula y la tarifa por cada 1000 vistas
- [Protección contra el fraude de vistas](/en/help/protection-from-view-fraud) (en inglés): lo que ve el cliente
- [Qué comisiones cobra DareBay](/en/help/what-commission) (en inglés): las condiciones actuales
- [¿DareBay paga de verdad?](/en/about/does-darebay-really-pay) (en inglés): qué respalda el pago
- [Ganar dinero con clips](/es/earn/clips): las tareas activas
