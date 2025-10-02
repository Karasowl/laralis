import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

function uniqueNonEmpty(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const envCandidates = [
  path.resolve(rootDir, 'web', '.env.local'),
  path.resolve(rootDir, '.env.local'),
  path.resolve(rootDir, '.env')
];

envCandidates.forEach(loadEnvFile);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured.');
  process.exit(1);
}

const IGNORABLE_ERRORS = new Set(['PGRST103', 'PGRST116', '42P01']);

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function shouldIgnore(error) {
  if (!error) return false;
  if (error.message && error.message.includes("schema cache")) { return true; }
  return IGNORABLE_ERRORS.has(error.code || "");
}

async function deleteWorkspacesDeep(workspaceIds) {
  const uniqueWorkspaceIds = uniqueNonEmpty(workspaceIds);

  if (uniqueWorkspaceIds.length === 0) {
    return { workspaces: 0, clinics: 0 };
  }

  let deletedWorkspaces = 0;
  let deletedClinics = 0;

  for (const workspaceId of uniqueWorkspaceIds) {
    const { data: clinics, error: clinicsError } = await supabaseAdmin
      .from('clinics')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (clinicsError) {
      throw new Error(`Failed to fetch clinics for workspace ${workspaceId}: ${clinicsError.message}`);
    }

    const clinicIds = uniqueNonEmpty((clinics || []).map(clinic => clinic.id));

    if (clinicIds.length > 0) {
      const { data: serviceRows, error: servicesSelectError } = await supabaseAdmin
        .from('services')
        .select('id')
        .in('clinic_id', clinicIds);

      if (servicesSelectError) {
        throw new Error(`Failed to fetch services for clinics ${clinicIds.join(', ')}: ${servicesSelectError.message}`);
      }

      const serviceIds = uniqueNonEmpty((serviceRows || []).map(service => service.id));

      if (serviceIds.length > 0) {
        const { error: serviceSuppliesDeleteError } = await supabaseAdmin
          .from('service_supplies')
          .delete()
          .in('service_id', serviceIds);

        if (serviceSuppliesDeleteError && !shouldIgnore(serviceSuppliesDeleteError)) {
          throw new Error(`Failed to delete service_supplies for services ${serviceIds.join(', ')}: ${serviceSuppliesDeleteError.message}`);
        }
      }

      const clinicTables = [
        'treatments',
        'patients',
        'expenses',
        'tariffs',
        'services',
        'supplies',
        'fixed_costs',
        'assets',
        'settings_time'
      ];

      for (const table of clinicTables) {
        const { error: deleteError } = await supabaseAdmin
          .from(table)
          .delete()
          .in('clinic_id', clinicIds);

        if (deleteError && !shouldIgnore(deleteError)) {
          throw new Error(`Failed to delete from ${table} for clinics ${clinicIds.join(', ')}: ${deleteError.message}`);
        }
      }

      const { error: categoriesError } = await supabaseAdmin
        .from('categories')
        .delete()
        .in('clinic_id', clinicIds)
        .eq('is_system', false);

      if (categoriesError && !shouldIgnore(categoriesError)) {
        throw new Error(`Failed to delete custom categories for clinics ${clinicIds.join(', ')}: ${categoriesError.message}`);
      }
    }

    const { error: clinicsDeleteError, count: clinicsDeletedCount } = await supabaseAdmin
      .from('clinics')
      .delete({ count: 'exact' })
      .eq('workspace_id', workspaceId);

    if (clinicsDeleteError && !shouldIgnore(clinicsDeleteError)) {
      throw new Error(`Failed to delete clinics for workspace ${workspaceId}: ${clinicsDeleteError.message}`);
    }

    deletedClinics += clinicsDeletedCount || 0;

    const workspaceTables = ['workspace_activity', 'workspace_invitations', 'workspace_members'];

    for (const table of workspaceTables) {
      const { error: workspaceTableError } = await supabaseAdmin
        .from(table)
        .delete()
        .eq('workspace_id', workspaceId);

      if (workspaceTableError && !shouldIgnore(workspaceTableError)) {
        throw new Error(`Failed to delete entries from ${table} for workspace ${workspaceId}: ${workspaceTableError.message}`);
      }
    }

    const { error: workspaceDeleteError, count: workspacesDeletedCount } = await supabaseAdmin
      .from('workspaces')
      .delete({ count: 'exact' })
      .eq('id', workspaceId);

    if (workspaceDeleteError && !shouldIgnore(workspaceDeleteError)) {
      throw new Error(`Failed to delete workspace ${workspaceId}: ${workspaceDeleteError.message}`);
    }

    deletedWorkspaces += workspacesDeletedCount || 0;
  }

  return {
    workspaces: deletedWorkspaces,
    clinics: deletedClinics
  };
}

