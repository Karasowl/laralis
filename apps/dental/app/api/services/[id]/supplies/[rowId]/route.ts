import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ApiResponse } from '@/lib/types';
import { cookies } from 'next/headers';
import { resolveClinicContext } from '@/lib/clinic';
import { forbiddenIfMissingPermission } from '@/lib/permissions';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';
import { getConvexDocumentByLegacyId, patchConvexDocumentByLegacyId, deleteConvexDocumentByLegacyId } from '@/lib/convex/server';
import { shouldUseConvexOnlyWritePath, shouldWriteConvexData } from '@/lib/data-backend';

export const dynamic = 'force-dynamic'

const serviceSupplyUpdateSchema = z.object({
  qty: z.number().min(0),
});


interface RouteParams {
  params: {
    id: string;
    rowId: string;
  };
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const cookieStore = cookies();
    const ctx = await resolveClinicContext({ cookieStore });
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
    }
    const { clinicId, userId } = ctx;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.edit');
    if (forbidden) return forbidden;

    if (shouldUseConvexOnlyWritePath('services')) {
      const [recipeLine, service] = await Promise.all([
        getConvexDocumentByLegacyId('service_supplies', params.rowId) as Promise<Record<string, any> | null>,
        getConvexDocumentByLegacyId('services', params.id) as Promise<Record<string, any> | null>,
      ])

      if (!recipeLine || recipeLine.service_id !== params.id) {
        return NextResponse.json({ error: 'Recipe line not found' }, { status: 404 })
      }
      if (!service || service.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      await deleteConvexDocumentByLegacyId('service_supplies', params.rowId)
      return NextResponse.json({
        data: null,
        message: 'Recipe line deleted successfully'
      })
    }

    // Verify the recipe line exists and belongs to the service and clinic
    // Verify the recipe line exists and belongs to a service in this clinic
    const { data: recipeLine } = await supabaseAdmin
      .from('service_supplies')
      .select('id, service_id')
      .eq('id', params.rowId)
      .eq('service_id', params.id)
      .single();

    if (!recipeLine) {
      return NextResponse.json(
        { error: 'Recipe line not found' },
        { status: 404 }
      );
    }

    // Double-check service belongs to clinic
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();
    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete the recipe line
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .delete()
      .eq('id', params.rowId);

    if (error) {
      console.error('Error deleting recipe line:', error);
      return NextResponse.json(
        { error: 'Failed to delete recipe line', message: error.message },
        { status: 500 }
      );
    }

    if (shouldWriteConvexData('services')) {
      try {
        await deleteConvexDocumentByLegacyId('service_supplies', params.rowId)
      } catch (convexError) {
        console.error('[service supplies row DELETE] Convex mirror failed:', convexError)
      }
    }

    return NextResponse.json({
      data: null,
      message: 'Recipe line deleted successfully'
    });

  } catch (error) {
    console.error('Unexpected error in DELETE /api/services/[id]/supplies/[rowId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const bodyResult = await readJson(request);
    if ('error' in bodyResult) {
      return bodyResult.error;
    }
    const parsed = validateSchema(serviceSupplyUpdateSchema, bodyResult.data);
    if ('error' in parsed) {
      return parsed.error;
    }
    const cookieStore = cookies();
    const ctx = await resolveClinicContext({ cookieStore });
    if ('error' in ctx) {
      return NextResponse.json({ error: ctx.error.message }, { status: ctx.error.status });
    }
    const { clinicId, userId } = ctx;
    const forbidden = await forbiddenIfMissingPermission(userId, clinicId, 'services.edit');
    if (forbidden) return forbidden;

    if (shouldUseConvexOnlyWritePath('services')) {
      const [recipeLine, service] = await Promise.all([
        getConvexDocumentByLegacyId('service_supplies', params.rowId) as Promise<Record<string, any> | null>,
        getConvexDocumentByLegacyId('services', params.id) as Promise<Record<string, any> | null>,
      ])

      if (!recipeLine || recipeLine.service_id !== params.id) {
        return NextResponse.json({ error: 'Recipe line not found' }, { status: 404 })
      }
      if (!service || service.clinic_id !== clinicId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const { qty } = parsed.data
      await patchConvexDocumentByLegacyId('service_supplies', params.rowId, {
        qty,
        updated_at: new Date().toISOString(),
      })

      return NextResponse.json({
        data: null,
        message: 'Recipe line updated successfully'
      })
    }

    // Verify the recipe line exists and belongs to the service and clinic
    const { data: recipeLine } = await supabaseAdmin
      .from('service_supplies')
      .select('id, service_id')
      .eq('id', params.rowId)
      .eq('service_id', params.id)
      .single();

    if (!recipeLine) {
      return NextResponse.json(
        { error: 'Recipe line not found' },
        { status: 404 }
      );
    }

    const { qty } = parsed.data;

    // Double-check service belongs to clinic
    const { data: service } = await supabaseAdmin
      .from('services')
      .select('id')
      .eq('id', params.id)
      .eq('clinic_id', clinicId)
      .single();
    if (!service) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the quantity
    const { error } = await supabaseAdmin
      .from('service_supplies')
      .update({ qty })
      .eq('id', params.rowId);

    if (error) {
      console.error('Error updating recipe line:', error);
      return NextResponse.json(
        { error: 'Failed to update recipe line', message: error.message },
        { status: 500 }
      );
    }

    if (shouldWriteConvexData('services')) {
      try {
        await patchConvexDocumentByLegacyId('service_supplies', params.rowId, {
          qty,
          updated_at: new Date().toISOString(),
        })
      } catch (convexError) {
        console.error('[service supplies row PUT] Convex mirror failed:', convexError)
      }
    }

    return NextResponse.json({
      data: null,
      message: 'Recipe line updated successfully'
    });

  } catch (error) {
    console.error('Unexpected error in PUT /api/services/[id]/supplies/[rowId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
