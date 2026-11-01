# PROMPT MAESTRO — SISTEMA DE GESTIÓN LOGÍSTICA PARA EDUARDO MARTÍNEZ

## 1. OBJETIVO DEL PROYECTO

Actuá como arquitecto de software, desarrollador full-stack senior, diseñador UI/UX y especialista en sistemas administrativos.

Necesito desarrollar desde cero un sistema web privado, moderno, profesional y completamente funcional para administrar la pequeña empresa de logística y transporte de **Eduardo Martínez**.

Este sistema ya había sido diseñado conceptualmente anteriormente y quiero reconstruirlo respetando sus características originales.

**Nombre provisional:** Gestión Transporte Eduardo.

No es una página comercial, no es un sitio institucional, no es una plataforma de reservas ni un sistema para clientes. Es una aplicación administrativa interna.

Eduardo debe poder ingresar desde su teléfono o computadora y saber:

- Qué camionetas trabajaron hoy.
- Cuánto dinero facturó cada camioneta.
- Cuánto facturó toda la empresa.
- Qué empleados trabajaron.
- Cuánto corresponde pagar en sueldos.
- Qué sueldos están pendientes y cuáles están pagados.
- Cuánto se gastó en combustible.
- Cuánto se gastó en reparaciones, seguros y mantenimiento.
- Cuánto dinero ingresó durante la semana, quincena y mes.
- Qué ganancia dejó cada camioneta.
- Cuánto dinero ganó realmente la empresa.

El sistema tiene que ser intuitivo y rápido. Eduardo no debe necesitar conocimientos informáticos para utilizarlo.

---

## 2. TECNOLOGÍAS

Utilizar preferentemente:

**Frontend**
- Next.js con App Router.
- TypeScript.
- React.
- Tailwind CSS.
- shadcn/ui.
- Lucide Icons.

**Backend y base de datos**
- Supabase.
- PostgreSQL.
- Supabase Auth.
- Row Level Security.
- Server Actions o endpoints seguros.

**Visualización**
- Recharts para gráficos.
- Tablas con búsqueda y filtros.
- Diseño responsive.
- Formatos monetarios argentinos.

**Despliegue**
- Vercel.
- Supabase como base de datos persistente.

Si existe un repositorio iniciado, analizar su estructura antes de modificarlo. Si está vacío, crear el proyecto desde cero.

No utilizar datos simulados como reemplazo de funciones reales.

---

## 3. USUARIOS Y SEGURIDAD

### Usuario administrador

El sistema inicialmente tendrá un solo usuario:

**Eduardo Martínez — Administrador principal.**

Debe existir un login con correo electrónico y contraseña.

Características:

- Acceso privado.
- No habrá registro público.
- No habrá cuentas para empleados en esta primera versión.
- Sesiones persistentes.
- Cierre de sesión.
- Recuperación de contraseña.
- Rutas protegidas.
- Restricciones de acceso a la base de datos.
- Ninguna información administrativa debe exponerse públicamente.

El administrador podrá consultar, crear, editar y eliminar registros, excepto operaciones financieras cuyo historial deba conservarse mediante anulación o ajustes auditables.

Nunca incluir contraseñas reales ni credenciales secretas dentro del código.

---

## 4. DATOS INICIALES DE LA EMPRESA

La empresa tiene dos camionetas.

### Camioneta 1

- Chofer: Eduardo Martínez.
- Ayudante: Federico Martínez.

### Camioneta 2

- Chofer: Sebastián Robledo.
- Ayudante: Ramiro.

Estas asignaciones deben crearse inicialmente, pero podrán modificarse desde Configuración.

Las camionetas necesitan:

- Identificador.
- Nombre descriptivo.
- Patente opcional.
- Marca opcional.
- Modelo opcional.
- Año opcional.
- Estado: activa/inactiva.
- Tarifa de facturación diaria predeterminada.
- Empleados asignados.
- Observaciones.

