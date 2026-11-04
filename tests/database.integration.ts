import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
test("PostgreSQL: integridad financiera, historial, auditoría y RLS (rollback completo)", async (t) => {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: "require",
    max: 1,
    prepare: false,
  });
  const rolledBack = new Error("ROLLBACK_TEST");
  const profiles = await sql`select id from public.profiles limit 1`;
  const actor = String(profiles[0].id);
  try {
    await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: actor, role: "authenticated" })},true),set_config('role','authenticated',true)`;
      assert.equal((await tx`select public.is_admin() as ok`)[0].ok, true);
      const v1 = randomUUID(),
        v2 = randomUUID(),
        employee = randomUUID(),
        day1 = randomUUID(),
        day2 = randomUUID(),
        payroll = randomUUID(),
        payment = randomUUID(),
        key = randomUUID();
      await tx`insert into public.vehicles(id,name,default_daily_rate) values(${v1},'TEST unidad 1',200000),(${v2},'TEST unidad 2',180000)`;
      await tx`insert into public.employees(id,first_name,role) values(${employee},'TEST empleado','ayudante')`;
      await tx`insert into public.work_days(id,vehicle_id,work_date,worked,revenue_amount) values(${day1},${v1},'2026-10-05',true,200000),(${day2},${v2},'2026-10-05',false,0)`;
      await t.test(
        "una unidad trabajó; la otra conserva ingreso cero",
        async () => {
          const rows =
            await tx`select sum(revenue_amount)::text as total from public.work_days where id in (${day1},${day2})`;
          assert.equal(rows[0].total, "200000.00");
        },
      );
      await t.test("se impiden duplicados en PostgreSQL", async () => {
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into public.work_days(vehicle_id,work_date,worked,revenue_amount) values(${v1},'2026-10-05',true,200000)`;
          }),
          { code: "23505" },
        );
      });
      await t.test("no trabajar exige facturación cero", async () => {
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update public.work_days set revenue_amount=20 where id=${day2}`;
          }),
          { code: "23514" },
        );
      });
      await t.test(
        "se corrige una jornada histórica y la tarifa actual no la modifica",
        async () => {
          await tx`update public.work_days set revenue_amount=220000 where id=${day1}`;
          await tx`update public.vehicles set default_daily_rate=500000 where id=${v1}`;
          assert.equal(
            (
              await tx`select revenue_amount::text as amount from public.work_days where id=${day1}`
            )[0].amount,
            "220000.00",
          );
        },
      );
      await tx`insert into public.work_day_employees(work_day_id,employee_id,role,salary_amount,salary_model) values(${day1},${employee},'ayudante',30000,'daily')`;
      await t.test(
        "un empleado no puede trabajar en dos unidades la misma fecha",
        async () => {
          await tx`update public.work_days set worked=true,revenue_amount=180000 where id=${day2}`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`insert into public.work_day_employees(work_day_id,employee_id,role,salary_amount,salary_model) values(${day2},${employee},'ayudante',30000,'daily')`;
            }),
            { code: "23514" },
          );
        },
      );
      await t.test(
        "doble jornada: mismo equipo permitido en otro turno; duplicados y cruces del mismo turno bloqueados",
        async () => {
          const rollback = new Error("ROLLBACK_SHIFTS");
          try {
            await tx.savepoint(async (sp) => {
              const second = randomUUID();
              await sp`insert into public.work_days(id,vehicle_id,work_date,shift_number,worked,revenue_amount) values(${second},${v1},'2026-10-05',2,true,180000)`;
              await sp`insert into public.work_day_employees(work_day_id,employee_id,role,salary_amount,salary_model) values(${second},${employee},'ayudante',30000,'daily')`;
              assert.equal(
                (
                  await sp`select sum(revenue_amount)::text as total from public.work_days where vehicle_id=${v1} and work_date='2026-10-05'`
                )[0].total,
                "400000.00",
              );
              await assert.rejects(
                sp.savepoint(async (p) => {
                  await p`insert into public.work_days(vehicle_id,work_date,shift_number,worked,revenue_amount) values(${v1},'2026-10-05',2,true,180000)`;
                }),
                { code: "23505" },
              );
              await assert.rejects(
                sp.savepoint(async (p) => {
                  await p`insert into public.work_days(vehicle_id,work_date,shift_number,worked,revenue_amount) values(${v1},'2026-10-05',3,true,180000)`;
                }),
                { code: "23514" },
              );
              const competing = randomUUID();
              await sp`insert into public.work_days(id,vehicle_id,work_date,shift_number,worked,revenue_amount) values(${competing},${v2},'2026-10-05',2,true,100000)`;
              await assert.rejects(
                sp.savepoint(async (p) => {
                  await p`insert into public.work_day_employees(work_day_id,employee_id,role,salary_amount,salary_model) values(${competing},${employee},'ayudante',30000,'daily')`;
                }),
                { code: "23514" },
              );
              throw rollback;
            });
          } catch (e) {
            if (e !== rollback) throw e;
          }
        },
      );
      await tx`insert into public.payroll_periods(id,employee_id,start_date,end_date,days_worked,gross_amount,adjustments,total_amount) values(${payroll},${employee},'2026-10-05','2026-10-11',1,30000,0,30000)`;
      await t.test(
        "liquidación cerrada bloquea cambios históricos y solapamientos",
        async () => {
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update public.work_days set revenue_amount=99 where id=${day1}`;
            }),
            { code: "23514" },
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`delete from public.work_day_employees where work_day_id=${day1}`;
            }),
            { code: "23514" },
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update public.payroll_periods set gross_amount=50000,total_amount=50000 where id=${payroll}`;
            }),
            { code: "23514" },
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`insert into public.payroll_periods(employee_id,start_date,end_date,days_worked,gross_amount,adjustments,total_amount) values(${employee},'2026-10-07','2026-10-13',1,30000,0,30000)`;
            }),
            { code: "23514" },
          );
        },
      );
      await t.test("pago parcial, idempotencia y límite de saldo", async () => {
        await tx`insert into public.payroll_payments(id,payroll_period_id,payment_date,amount,idempotency_key) values(${payment},${payroll},'2026-10-11',10000,${key})`;
        await tx`insert into public.payroll_payments(payroll_period_id,payment_date,amount,idempotency_key) values(${payroll},'2026-10-11',10000,${key}) on conflict(idempotency_key) do nothing`;
        const paid =
          await tx`select sum(amount)::text as paid from public.payroll_payments where payroll_period_id=${payroll}`;
        assert.equal(paid[0].paid, "10000.00");
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`insert into public.payroll_payments(payroll_period_id,payment_date,amount,idempotency_key) values(${payroll},'2026-10-11',25000,${randomUUID()})`;
          }),
          { code: "23514" },
        );
        await assert.rejects(
          tx.savepoint(async (sp) => {
            await sp`update public.payroll_payments set amount=20000 where id=${payment}`;
          }),
          { code: "23514" },
        );
      });
      await t.test(
        "no se anula una liquidación con pagos; se anulan primero los pagos",
        async () => {
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update public.payroll_periods set voided_at=now(),void_reason='Prueba' where id=${payroll}`;
            }),
            { code: "23514" },
          );
          await tx`update public.payroll_payments set voided_at=now(),void_reason='Prueba de anulación' where id=${payment}`;
          await tx`update public.payroll_periods set voided_at=now(),void_reason='Prueba de anulación' where id=${payroll}`;
        },
      );
      await t.test(
        "cobros parciales nunca superan la facturación",
        async () => {
          await tx`insert into public.collections(work_day_id,collection_date,amount,idempotency_key) values(${day1},'2026-10-12',100000,${randomUUID()})`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`insert into public.collections(work_day_id,collection_date,amount,idempotency_key) values(${day1},'2026-10-12',200000,${randomUUID()})`;
            }),
            { code: "23514" },
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`update public.work_days set revenue_amount=100 where id=${day1}`;
            }),
            { code: "23514" },
          );
        },
      );
      await t.test(
        "combustible queda ligado a un gasto y se conserva al desactivar la unidad",
        async () => {
          const category =
            await tx`select id from public.expense_categories where name='Combustible'`;
          const expense = randomUUID();
          await tx`insert into public.expenses(id,vehicle_id,category_id,expense_date,description,amount) values(${expense},${v1},${category[0].id},'2026-10-05','TEST carga',10000)`;
          await tx`insert into public.fuel_records(expense_id,tank_count) values(${expense},2)`;
          await tx`update public.vehicles set is_active=false where id=${v1}`;
          assert.equal(
            (
              await tx`select count(*)::int as count from public.expenses where vehicle_id=${v1}`
            )[0].count,
            1,
          );
          assert.equal(
            (
              await tx`select tank_count::text as tanks from public.fuel_records where expense_id=${expense}`
            )[0].tanks,
            "2.00",
          );
        },
      );
      await t.test(
        "la auditoría conserva modificaciones y motivos de anulación",
        async () => {
          const logs =
            await tx`select new_data from public.audit_logs where entity_id=${payment} and action='UPDATE'`;
          assert.equal(logs[0].new_data.void_reason, "Prueba de anulación");
        },
      );
      await t.test(
        "otro usuario autenticado no puede leer ni insertar datos",
        async () => {
          await tx`select set_config('request.jwt.claims',${JSON.stringify({ sub: randomUUID(), role: "authenticated" })},true)`;
          assert.equal(
            (await tx`select count(*)::int as count from public.vehicles`)[0]
              .count,
            0,
          );
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`insert into public.vehicles(name) values('NO AUTORIZADO')`;
            }),
            { code: "42501" },
          );
        },
      );
      await t.test(
        "anon no puede consultar ninguna tabla privada",
        async () => {
          await tx`set local role anon`;
          await assert.rejects(
            tx.savepoint(async (sp) => {
              await sp`select id from public.vehicles`;
            }),
            { code: "42501" },
          );
        },
      );
      throw rolledBack;
    });
  } catch (e) {
    if (e !== rolledBack) throw e;
  } finally {
    await sql.end();
  }
});
