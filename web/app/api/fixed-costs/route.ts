import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { zFixedCost } from '@/lib/zod';
import type { FixedCost, ApiResponse } from '@/lib/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<FixedCost[]>>> {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const category = searchParams.get('category');

    let query = supabaseAdmin
      .from('fixed_costs')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply category filter if provided
    if (category) {
      query = query.eq('category', category);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fixed costs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch fixed costs', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Unexpected error in GET /api/fixed-costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<FixedCost>>> {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = zFixedCost.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          message: validationResult.error.errors.map(e => e.message).join(', ')
        },
        { status: 400 }
      );
    }

    const { category, concept, amount_cents } = validationResult.data;

    const { data, error } = await supabaseAdmin
      .from('fixed_costs')
      .insert({ category, concept, amount_cents })
      .select()
      .single();

    if (error) {
      console.error('Error creating fixed cost:', error);
      return NextResponse.json(
        { error: 'Failed to create fixed cost', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data,
      message: 'Fixed cost created successfully'
    }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in POST /api/fixed-costs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}