No asumir datos que todavía no se hayan definido.

**Referencia histórica de tarifa:** $200.000 ARS por jornada, únicamente como ejemplo editable.

No cargar este valor como tarifa obligatoria.

---

## 5. DASHBOARD PRINCIPAL

Esta será la pantalla más importante.

Al iniciar sesión, Eduardo visualizará inmediatamente el estado económico y operativo de la empresa.

### Indicadores superiores

Mostrar tarjetas con:

1. Facturación de hoy.
2. Facturación de la semana.
3. Facturación del mes.
4. Gastos del mes.
5. Sueldos devengados del mes.
6. Ganancia neta del mes.
7. Sueldos pendientes de pago.
8. Cantidad de jornadas trabajadas.

Todos los valores deberán provenir de la base de datos.

### Estado de las camionetas

Crear dos tarjetas grandes, una por camioneta.

Cada tarjeta mostrará:

- Nombre de la camioneta.
- Chofer.
- Ayudante.
- Estado del día.
- Importe diario.
- Último día trabajado.
- Facturación acumulada del mes.

Acciones:

**SE TRABAJÓ HOY**

**NO SE TRABAJÓ HOY**

**EDITAR REGISTRO**

Si una camioneta ya tiene una jornada registrada, impedir registros duplicados.

La operación debe ser editable si Eduardo se equivocó.

### Gráficos

Incluir:

- Ingresos por día.
- Ingresos versus gastos.
- Ganancia mensual.
- Facturación por camioneta.
- Gastos por categoría.

Permitir seleccionar períodos.

---

## 6. MÓDULO DE REGISTRO DIARIO

Este es el núcleo del sistema original.

Eduardo necesita entrar todos los días y marcar si cada camioneta trabajó.

### Funcionamiento

Ejemplo:

Fecha: 02/11/2026.

Camioneta 1:

- Trabajó: Sí.
- Facturación: $200.000.
- Chofer: Eduardo Martínez.
- Ayudante: Federico Martínez.

Camioneta 2:

- Trabajó: No.
- Facturación: $0.

Al guardar:

- Registrar la fecha de la jornada.
- Registrar la camioneta.
- Registrar el ingreso.
- Registrar el estado de trabajo.
- Registrar quiénes trabajaron realmente.
- Calcular los sueldos devengados correspondientes, según la configuración.
- Actualizar el dashboard.

### Tarifa configurable

Cada camioneta puede tener un importe diario predeterminado diferente.

Ejemplo:

- Camioneta 1: $200.000.
- Camioneta 2: $180.000.

Son importes ilustrativos.

Eduardo podrá cambiarlos cuando quiera.

**Regla importante:** modificar la tarifa predeterminada no debe alterar la facturación histórica.

Cada jornada debe conservar el importe aplicado ese día.

### Registro de días anteriores

No limitar el sistema a la fecha actual.

Permitir:

- Seleccionar una fecha pasada.
- Registrar días atrasados.
- Corregir importes.
- Corregir el estado de trabajo.
- Agregar observaciones.
- Indicar excepciones.

### Calendario

Mostrar un calendario mensual.

Cada fecha tendrá indicadores visuales para identificar qué camionetas trabajaron.

Al seleccionar una fecha, mostrar los registros existentes.

### Duplicados

Debe existir como máximo un registro de jornada por camioneta y fecha.

Esta restricción debe aplicarse también en PostgreSQL.

---

## 7. MÓDULO DE EMPLEADOS

Crear una sección de administración de empleados.

### Empleados iniciales

1. Eduardo Martínez.
2. Federico Martínez.
3. Sebastián Robledo.
4. Ramiro.

### Datos de cada empleado

- ID.
- Nombre.
- Apellido, cuando esté disponible.
- Rol: chofer/ayudante.
- Camioneta asignada.
- Estado activo/inactivo.
- Modalidad salarial.
- Importe de sueldo.
- Frecuencia de liquidación.
- Observaciones.

