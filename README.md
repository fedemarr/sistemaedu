# Gestión Transporte Eduardo

Aplicación publicada: [sistemaedu-ten.vercel.app](https://sistemaedu-ten.vercel.app).

Aplicación privada para administrar jornadas, camionetas, empleados, gastos, sueldos, cobros y reportes. Next.js App Router, React, TypeScript, Tailwind, Lucide, Recharts, Supabase Auth y PostgreSQL.

## Instalación

Requiere Node.js 24 y un proyecto Supabase dedicado. No aplicar las migraciones sobre una base compartida con otra aplicación.

```sh
npm ci
cp .env.example .env.local
# Completar las variables locales.
npm run migrate
npm run bootstrap
npm run dev
```

`bootstrap` crea la cuenta indicada en `ADMIN_EMAIL` / `ADMIN_PASSWORD` con la API administrativa de Supabase y la autoriza en `profiles`. No cambia la contraseña de una cuenta ya existente. No existe una pantalla de registro público ni un alta automática de administradores. Se puede retirar `ADMIN_PASSWORD` del entorno después del alta. La clave de servicio solo es necesaria para este script local, no para el funcionamiento de la aplicación desplegada.

## Variables

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL del servidor por pooler, con TLS obligatorio |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de Auth de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública publishable o anon de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL canónica de la aplicación para recuperación |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo bootstrap local; nunca llega al navegador |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Solo bootstrap y pruebas locales |

No subir `.env.local` al repositorio. Las variables de producción se configuran en Vercel. La aplicación se conecta a PostgreSQL únicamente desde el servidor. Cada operación valida al usuario con Supabase Auth, verifica su perfil y ejecuta las consultas con el rol `authenticated` y sus claims dentro de una transacción; las políticas RLS también se aplican a esas consultas.

## Módulos

- **Inicio:** ocho indicadores, estado diario de la flota, gráficos y caja separada del resultado operativo.
- **Registro diario:** calendario, fechas anteriores, personal real, excepciones salariales, correcciones auditadas y cobros parciales.
- **Camionetas:** alta, edición, desactivación, tarifas, historial y comparación económica.
- **Empleados:** alta, edición, desactivación, asignaciones y salario versionado.
- **Sueldos:** cálculo por modalidad, períodos completos, cierre, ajustes, pagos parciales y anulaciones con motivo.
- **Gastos:** categorías, generales o por unidad, combustible por cargas con litros opcionales, pago y corrección.
- **Reportes:** períodos rápidos, rango personalizado de hasta 366 días, unidad, gráficos, Excel y PDF con los mismos filtros.
- **Configuración:** empresa, contraseña, categorías y auditoría de las últimas 100 operaciones.

Las tablas tienen búsqueda y paginación de 15 filas. El snapshot financiero carga las jornadas y gastos del rango/calendario solicitado y el historial de liquidaciones y movimientos necesario para saldos. Está diseñado para una empresa pequeña; antes de escalar a muchos años o miles de empleados conviene mover los agregados y la paginación al servidor.

## Reglas económicas

Los montos se guardan en `NUMERIC(14,2)` y se calculan con Decimal.js, redondeando a centavos. Los importes se muestran en pesos argentinos; Excel conserva centavos.

**Resultado neto operativo = facturación − gastos operativos − sueldos devengados.** No es utilidad fiscal definitiva.

**Caja = cobros efectivos − pagos de gastos − pagos de sueldos**, usando las fechas de cada movimiento. Pagar una liquidación no crea un nuevo gasto salarial.

- Hasta dos jornadas por camioneta y fecha, cada una con su propio trabajo, tarifa, chofer y ayudante. PostgreSQL impide duplicar el número de jornada. Si no trabajó, factura cero. Una persona no puede figurar en dos camionetas en la misma jornada, pero puede trabajar en la primera y en la segunda del día.
- La tarifa de facturación y el salario por jornada quedan conservados en la jornada. Un cambio de configuración no los reescribe.
- Semana: lunes a domingo. Quincena: 1–15 o 16–último día. Mes: calendario argentino.
- Los salarios fijos se devengan por día calendario del período, hasta la fecha actual. El redondeo acumulado mantiene el importe exacto de cada período completo.
- El botón «Agregar segunda jornada» permite cargar otro trabajo y otro equipo para la misma camioneta y fecha. Se suman las facturaciones de ambas jornadas. Los empleados por jornada cobran un jornal por cada jornada efectivamente trabajada; los sueldos fijos no se duplican. El calendario marca ×2 y el historial y las exportaciones distinguen Jornada 1 y Jornada 2.
- Los salarios fijos son costos generales sin asignación automática a vehículos. Los salarios por jornada se atribuyen a la camioneta realmente trabajada. No hay descuentos legales, impuestos ni prorrateo de gastos generales automáticos.
- Los cambios salariales rigen desde el día en que se configuran. Las jornadas anteriores sin tarifa pueden corregirse con una excepción diaria explícita; no se infieren salarios pendientes.
- Solo se cierran períodos completos finalizados. Se guardan las líneas de devengamiento, el bruto, el ajuste y el total. El cierre bloquea cambios en las asistencias de ese período; para corregirlo, primero se anulan sus pagos y luego la liquidación.
- Los pagos y cobros tienen clave de idempotencia, bloqueo de fila y control del saldo en PostgreSQL. No se editan: se anulan y se vuelven a registrar. Los gastos se pueden rectificar con auditoría.
- No se eliminan movimientos reales; las bajas de personal y vehículos son desactivaciones. La auditoría registra quién cambió qué, antes/después y el motivo de las anulaciones.

Se cargan las dos camionetas, cuatro empleados, asignaciones y categorías definidos en el prompt. Patentes y salarios quedan pendientes. Federico tiene frecuencia semanal y Eduardo quincenal, sin importes inventados. Cada camioneta tiene los tipos de trabajo y tarifas indicados por el administrador.

### Camioneta 1: jornada fija y ambulancias

La jornada fija tiene un importe de $200.000 y aparece seleccionada por defecto al registrar un día nuevo. También se puede elegir Ambulancia 100% ($200.000), Ambulancia 50% ($100.000) o Ambulancia chica ($80.000). El importe se completa automáticamente y estas opciones no requieren kilómetros. Solo se ofrecen en la camioneta que tiene configurado este tarifario. Las tarifas quedan conservadas en las jornadas, se muestran en el historial y se incluyen en los reportes. La configuración permite editar los importes para las jornadas nuevas.

### Tipos de trabajo de la camioneta 2

Al marcar que trabajó, se elige Colecta ($180.000), Última milla ($200.000) o Voluminoso. Para Voluminoso se ingresan kilómetros y se aplica el importe total del tramo: 0–50 km $174.000; más de 50 hasta 80 km $197.000; más de 80 hasta 110 km $227.000; más de 110 hasta 140 km $243.000; más de 140 hasta 180 km $259.000. Se admiten hasta dos decimales de kilómetros. Los límites superiores están incluidos y los recorridos superiores a 180 km se bloquean porque no tienen tarifa definida.

El servidor calcula el importe con el tarifario de la camioneta y PostgreSQL valida su coincidencia. Cada jornada conserva tipo de trabajo, kilómetros y una copia del tarifario aplicado. Editar una jornada utiliza su tarifario conservado; las nuevas tarifas de Configuración/Camionetas solo afectan jornadas nuevas. Las jornadas anteriores a esta función mantienen su importe manual salvo que se seleccione expresamente un tipo de trabajo. El historial y las exportaciones incluyen el trabajo y los kilómetros.

## Arquitectura

```text
src/app/actions.ts            Server Actions validadas y transacciones
src/app/(private)/           Rutas autenticadas
src/app/api/export/          Excel y PDF privados
src/app/auth/                Callback PKCE y recuperación
src/components/             Layout, formularios, tablas, calendario y gráficos
src/lib/domain.ts            Cálculos compartidos y fechas argentinas
src/lib/db.ts                Snapshot consistente y contexto RLS
src/lib/auth.ts              Sesión verificada y autorización
src/proxy.ts                 Renovación de cookies y protección de rutas
supabase/migrations/         Esquema, políticas y triggers versionados
tests/                      Cálculos, integración SQL y navegador
```

## Contrato de operaciones

Las mutaciones usan Server Actions POST autenticadas y validación Zod. `mutate` recibe `operation` (`day`, `vehicle`, `employee`, `expense`, `payroll`, `payment`, `collection`, `void`, `category`, `company`, `profile`, `password`) y los campos del formulario. Devuelve `{ ok: boolean, message: string }`. Los errores de validación y de integridad se muestran al usuario; no se devuelve SQL ni credenciales. Next.js verifica el origen de las Server Actions. El login, la recuperación y las operaciones tienen límites persistentes de intentos.

`GET /api/export?from=YYYY-MM-DD&to=YYYY-MM-DD&vehicle=UUID&format=xlsx|pdf` descarga un reporte privado. `vehicle` es opcional. Los filtros se validan y se aplican a resumen y detalle. La exportación Excel incluye resumen, jornadas, gastos, resultados por camioneta y sueldos devengados; el PDF incluye resumen y detalles paginados.

## Pruebas

```sh
npm run lint
npm run typecheck
npm test
npm run test:integration
npx playwright install chromium
# Con npm run dev en otra terminal:
npm run test:e2e
npm run build
```

La integración SQL verifica restricciones con transacciones que se revierten por completo. Las pruebas de navegador solo se ejecutan sobre localhost, crean fixtures con UUID propios y los retiran al finalizar; nunca modifican los empleados o vehículos reales. Las credenciales de pruebas se toman del entorno local. Se comprueban exportaciones leyendo el archivo Excel y el contenido PDF, además del login, las rutas privadas y la navegación móvil.

## Despliegue en Vercel

1. Conectar este repositorio a un proyecto Next.js.
2. Configurar las cuatro variables de funcionamiento: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.
3. Ejecutar migraciones y bootstrap localmente una sola vez.
4. En Supabase Auth → URL Configuration, configurar Site URL con el dominio de Vercel y permitir `https://DOMINIO/auth/callback` y `https://DOMINIO/auth/confirm`.
5. Para recuperación de contraseñas, configurar un SMTP apto para enviar al correo real del administrador y usar un correo que reciba mensajes. La plantilla puede usar `{{ .ConfirmationURL }}` para PKCE o apuntar a `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
6. Publicar y verificar inicio/cierre de sesión, rutas privadas y exportaciones. No habilitar registro público en la configuración de Auth.

GitHub Actions ejecuta lint, tipos, pruebas de dominio y compilación. Las pruebas con credenciales se ejecutan localmente. Vercel está conectado al repositorio para despliegues de `main`.

La recuperación por correo requiere completar la configuración de URL/SMTP de Supabase y utilizar una casilla que reciba mensajes. El acceso con contraseña funciona de forma independiente. La auditoría de dependencias detecta avisos moderados en herramientas de lint y dependencias de ExcelJS; no detecta avisos altos o críticos. No se aplican cambios mayores forzados que rompan las exportaciones.

## Mejoras opcionales

Avisos automáticos de liquidaciones vencidas, plantillas de gastos recurrentes y adjuntos de comprobantes pueden incorporarse después. También se puede sumar personalización del tamaño de texto, filtros guardados y un resumen de cierre mensual guiado. Estas mejoras no son necesarias para las operaciones principales.
