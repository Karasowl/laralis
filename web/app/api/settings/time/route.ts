import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zSettingsTime } from '@/lib/zod';
import type { SettingsTime, ApiResponse } from '@/lib/types';

export async function GET(): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings_time')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If no records found, return null data instead of error
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null });
      }
      
      console.error('Error fetching time settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch time settings', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in GET /api/settings/time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = zSettingsTime.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { work_days, hours_per_day, real_pct } = validationResult.data;

    // Check if a record exists (upsert behavior)
    const { data: existing } = await supabaseAdmin
      .from('settings_time')
      .select('id')
      .limit(1)
      .single();

    let result;
    
    if (existing) {
      // Update existing record
      result = await supabaseAdmin
        .from('settings_time')
        .update({ 
          work_days, 
          hours_per_day, 
          real_pct,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new record
      result = await supabaseAdmin
        .from('settings_time')
        .insert({ work_days, hours_per_day, real_pct })
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving time settings:', result.error);
      return NextResponse.json(
        { error: 'Failed to save time settings', message: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: result.data,
      message: existing ? 'Time settings updated' : 'Time settings created'
    });

  } catch (error) {
    console.error('Unexpected error in POST /api/settings/time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT method for explicit updates
export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<SettingsTime>>> {
  return POST(request); // Same logic as POST for upsert
}