### Modalidades de sueldo

Contemplar:

- Pago por día trabajado.
- Sueldo semanal fijo.
- Sueldo quincenal fijo.
- Sueldo mensual fijo.

La modalidad debe poder modificarse por persona.

### Periodicidades originales

**Federico Martínez**
- Liquidación semanal.

**Eduardo Martínez**
- Liquidación quincenal.

**Sebastián Robledo**
- Configurable.

**Ramiro**
- Configurable.

No inventar importes salariales.

Los importes iniciales deben quedar pendientes de configuración.

### Relación con las jornadas

Si un empleado cobra por día trabajado, el sistema debe calcular su sueldo a partir de los días efectivamente trabajados.

Si tiene un sueldo fijo semanal, quincenal o mensual, no debe multiplicarse automáticamente ese importe por cada jornada.

Los sistemas de cálculo deben diferenciarse correctamente.

Permitir excepciones cuando un empleado falte o sea reemplazado por otra persona.

---

## 8. MÓDULO DE SUELDOS Y LIQUIDACIONES

Este módulo debe permitir saber cuánto hay que pagar y a quién.

### Pantalla principal

Mostrar:

- Empleado.
- Camioneta.
- Período de liquidación.
- Días trabajados.
- Sueldo bruto calculado.
- Ajustes.
- Total a pagar.
- Total abonado.
- Saldo pendiente.
- Estado del pago.

### Estados

- Pendiente.
- Parcialmente pagado.
- Pagado.
- Anulado, cuando corresponda.

### Cálculos

Para empleados por jornada:

Sueldo = jornadas trabajadas × tarifa salarial diaria.

Para empleados con sueldo fijo:

Sueldo = importe del período correspondiente, más ajustes o descuentos registrados.

No incorporar descuentos legales, aportes ni impuestos de manera automática sin reglas definidas.

### Registro de pagos

Eduardo podrá registrar:

- Fecha del pago.
- Importe pagado.
- Empleado.
- Período correspondiente.
- Medio de pago.
- Observaciones.

Permitir registrar pagos parciales.

Ejemplo:

Un empleado tiene $150.000 pendientes.

Eduardo paga $100.000.

El sistema mostrará:

- Total: $150.000.
- Pagado: $100.000.
- Pendiente: $50.000.

El pago no debe registrarse dos veces ni duplicar gastos.

### Historial

Conservar todas las liquidaciones y sus pagos asociados.

Permitir consultar los sueldos pagados en cualquier período.

### Liquidaciones cerradas

Los períodos ya liquidados deben conservar sus valores históricos.

Las modificaciones posteriores en el sueldo de un empleado no deben alterar liquidaciones cerradas.

---

## 9. MÓDULO DE GASTOS

Eduardo debe poder cargar todos los gastos de la empresa.

### Categorías originales

- Combustible.
- Seguro.
- Reparaciones.
- Mantenimiento.
- VTV.
- Peajes.
- Otros.

### Registro de combustible

Formulario con:

- Fecha.
- Camioneta.
- Cantidad de tanques o cargas.
- Litros, opcional.
- Monto total gastado.
- Observaciones.

El sistema original contemplaba registrar tanto la cantidad de tanques como el dinero gastado.

No depender obligatoriamente del dato de litros.

### Registro de otros gastos

Formulario con:

- Fecha.
- Tipo de gasto.
- Descripción.
- Camioneta asociada.
- Importe.
- Estado de pago.
- Medio de pago opcional.
- Observaciones.

### Gastos generales

Permitir gastos no asignados exclusivamente a una camioneta.

Por ejemplo, gastos administrativos de toda la empresa.

No repartirlos automáticamente entre unidades salvo que el administrador seleccione un criterio explícito.

### Historial de gastos

Mostrar tabla con:

