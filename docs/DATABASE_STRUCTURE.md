# Estructura de Base de Datos - Laralis

**Fecha**: 2025-10-16
**Total de tablas**: 48 (incluyendo views)

## Tablas Principales

### 1. **workspaces** (Multi-tenancy principal)
- `id` (PK)
- `name`
- `owner_id` → auth.users
- Relaciones: workspace_members, clinics, workspace_activity

### 2. **workspace_members**
- `id` (PK)
- `workspace_id` → workspaces.id (CASCADE)
- `user_id` → auth.users (CASCADE)
- `role`, `permissions`, `clinic_ids`

### 3. **clinics**
- `id` (PK)
- `workspace_id` → workspaces.id (CASCADE)
- `org_id` → organizations.id
- Relaciones: settings_time, fixed_costs, assets, supplies, services, patients, treatments, expenses

### 4. **settings_time**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `work_days`, `hours_per_day`, `real_pct`

### 5. **fixed_costs**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `category`, `concept`, `amount_cents`

### 6. **assets**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `purchase_price_cents`, `depreciation_months`, `monthly_depreciation_cents`

### 7. **supplies**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `price_cents`, `portions`, `cost_per_portion_cents`
- `stock_quantity`, `min_stock_alert`

### 8. **services**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `est_minutes` (NO duration_minutes)
- `variable_cost_cents`, `margin_pct`, `price_cents`

### 9. **service_supplies** (Recetas)
- `id` (PK)
- `service_id` → services.id (CASCADE)
- `supply_id` → supplies.id (CASCADE)
- `qty` (NO quantity)
- `unit_cost_cents`

### 10. **patients**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `source_id` → patient_sources.id
- `campaign_id` → marketing_campaigns.id
- `referred_by_patient_id` → patients.id (self-reference)

### 11. **treatments**
- `id` (PK)
- `clinic_id` (NO FK definido - POSIBLE HUÉRFANO)
- `patient_id` → patients.id
- `service_id` → services.id
- `minutes` (NO duration_minutes)
- `fixed_cost_per_minute_cents`, `variable_cost_cents`, `margin_pct`, `price_cents`

### 12. **expenses**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `category_id` → categories.id
- `related_asset_id` → assets.id
- `related_supply_id` → supplies.id

### 13. **tariffs**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `service_id` → services.id (CASCADE)
- `version`, `valid_from`, `valid_until`

### 14. **categories** (Sistema flexible)
- `id` (PK)
- `clinic_id` (nullable - para categorías globales)
- `entity_type`, `name`, `is_system`

### 15. **marketing_campaigns**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)
- `platform_category_id` → categories.id

### 16. **marketing_campaign_status_history**
- `id` (PK)
- `campaign_id` → marketing_campaigns.id (CASCADE)

### 17. **patient_sources**
- `id` (PK)
- `clinic_id` → clinics.id (CASCADE)

## Tablas de Soporte

- **organizations**: Multi-tenancy legacy
- **clinic_users**: Usuarios por clínica
- **invitations**: Invitaciones pendientes
- **custom_categories**: Categorías personalizadas
- **category_types**: Tipos de categorías
- **verification_codes**: Códigos de verificación de email
- **role_permissions**: Permisos por rol
- **workspace_users**: Usuarios de workspace (parece duplicado con workspace_members)
- **workspace_activity**: Auditoría de actividad

## Views (Vistas)

- `campaign_stats`: Estadísticas de campañas
- `patient_source_stats`: Estadísticas por fuente de paciente
- `patient_acquisition_report`: Reporte de adquisición
- `referral_network`: Red de referidos
- `low_stock_alerts`: Alertas de stock bajo
- `v_categories`: Vista de categorías
- `v_categories_with_type`: Categorías con tipo
- `v_dashboard_metrics`: Métricas del dashboard
- `my_permissions`: Permisos del usuario actual
- `my_workspaces_and_clinics`: Workspaces y clínicas del usuario

## Tablas de Backup

- `_backup_patient_sources`: Respaldo de fuentes de pacientes

## Campos Importantes Descubiertos

### Nombres diferentes a los esperados:
- ✅ `service_supplies.qty` (NO `quantity`)
- ✅ `services.est_minutes` (NO `duration_minutes`)
- ✅ `treatments.minutes` (NO `duration_minutes`)
- ✅ `services.is_active` y también `services.active` (duplicado?)

### Foreign Keys importantes:
- `treatments.clinic_id` **NO tiene FK constraint** (potencial huérfano)
- `workspace_members.user_id` → auth.users (esquema externo)
- `patients.referred_by_patient_id` → patients.id (self-reference)

## Jerarquía de CASCADE DELETE

```
auth.users (deleted) →
  └── workspace_members (CASCADE)
  └── workspaces (if owner_id) (CASCADE) →
       ├── workspace_members (CASCADE)
       ├── workspace_activity (CASCADE)
       ├── invitations (CASCADE)
       └── clinics (CASCADE) →
            ├── settings_time (CASCADE)
            ├── fixed_costs (CASCADE)
            ├── assets (CASCADE)
            ├── supplies (CASCADE)
            ├── services (CASCADE) →
            │    ├── service_supplies (CASCADE)
            │    └── tariffs (CASCADE)
            ├── patients (CASCADE) →
            │    └── treatments (CASCADE)
            ├── expenses (CASCADE)
            ├── patient_sources (CASCADE)
            ├── marketing_campaigns (CASCADE) →
            │    └── marketing_campaign_status_history (CASCADE)
            └── workspace_activity (CASCADE)
```

## Notas Importantes

1. **treatments.clinic_id** NO tiene constraint de foreign key definido
2. Hay duplicación: `workspace_members` vs `workspace_users`
3. Algunas tablas tienen `is_active` y otras solo `active`
4. El campo `organizations.id` existe pero parece legacy (no se usa mucho)
5. Muchas views calculadas que podrían impactar performance

---

**Próximo paso**: Crear script de análisis de huérfanos basado en esta estructura real.
