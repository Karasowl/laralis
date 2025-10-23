# Traducciones pendientes para Campaign Field en Expenses

## Instrucciones

Agrega estas claves a los archivos de mensajes en la sección `expenses.form.fields`:

### web/messages/en.json

Busca la sección `"expenses"` → `"form"` → `"fields"` y agrega:

```json
"campaign": "Marketing Campaign",
"campaignHelp": "Link this expense to a marketing campaign for ROI tracking",
"noCampaign": "No campaign"
```

### web/messages/es.json

Busca la sección `"expenses"` → `"form"` → `"fields"` y agrega:

```json
"campaign": "Campaña de Marketing",
"campaignHelp": "Vincula este gasto a una campaña de marketing para tracking de ROI",
"noCampaign": "Sin campaña"
```

## Ubicación en el JSON

Las claves deben agregarse junto a los otros campos del formulario como:
- `category`
- `subcategory`
- `relatedSupply`
- etc.

## Nota

Si no encuentras la sección exacta, busca por `"relatedSupply"` o `"relatedSupplyNone"` y agrega las nuevas claves cerca de ahí.