async function clearDanglingClinicReferences(validClinicIds) {
  const remaining = new Set(validClinicIds);
  const summary = {};
  const tables = ['settings_time', 'fixed_costs'];

  for (const table of tables) {
    const { data: rows, error } = await supabaseAdmin
      .from(table)
      .select('id, clinic_id');

    if (error && !shouldIgnore(error)) {
      throw new Error(`Failed to inspect ${table}: ${error.message}`);
    }

    const invalidRows = (rows || []).filter(row => row.clinic_id && !remaining.has(row.clinic_id));

    if (invalidRows.length === 0) {
      summary[table] = 0;
      continue;
    }

    const invalidIds = invalidRows.map(row => row.id);

    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from(table)
      .update({ clinic_id: null })
      .in('id', invalidIds)
      .select('id');

    if (updateError && !shouldIgnore(updateError)) {
      throw new Error(`Failed to clear clinic references from ${table}: ${updateError.message}`);
    }

    summary[table] = (updatedRows || []).length;
  }

  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const removeAll = args.includes('--all');

  const targetClinicNames = ['Toluca Centro', 'Toluca Norte'];
  const targetOrganizationNames = ['PoDent Group'];

  let workspaceIds = [];
  let clinicsToRemove = [];

  if (removeAll) {
    const { data: allWorkspaces, error: allWorkspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('id, name, created_at')
      .order('created_at', { ascending: true });

    if (allWorkspaceError) {
      throw new Error(`Failed to fetch workspaces: ${allWorkspaceError.message}`);
    }

    workspaceIds = uniqueNonEmpty((allWorkspaces || []).map(ws => ws.id));

    console.log('Preparing to remove all workspaces:', (allWorkspaces || []).map(ws => `${ws.name} (${ws.id})`).join(', ') || 'none');
  } else {
    const { data, error } = await supabaseAdmin
      .from('clinics')
      .select('id, workspace_id, org_id, name')
      .in('name', targetClinicNames);

    if (error) {
      throw new Error(`Failed to locate demo clinics: ${error.message}`);
    }

    clinicsToRemove = data || [];
    workspaceIds = uniqueNonEmpty(clinicsToRemove.map(clinic => clinic.workspace_id));

    if (workspaceIds.length === 0) {
      console.log('No demo clinics found. Nothing to clean up.');
      return;
    }

    console.log('Preparing to remove workspaces linked to clinics:', clinicsToRemove.map(c => `${c.name} (${c.workspace_id})`).join(', '));
  }

  if (workspaceIds.length === 0) {
    console.log('No workspaces found to delete.');
    return;
  }

  const deletionSummary = await deleteWorkspacesDeep(workspaceIds);

  const { data: remainingClinics, error: remainingClinicsError } = await supabaseAdmin
    .from('clinics')
    .select('id');

  if (remainingClinicsError && !shouldIgnore(remainingClinicsError)) {
    throw new Error(`Failed to fetch remaining clinics: ${remainingClinicsError.message}`);
  }

  const remainingClinicIds = uniqueNonEmpty((remainingClinics || []).map(clinic => clinic.id));
  const cleanupSummary = await clearDanglingClinicReferences(remainingClinicIds);

  if (!removeAll) {
    const { error: orgDeleteError } = await supabaseAdmin
      .from('organizations')
      .delete()
      .in('name', targetOrganizationNames);

    if (orgDeleteError && !shouldIgnore(orgDeleteError)) {
      throw new Error(`Failed to delete demo organizations: ${orgDeleteError.message}`);
    }
  }

  console.log('Cleanup completed successfully.');
  console.table({
    deletedWorkspaces: deletionSummary.workspaces,
    deletedClinics: deletionSummary.clinics,
    clearedSettingsTime: cleanupSummary.settings_time || 0,
    clearedFixedCosts: cleanupSummary.fixed_costs || 0
  });
}

main().catch(error => {
  console.error('Cleanup failed:', error.message);
  process.exit(1);
});