- Fecha.
- Categoría.
- Camioneta.
- Descripción.
- Importe.
- Estado.

Permitir filtrar por período, camioneta y categoría.

---

## 10. MÓDULO DE CAMIONETAS

Una pantalla individual para cada vehículo.

### Información general

- Identificación de la camioneta.
- Chofer asignado.
- Ayudante asignado.
- Facturación diaria predeterminada.
- Días trabajados.
- Estado.

### Indicadores económicos

Para cada camioneta:

- Ingresos del mes.
- Gastos directos del mes.
- Sueldos atribuibles.
- Resultado operativo.
- Jornadas realizadas.

### Historial de jornadas

Tabla con fecha, estado, importe, personal y observaciones.

### Historial de gastos

Mostrar todos los gastos correspondientes a esa unidad.

### Comparación

Permitir comparar el desempeño económico de las dos camionetas.

---

## 11. REPORTES ECONÓMICOS

Este módulo debe responder a la pregunta más importante:

**¿Cuánto dinero ganó realmente Eduardo con su empresa?**

### Períodos

- Hoy.
- Semana.
- Quincena.
- Mes.
- Año.
- Rango personalizado.

### Reporte general

Mostrar:

Ingresos totales.

Menos gastos operativos.

Menos sueldos devengados.

Igual resultado neto operativo.

**Fórmula:**

Resultado neto operativo = ingresos − gastos operativos − sueldos devengados.

No presentar este resultado como utilidad contable o fiscal definitiva, porque no necesariamente incorpora impuestos, amortizaciones u otros conceptos.

### Ejemplo ilustrativo

Ingresos: $4.000.000.

Combustible: $500.000.

Otros gastos: $300.000.

Sueldos: $1.000.000.

Resultado neto operativo: $2.200.000.

Todos los valores son ficticios.

### Reporte por camioneta

Separar:

- Facturación.
- Combustible.
- Reparaciones.
- Seguros.
- Otros gastos.
- Sueldos atribuibles.
- Resultado.

### Exportaciones

Permitir descargar reportes en:

- Excel (.xlsx).
- PDF.

Las exportaciones deben contener datos reales y respetar los filtros seleccionados.

---

## 12. DIFERENCIA ENTRE FACTURACIÓN, COBROS Y GANANCIAS

Como mejora respecto del concepto inicial, estructurar correctamente los importes.

No mezclar:

- Dinero facturado.
- Dinero cobrado.
- Sueldos generados.
- Sueldos efectivamente pagados.
- Gastos registrados.
- Gastos efectivamente pagados.

Mantener como función principal el registro de facturación diaria.

Agregar opcionalmente la posibilidad de indicar si esa facturación ya fue cobrada.

No obligar a Eduardo a cargar clientes, emitir facturas fiscales o usar un módulo complejo de cuentas corrientes.

El objetivo sigue siendo una aplicación administrativa sencilla.

El dashboard debe distinguir:

**Resultado operativo:** ingresos registrados menos costos del período.

**Movimiento de caja:** cobros y pagos efectivamente realizados.

No descontar dos veces un mismo sueldo cuando se paga una liquidación previamente devengada.

---

## 13. CONFIGURACIÓN

Crear una pantalla para administrar:

### Empresa

- Nombre.
- Moneda ARS.
- Zona horaria America/Argentina/Buenos_Aires.

### Camionetas

- Crear.
- Editar.
- Desactivar.
- Asignar empleados.
- Cambiar tarifas.

### Empleados

- Crear.
- Editar.
- Desactivar.
- Modificar sueldo.
- Modificar periodicidad.
- Cambiar asignación.

### Categorías de gastos

Permitir crear nuevas categorías además de las predeterminadas.

### Administración

- Cambiar contraseña.
- Configuración del perfil.
- Consultar historial de operaciones.

No borrar información histórica cuando se desactive un empleado o una camioneta.

---

## 14. BASE DE DATOS

