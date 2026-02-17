import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiService } from '@/lib/ai/service';
import { z } from 'zod';
import { readJson, validateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const chatActionSchema = z.discriminatedUnion('action', [
    z.object({
        action: z.literal('create_session'),
        clinicId: z.string().uuid(),
    }),
    z.object({
        action: z.literal('add_message'),
        sessionId: z.string().uuid(),
        message: z.string().min(1),
        role: z.string().min(1),
        metadata: z.record(z.unknown()).optional(),
    }),
    z.object({
        action: z.literal('generate_title'),
        sessionId: z.string().uuid(),
        message: z.string().min(1),
    }),
]);

const updateSessionSchema = z.object({
    sessionId: z.string().uuid(),
    title: z.string().min(1),
});

const deleteSessionSchema = z.object({
    sessionId: z.string().uuid(),
});

// GET: Load latest session, specific session, or list of sessions
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const clinicId = searchParams.get('clinicId');
        const sessionId = searchParams.get('sessionId');
        const mode = searchParams.get('mode'); // 'list' or 'single' (default)

        if (mode === 'list' && clinicId) {
            // List all sessions for this clinic
            const { data: sessions, error } = await supabase
                .from('ai_chat_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('clinic_id', clinicId)
                .order('updated_at', { ascending: false });

            if (error) throw error;
            return NextResponse.json({ sessions });
        }

        let sessionData;

        if (sessionId) {
            // Load specific session
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .select('*')
                .eq('id', sessionId)
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            sessionData = data;
        } else if (clinicId) {
            // Load latest session for this clinic
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .select('*')
                .eq('user_id', user.id)
                .eq('clinic_id', clinicId)
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();

            // It's okay if no session exists yet
            if (!error) sessionData = data;
        }

        if (!sessionData) {
            return NextResponse.json({ session: null, messages: [] });
        }

        // Load messages for the session
        const { data: messages, error: msgError } = await supabase
            .from('ai_chat_messages')
            .select('*')
            .eq('session_id', sessionData.id)
            .order('created_at', { ascending: true });

        if (msgError) throw msgError;

        return NextResponse.json({ session: sessionData, messages });

    } catch (error: any) {
        console.error('Error fetching chat history:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Create session, add message, or generate title
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
        const parsed = validateSchema(chatActionSchema, bodyResult.data);
        if ('error' in parsed) {
            return parsed.error;
        }

        const payload = parsed.data;

        if (payload.action === 'create_session') {
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .insert({
                    user_id: user.id,
                    clinic_id: payload.clinicId,
                    title: 'Nueva conversación',
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ session: data });
        }

        if (payload.action === 'add_message') {
            // Verify session ownership
            const { data: session, error: sessionError } = await supabase
                .from('ai_chat_sessions')
                .select('id')
                .eq('id', payload.sessionId)
                .eq('user_id', user.id)
                .single();

            if (sessionError || !session) {
                return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
            }

            const { data, error } = await supabase
                .from('ai_chat_messages')
                .insert({
                    session_id: payload.sessionId,
                    role: payload.role,
                    content: payload.message,
                    metadata: payload.metadata || {}
                })
                .select()
                .single();

            if (error) throw error;

            // Update session timestamp
            await supabase
                .from('ai_chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', payload.sessionId);

            return NextResponse.json({ message: data });
        }

        if (payload.action === 'generate_title') {
            // Use AI to generate a title
            // We'll use a simple chat completion for this
            const prompt = `Summarize the following conversation start into a very short title (max 4-5 words) in Spanish. Do not use quotes.
            
            Conversation:
            ${payload.message}`;

            const title = await aiService.chat([
                { role: 'system', content: 'You are a helpful assistant that summarizes conversations into short titles.' },
                { role: 'user', content: prompt }
            ]);

            const cleanTitle = title.replace(/^["']|["']$/g, '').trim();

            // Update session title
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .update({ title: cleanTitle })
                .eq('id', payload.sessionId)
                .eq('user_id', user.id)
                .select()
                .single();

            if (error) throw error;

            return NextResponse.json({ session: data });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Error in chat history API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Update session (e.g. title)
export async function PATCH(request: NextRequest) {
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
        const parsed = validateSchema(updateSessionSchema, bodyResult.data);
        if ('error' in parsed) {
            return parsed.error;
        }
        const { sessionId, title } = parsed.data;

        const { data, error } = await supabase
            .from('ai_chat_sessions')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', sessionId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ session: data });

    } catch (error: any) {
        console.error('Error updating session:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: Delete session
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const sessionId = searchParams.get('sessionId');
        const parsed = validateSchema(deleteSessionSchema, { sessionId });
        if ('error' in parsed) {
            return parsed.error;
        }

        const { error } = await supabase
            .from('ai_chat_sessions')
            .delete()
            .eq('id', parsed.data.sessionId)
            .eq('user_id', user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting session:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
