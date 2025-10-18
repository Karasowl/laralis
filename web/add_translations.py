import json

# Read English messages
with open('E:/dev-projects/laralis/web/messages/en.json', 'r', encoding='utf-8') as f:
    en_data = json.load(f)

# Read Spanish messages  
with open('E:/dev-projects/laralis/web/messages/es.json', 'r', encoding='utf-8') as f:
    es_data = json.load(f)

# Ensure services section exists
if 'services' not in en_data:
    en_data['services'] = {}
if 'services' not in es_data:
    es_data['services'] = {}

# Add missing placeholders to English
en_data['services']['searchSupplyPlaceholder'] = 'Search supplies...'
en_data['services']['quantityPlaceholder'] = '0'
en_data['services']['servicePlaceholder'] = 'e.g., Dental cleaning'
en_data['services']['assetPlaceholder'] = 'e.g., Dental chair'
en_data['services']['supplyNamePlaceholder'] = 'e.g., Latex gloves'
en_data['services']['supplyPresentationPlaceholder'] = 'e.g., Box of 100'

# Add missing placeholders to Spanish
es_data['services']['searchSupplyPlaceholder'] = 'Buscar insumos...'
es_data['services']['quantityPlaceholder'] = '0'
es_data['services']['servicePlaceholder'] = 'Ej: Limpieza dental'
es_data['services']['assetPlaceholder'] = 'Ej: Sillón dental'
es_data['services']['supplyNamePlaceholder'] = 'Ej: Guantes de látex'
es_data['services']['supplyPresentationPlaceholder'] = 'Ej: Caja de 100'

# Write back
with open('E:/dev-projects/laralis/web/messages/en.json', 'w', encoding='utf-8') as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)

with open('E:/dev-projects/laralis/web/messages/es.json', 'w', encoding='utf-8') as f:
    json.dump(es_data, f, ensure_ascii=False, indent=2)

print("Translations added successfully!")