Diseñar un modelo relacional en PostgreSQL.

Tablas recomendadas:

### profiles

- id
- full_name
- role
- created_at

### vehicles

- id
- name
- license_plate
- brand
- model
- year
- default_daily_rate
- is_active
- created_at
- updated_at

### employees

- id
- first_name
- last_name
- role
- is_active
- created_at
- updated_at

### employee_assignments

- id
- employee_id
- vehicle_id
- role
- start_date
- end_date

### salary_settings

- id
- employee_id
- payment_model
- payment_frequency
- amount
- valid_from
- valid_until

### work_days

- id
- vehicle_id
- work_date
- worked
- revenue_amount
- collection_status
- notes
- created_at
- updated_at

### work_day_employees

- id
- work_day_id
- employee_id
- role

### expenses

- id
- vehicle_id
- category_id
- expense_date
- description
- amount
- payment_status
- payment_date
- notes

### expense_categories

- id
- name
- is_active

### fuel_records

- id
- expense_id
- tank_count
- liters
- notes

### payroll_periods

- id
- employee_id
- start_date
- end_date
- gross_amount
- adjustments
- total_amount
- status
- created_at
- closed_at

### payroll_payments

- id
- payroll_period_id
- payment_date
- amount
- payment_method
- notes

### collections

- id
- work_day_id
- collection_date
- amount
- payment_method
- notes

### audit_logs

- id
- actor_id
- entity_type
- entity_id
- action
- previous_data
- new_data
- created_at

Se pueden agregar otras tablas si la arquitectura lo requiere.

### Reglas de integridad

- Claves foráneas.
- Restricciones de unicidad.
- Montos monetarios usando NUMERIC, nunca FLOAT.
- Índices para consultas por fechas.
- Restricciones para impedir pagos negativos o superiores al saldo.
- Transacciones para operaciones financieras relacionadas.
- RLS para proteger toda la información.
- Registro de modificaciones importantes.
- Migraciones SQL versionadas.

Los importes históricos deben conservarse incluso cuando cambien las configuraciones.

---

## 15. DISEÑO UI/UX

Quiero un sistema visualmente moderno, profesional y limpio.

No quiero una interfaz genérica con formularios sin diseño.

### Estilo

- Panel administrativo premium.
- Color principal azul oscuro.
- Blanco y gris claro.
- Verde para ingresos y ganancias positivas.
- Rojo para pérdidas y deudas.
- Amarillo o ámbar para pendientes.
- Íconos modernos.
- Tarjetas con bordes suaves.
- Tablas ordenadas.
- Buena jerarquía tipográfica.

### Desktop

Sidebar con:

- Inicio.
- Registro diario.
- Camionetas.
- Empleados.
- Sueldos.
- Gastos.
- Reportes.
- Configuración.

### Móvil

Eduardo utilizará frecuentemente su teléfono.

El diseño tiene que funcionar perfectamente en pantallas pequeñas.

Incluir:

- Navegación móvil sencilla.
- Tarjetas adaptativas.
- Botones grandes.
- Formularios fáciles de completar.
- Calendario responsive.
- Confirmación visual después de guardar.

### Prioridad de experiencia

El registro diario debe poder completarse con muy pocas acciones.

Eduardo debería poder entrar al sistema, marcar las camionetas que trabajaron y comprobar el resultado sin recorrer múltiples pantallas.

---

## 16. FUNCIONES ADICIONALES RECOMENDADAS

Las siguientes mejoras no son requisitos estrictos del sistema original, pero deben contemplarse siempre que no compliquen la experiencia.

### A. Resumen mensual automático

Mostrar cuánto ganó la empresa y cada camioneta durante el mes.

### B. Alertas de sueldos

Avisar cuando se aproxima una liquidación pendiente.

### C. Gastos recurrentes

Permitir registrar pagos como seguros que se repiten mensualmente, sin duplicarlos accidentalmente.

