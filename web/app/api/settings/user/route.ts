import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const userSettingSchema = z.object({
    key: z.string().min(1),
    value: z.unknown(),
});

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const key = searchParams.get('key');

        let query = supabase
            .from('user_settings')
            .select('key, value')
            .eq('user_id', user.id);

        if (key) {
            query = query.eq('key', key);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching user settings:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Transform array to object for easier consumption
        const settings = data?.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {} as Record<string, any>) || {};

        return NextResponse.json({ settings });
    } catch (error) {
        console.error('Unexpected error in GET /api/settings/user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const bodyResult = await readJson(request);
        if ('error' in bodyResult) {
            return bodyResult.error;
        }
        const parsed = validateSchema(userSettingSchema, bodyResult.data);
        if ('error' in parsed) {
            return parsed.error;
        }
        const { key, value } = parsed.data;

        const { data, error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: user.id,
                key,
                value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, key' })
            .select()
            .single();

        if (error) {
            console.error('Error saving user setting:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Unexpected error in POST /api/settings/user:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
