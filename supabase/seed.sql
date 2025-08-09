-- Datos de ejemplo para desarrollo

-- Configuración de tiempo (valores basados en la hoja de referencia)
insert into public.settings_time (work_days, hours_per_day, real_pct) 
values (20, 7, 0.8);

-- Costos fijos de ejemplo (valores en centavos)
insert into public.fixed_costs (category, concept, amount_cents) values
('rent', 'Renta del consultorio', 800000),          -- $8,000 MXN
('utilities', 'Electricidad', 150000),              -- $1,500 MXN  
('utilities', 'Agua', 80000),                       -- $800 MXN
('salaries', 'Asistente dental', 600000),           -- $6,000 MXN
('equipment', 'Mantenimiento equipo', 200000),      -- $2,000 MXN
('insurance', 'Seguro de responsabilidad', 120000), -- $1,200 MXN
('other', 'Publicidad', 150000),                    -- $1,500 MXN
('other', 'Educación continua', 100000);            -- $1,000 MXN