### D. Corrección de registros

Eduardo podrá rectificar jornadas y gastos manteniendo una auditoría.

### E. Estados vacíos

Si todavía no hay datos, mostrar mensajes explicativos y botones para comenzar.

### F. Confirmaciones

Solicitar confirmación para acciones destructivas o anulaciones.

### G. Manejo de errores

Presentar mensajes entendibles si falla una operación.

---

## 17. REGLAS DE NEGOCIO CRÍTICAS

Respetar estrictamente:

1. Una camioneta puede trabajar o no trabajar cada día.
2. Si se marca que trabajó, se registra una facturación editable.
3. Si no trabajó, el ingreso de esa jornada será cero.
4. Una camioneta no puede tener dos registros para la misma fecha.
5. Los salarios no tienen que calcularse todos de la misma forma.
6. Federico tiene frecuencia de liquidación semanal.
7. Eduardo tiene frecuencia quincenal.
8. Sebastián y Ramiro tendrán frecuencia configurable.
9. No inventar salarios ni tarifas definitivas.
10. Cambiar configuraciones no debe modificar operaciones históricas.
11. Registrar un pago no debe duplicar gastos.
12. No eliminar las operaciones históricas al desactivar un empleado.
13. Las fechas deben interpretarse según Argentina.
14. La facturación registrada no equivale necesariamente a dinero cobrado.
15. Los reportes deben distinguir ingresos, gastos y salarios correctamente.
16. El sistema es privado para Eduardo.
17. No implementar un sistema multitenant innecesario.
18. No agregar módulos comerciales de clientes o cotizadores que no forman parte del objetivo.
19. No exigir integraciones externas para el funcionamiento administrativo principal.
20. Cada operación relevante debe persistir en la base de datos.

---

## 18. FLUJO REAL DE USO

### Escenario 1 — Eduardo comienza su día

Eduardo ingresa al sistema desde su teléfono.

Ve:

- Camioneta 1: sin registrar.
- Camioneta 2: sin registrar.

Selecciona «Se trabajó hoy» en ambas unidades.

El sistema recupera sus tarifas predeterminadas.

Eduardo confirma los importes.

Se guardan ambas jornadas.

El dashboard se actualiza automáticamente.

### Escenario 2 — Eduardo carga combustible

Entra a Gastos.

Selecciona:

- Camioneta 1.
- Combustible.
- Fecha actual.
- Cantidad de tanques.
- Importe gastado.

Guarda.

El gasto queda asociado a esa camioneta y se refleja en los reportes.

### Escenario 3 — Liquidación semanal de Federico

Eduardo entra a Sueldos.

Selecciona Federico Martínez.

El sistema muestra el período semanal y calcula el monto correspondiente según la modalidad salarial configurada.

Eduardo revisa y cierra la liquidación.

Posteriormente registra el pago.

El estado cambia a pagado.

### Escenario 4 — Cierre mensual

Eduardo selecciona octubre de 2026.

El sistema muestra:

- Facturación total.
- Facturación de cada camioneta.
- Días trabajados.
- Combustible.
- Reparaciones y otros gastos.
- Sueldos devengados.
- Resultado operativo.
- Pagos y cobros efectivos.

Eduardo puede exportar el reporte a Excel o PDF.

---

## 19. PLAN DE IMPLEMENTACIÓN PARA CODEX

Trabajar por etapas, pero entregar el sistema completo.

### Fase 1 — Arquitectura y base

- Inspeccionar repositorio.
- Configurar Next.js.
- Configurar Tailwind.
- Configurar Supabase.
- Crear base de datos.
- Crear migraciones.
- Implementar autenticación.
- Proteger rutas.

### Fase 2 — Diseño y navegación

- Layout administrativo.
- Sidebar.
- Navegación móvil.
- Dashboard.
- Componentes reutilizables.
- Estados de carga y errores.

