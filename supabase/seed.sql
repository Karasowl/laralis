-- Datos de ejemplo para desarrollo

-- Segunda clínica (la primera se crea en la migración)
insert into public.clinics(org_id, name)
select id, 'Toluca Norte' from public.organizations
where not exists (select 1 from public.clinics where name='Toluca Norte')
limit 1;

-- Configuración de tiempo por clínica
insert into public.settings_time(clinic_id, work_days, hours_per_day, real_pct)
select c.id, 20, 7, 0.8 from public.clinics c
where not exists (select 1 from public.settings_time where clinic_id=c.id);

-- Costos fijos para cada clínica
insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'rent', 'Renta del consultorio', 800000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Renta del consultorio');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'utilities', 'Electricidad', 150000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Electricidad');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'utilities', 'Agua', 80000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Agua');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'salaries', 'Asistente dental', 600000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Asistente dental');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'equipment', 'Mantenimiento equipo', 200000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Mantenimiento equipo');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'insurance', 'Seguro de responsabilidad', 120000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Seguro de responsabilidad');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'other', 'Publicidad', 150000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Publicidad');

insert into public.fixed_costs(clinic_id, category, concept, amount_cents)
select c.id, 'other', 'Educación continua', 100000 from public.clinics c
where not exists (select 1 from public.fixed_costs where clinic_id=c.id and concept='Educación continua');

-- Insumos de ejemplo para cada clínica
insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Resina Compuesta A2', 'materials', 'Jeringa 4g', 45000, 20 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Resina Compuesta A2');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Anestésico Lidocaína', 'medications', 'Cartucho 1.8ml', 2500, 1 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Anestésico Lidocaína');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Guantes de Látex', 'disposables', 'Caja 100 piezas', 15000, 100 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Guantes de Látex');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Dique de Goma', 'disposables', 'Caja 36 piezas', 18000, 36 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Dique de Goma');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Ácido Grabador', 'materials', 'Jeringa 5ml', 8000, 30 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Ácido Grabador');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Adhesivo Dental', 'materials', 'Frasco 5ml', 35000, 50 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Adhesivo Dental');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Eyector de Saliva', 'disposables', 'Bolsa 100 piezas', 5000, 100 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Eyector de Saliva');

insert into public.supplies(clinic_id, name, category, presentation, price_cents, portions)
select c.id, 'Algodón Dental', 'disposables', 'Bolsa 500g', 8000, 200 from public.clinics c
where not exists (select 1 from public.supplies where clinic_id=c.id and name='Algodón Dental');

-- Servicios de ejemplo para cada clínica
insert into public.services(clinic_id, name, est_minutes)
select c.id, 'Limpieza Dental', 30 from public.clinics c
where not exists (select 1 from public.services where clinic_id=c.id and name='Limpieza Dental');

insert into public.services(clinic_id, name, est_minutes)
select c.id, 'Resina Simple', 45 from public.clinics c
where not exists (select 1 from public.services where clinic_id=c.id and name='Resina Simple');

insert into public.services(clinic_id, name, est_minutes)
select c.id, 'Resina Compuesta', 60 from public.clinics c
where not exists (select 1 from public.services where clinic_id=c.id and name='Resina Compuesta');

insert into public.services(clinic_id, name, est_minutes)
select c.id, 'Extracción Simple', 30 from public.clinics c
where not exists (select 1 from public.services where clinic_id=c.id and name='Extracción Simple');

insert into public.services(clinic_id, name, est_minutes)
select c.id, 'Endodoncia', 90 from public.clinics c
where not exists (select 1 from public.services where clinic_id=c.id and name='Endodoncia');

-- Recetas de servicios (service_supplies) - ejemplo para Resina Simple
-- Nota: Estas inserciones dependen de los IDs generados, por lo que usamos subqueries
insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  1.5 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Resina Compuesta A2'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);

insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  1 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Anestésico Lidocaína'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);

insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  2 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Guantes de Látex'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);

insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  1 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Dique de Goma'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);

insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  0.5 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Ácido Grabador'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);

insert into public.service_supplies(clinic_id, service_id, supply_id, qty)
select 
  s.clinic_id,
  s.id as service_id,
  sup.id as supply_id,
  0.5 as qty
from public.services s
join public.supplies sup on sup.clinic_id = s.clinic_id and sup.name = 'Adhesivo Dental'
where s.name = 'Resina Simple'
and not exists (
  select 1 from public.service_supplies ss 
  where ss.service_id = s.id and ss.supply_id = sup.id
);