import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('web');
const messagesDir = path.join(root, 'messages');

function readJson(p){ return JSON.parse(fs.readFileSync(p,'utf8')); }
function writeJson(p, obj){ fs.writeFileSync(p, JSON.stringify(obj, null, 2)+'\n','utf8'); }
function setPath(obj, keyPath, value){
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++){
    const k = parts[i];
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length-1]] = value;
}

const enPath = path.join(messagesDir, 'en-overrides.json');
const esPath = path.join(messagesDir, 'es-overrides.json');
const en = readJson(enPath);
const es = readJson(esPath);

// Keys to enforce
const plan = {
  en: {
    'expenses.title': 'Expenses',
    'expenses.description': 'Manage and track your clinic expenses',
    'expenses.entity': 'Expense',
    'expenses.create_expense': 'Create Expense',
    'expenses.edit_expense': 'Edit Expense',
    'expenses.alerts_title': 'Alerts',
    'expenses.alerts_coming_soon': 'Alerts coming soon',

    'treatments.title': 'Treatments',
    'treatments.subtitle': 'Record and track patient treatments',
    'treatments.newTreatment': 'New Treatment',
    'treatments.addTreatment': 'Add Treatment',
    'treatments.editTreatment': 'Edit Treatment',
    'treatments.deleteTreatment': 'Delete Treatment',
    'treatments.deleteTreatmentConfirm': 'Are you sure you want to delete this treatment?',
    'treatments.emptyTitle': 'No treatments found',
    'treatments.emptyDescription': 'Start registering treatments to see them here',
    'treatments.searchPlaceholder': 'Search treatments...',
    'treatments.notesPlaceholder': 'Add treatment notes (optional)',
    'treatments.additionalInfo': 'Additional Information',
    'treatments.patientAndService': 'Patient and Service',
    'treatments.selectPatient': 'Select patient',
    'treatments.selectService': 'Select service',
    'treatments.selectStatus': 'Select status',
    'treatments.marginHelp': 'Optional percentage added to the base price',
    'treatments.durationHelp': 'Estimated duration of the treatment',
    'treatments.treatmentDetails': 'Treatment Details',
    'treatments.fields.date': 'Date',
    'treatments.fields.duration': 'Duration',
    'treatments.fields.margin': 'Margin',
    'treatments.fields.notes': 'Notes',
    'treatments.fields.patient': 'Patient',
    'treatments.fields.price': 'Price',
    'treatments.fields.service': 'Service',
    'treatments.fields.status': 'Status',
    'treatments.summary.allTreatments': 'All treatments',
    'treatments.summary.averagePrice': 'Average price',
    'treatments.summary.completionRate': 'Completion rate',
    'treatments.summary.perTreatment': 'Per treatment',
    'treatments.summary.registered': 'Registered',
    'treatments.summary.totalRevenue': 'Total revenue',
    'treatments.summary.totalTreatments': 'Total treatments',

    'settings.no_clinic_selected': 'No clinic selected',
    'settings.saved_successfully': 'Settings saved successfully',
    'settings.save_error': 'Error saving settings',

    'settings.clinics.title': 'Clinics',
    'settings.clinics.description': 'Manage clinic branches',
    'settings.clinics.entity': 'Clinic',
    'settings.clinics.emptyTitle': 'No clinics',
    'settings.clinics.selectWorkspaceDesc': 'Select a workspace to manage clinics',
    'settings.clinics.selectWorkspaceTitle': 'Select workspace',
    'settings.clinics.workspace': 'Workspace',
    'settings.clinics.goToWorkspaces': 'Go to Workspaces',
    'settings.clinics.movedDesc': 'This section moved under Settings > Clinics',
    'settings.clinics.movedTitle': 'Clinics moved',
    'settings.clinics.nameRequired': 'Clinic name is required',
    'settings.clinics.selectedAsCurrent': 'Selected as current clinic',
    'settings.clinics.useAsCurrent': 'Use as current clinic',

    'settings.marketing.title': 'Marketing',
    'settings.marketing.description': 'Platforms and campaigns for attribution',
    'settings.marketing.platforms': 'Platforms',
    'settings.marketing.campaigns': 'Campaigns',
    'settings.marketing.patients': 'Patients',
    'settings.marketing.archiveError': 'Could not archive campaign',
    'settings.marketing.restoreError': 'Could not restore campaign',
    'settings.marketing.campaignArchived': 'Campaign archived',
    'settings.marketing.campaignRestored': 'Campaign restored',
    'settings.marketing.cannotDeleteCampaignWithPatients': 'Cannot delete a campaign with patients assigned',

    'settings.workspaces.title': 'Workspaces',
    'settings.workspaces.description': 'Manage your workspaces and organization settings',
    'settings.workspaces.emptyTitle': 'No workspaces',
    'settings.workspaces.nameRequired': 'Workspace name is required',
    'settings.workspaces.slugHelp': 'Lowercase, letters and dashes only',
    'settings.workspaces.slugInvalid': 'Invalid slug',
    'settings.workspaces.validationError': 'Please fix the errors and try again'
  },
  es: {
    'expenses.title': 'Gastos',
    'expenses.description': 'Administra y registra los gastos de tu clinica',
    'expenses.entity': 'Gasto',
    'expenses.create_expense': 'Crear Gasto',
    'expenses.edit_expense': 'Editar Gasto',
    'expenses.alerts_title': 'Alertas',
    'expenses.alerts_coming_soon': 'Alertas proximamente',

    'treatments.title': 'Tratamientos',
    'treatments.subtitle': 'Registra y da seguimiento a los tratamientos',
    'treatments.newTreatment': 'Nuevo tratamiento',
    'treatments.addTreatment': 'Agregar tratamiento',
    'treatments.editTreatment': 'Editar tratamiento',
    'treatments.deleteTreatment': 'Eliminar tratamiento',
    'treatments.deleteTreatmentConfirm': 'Seguro que deseas eliminar este tratamiento?',
    'treatments.emptyTitle': 'No hay tratamientos',
    'treatments.emptyDescription': 'Comienza a registrar tratamientos para verlos aqui',
    'treatments.searchPlaceholder': 'Buscar tratamientos...',
    'treatments.notesPlaceholder': 'Agrega notas del tratamiento (opcional)',
    'treatments.additionalInfo': 'Informacion adicional',
    'treatments.patientAndService': 'Paciente y servicio',
    'treatments.selectPatient': 'Selecciona paciente',
    'treatments.selectService': 'Selecciona servicio',
    'treatments.selectStatus': 'Selecciona estado',
    'treatments.marginHelp': 'Porcentaje opcional agregado al precio base',
    'treatments.durationHelp': 'Duracion estimada del tratamiento',
    'treatments.treatmentDetails': 'Detalles del tratamiento',
    'treatments.fields.date': 'Fecha',
    'treatments.fields.duration': 'Duracion',
    'treatments.fields.margin': 'Margen',
    'treatments.fields.notes': 'Notas',
    'treatments.fields.patient': 'Paciente',
    'treatments.fields.price': 'Precio',
    'treatments.fields.service': 'Servicio',
    'treatments.fields.status': 'Estado',
    'treatments.summary.allTreatments': 'Todos los tratamientos',
    'treatments.summary.averagePrice': 'Precio promedio',
    'treatments.summary.completionRate': 'Tasa de finalizacion',
    'treatments.summary.perTreatment': 'Por tratamiento',
    'treatments.summary.registered': 'Registrados',
    'treatments.summary.totalRevenue': 'Ingresos totales',
    'treatments.summary.totalTreatments': 'Tratamientos totales',

    'settings.no_clinic_selected': 'Sin clinica seleccionada',
    'settings.saved_successfully': 'Configuracion guardada con exito',
    'settings.save_error': 'Error al guardar la configuracion',

    'settings.clinics.title': 'Clinicas',
    'settings.clinics.description': 'Administra las sucursales de la clinica',
    'settings.clinics.entity': 'Clinica',
    'settings.clinics.emptyTitle': 'No hay clinicas',
    'settings.clinics.selectWorkspaceDesc': 'Selecciona un espacio de trabajo para administrar clinicas',
    'settings.clinics.selectWorkspaceTitle': 'Selecciona espacio de trabajo',
    'settings.clinics.workspace': 'Espacio de trabajo',
    'settings.clinics.goToWorkspaces': 'Ir a Espacios de trabajo',
    'settings.clinics.movedDesc': 'Esta seccion se movio a Configuracion > Clinicas',
    'settings.clinics.movedTitle': 'Clinicas movidas',
    'settings.clinics.nameRequired': 'El nombre de la clinica es obligatorio',
    'settings.clinics.selectedAsCurrent': 'Seleccionada como clinica actual',
    'settings.clinics.useAsCurrent': 'Usar como clinica actual',

    'settings.marketing.title': 'Marketing',
    'settings.marketing.description': 'Plataformas y campanas para atribucion',
    'settings.marketing.platforms': 'Plataformas',
    'settings.marketing.campaigns': 'Campanas',
    'settings.marketing.patients': 'Pacientes',
    'settings.marketing.archiveError': 'No se pudo archivar la campana',
    'settings.marketing.restoreError': 'No se pudo restaurar la campana',
    'settings.marketing.campaignArchived': 'Campana archivada',
    'settings.marketing.campaignRestored': 'Campana restaurada',
    'settings.marketing.cannotDeleteCampaignWithPatients': 'No se puede eliminar una campana con pacientes asignados',

    'settings.workspaces.title': 'Espacios de trabajo',
    'settings.workspaces.description': 'Administra tus espacios de trabajo y configuracion',
    'settings.workspaces.emptyTitle': 'No hay espacios de trabajo',
    'settings.workspaces.nameRequired': 'El nombre del espacio es obligatorio',
    'settings.workspaces.slugHelp': 'Minusculas, letras y guiones',
    'settings.workspaces.slugInvalid': 'Slug invalido',
    'settings.workspaces.validationError': 'Corrige los errores e intentalo de nuevo'
  }
};

for (const [k,v] of Object.entries(plan.en)) setPath(en, k, v);
for (const [k,v] of Object.entries(plan.es)) setPath(es, k, v);

writeJson(enPath, en);
writeJson(esPath, es);
console.log('finalize-i18n: applied keys', { en: Object.keys(plan.en).length, es: Object.keys(plan.es).length });