### Fase 3 — Operaciones

- ABM de camionetas.
- ABM de empleados.
- Asignaciones.
- Registro diario.
- Calendario.
- Configuración de tarifas.

### Fase 4 — Finanzas

- Gastos.
- Combustible.
- Configuraciones salariales.
- Liquidaciones.
- Pagos parciales.
- Cobros.
- Cálculos económicos.

### Fase 5 — Reportes

- Filtros.
- Indicadores.
- Gráficos.
- Excel.
- PDF.

### Fase 6 — Validaciones y entrega

- Verificar permisos.
- Probar registros duplicados.
- Probar cálculos salariales.
- Probar cambios de tarifas históricas.
- Probar pagos parciales.
- Probar responsive.
- Probar exportaciones.
- Corregir errores.
- Preparar despliegue.

---

## 20. PRUEBAS OBLIGATORIAS

Antes de dar por terminado el sistema, probar:

**Caso 1:** ambas camionetas trabajan y se suman sus ingresos.

**Caso 2:** solamente trabaja una camioneta y la otra registra cero ingresos.

**Caso 3:** se modifica una jornada de una fecha pasada.

**Caso 4:** se intenta duplicar una jornada y el sistema lo impide.

**Caso 5:** cambia la tarifa diaria y los ingresos históricos no se alteran.

**Caso 6:** Federico cobra por jornada, si esa fuera su modalidad salarial configurada, y se liquida semanalmente.

**Caso 7:** Eduardo recibe una liquidación quincenal sin duplicar su sueldo.

**Caso 8:** se registra un pago parcial y se calcula el saldo correcto.

**Caso 9:** se carga combustible en una camioneta y se refleja en su resultado.

**Caso 10:** se cierra un mes y sus resultados coinciden con los registros.

**Caso 11:** se prueba el sistema desde un teléfono.

**Caso 12:** un usuario no autenticado no puede acceder a ninguna información privada.

Utilizar pruebas automatizadas para las reglas de negocio y pruebas de integración donde corresponda.

---

## 21. ENTREGABLES

Quiero que el proyecto quede con:

- Código fuente completo.
- Frontend funcional.
- Backend funcional.
- Autenticación real.
- Base de datos PostgreSQL.
- Migraciones SQL.
- Políticas RLS.
- Datos iniciales de camionetas y empleados.
- Dashboard conectado a datos reales.
- Operaciones CRUD completas.
- Cálculos salariales.
- Gastos y reportes.
- Exportación PDF/Excel.
- Diseño responsive.
- Archivo `.env.example`.
- README con instalación y despliegue.
- Pruebas de funcionalidades críticas.

No dejar botones sin funcionalidad.

No utilizar `localStorage` como base de datos del sistema.

No reemplazar consultas reales con valores hardcodeados.

---

## 22. INSTRUCCIONES FINALES

Este sistema será usado realmente por Eduardo Martínez para administrar el dinero y las operaciones de su empresa.

Por eso, priorizar:

1. Simplicidad de uso.
2. Exactitud de los cálculos.
3. Persistencia de los registros.
4. Seguridad.
5. Velocidad.
6. Claridad visual.
7. Facilidad de mantenimiento.

**La funcionalidad más importante sigue siendo que Eduardo pueda marcar diariamente qué camionetas trabajaron, registrar cuánto facturó cada una y ver automáticamente cuánto dinero le queda después de gastos y sueldos.**

Antes de programar, presentá un análisis breve de la arquitectura, las entidades y los cálculos principales.

Después implementá el sistema completo siguiendo las fases anteriores, validando cada módulo y corrigiendo los errores.

Si faltan importes salariales, patentes o tarifas definitivas, utilizar configuraciones pendientes en lugar de inventar información real.

No detener el desarrollo para consultar detalles secundarios que puedan quedar configurables.

El resultado debe ser una aplicación administrativa real, no un prototipo visual.
