import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { aiService } from '@/lib/ai/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

        const body = await request.json();
        const { action, clinicId, sessionId, message, role, metadata } = body;

        if (action === 'create_session') {
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .insert({
                    user_id: user.id,
                    clinic_id: clinicId,
                    title: 'Nueva conversación',
                })
                .select()
                .single();

            if (error) throw error;
            return NextResponse.json({ session: data });
        }

        if (action === 'add_message') {
            if (!sessionId || !message || !role) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Verify session ownership
            const { data: session, error: sessionError } = await supabase
                .from('ai_chat_sessions')
                .select('id')
                .eq('id', sessionId)
                .eq('user_id', user.id)
                .single();

            if (sessionError || !session) {
                return NextResponse.json({ error: 'Session not found or unauthorized' }, { status: 404 });
            }

            const { data, error } = await supabase
                .from('ai_chat_messages')
                .insert({
                    session_id: sessionId,
                    role,
                    content: message,
                    metadata: metadata || {}
                })
                .select()
                .single();

            if (error) throw error;

            // Update session timestamp
            await supabase
                .from('ai_chat_sessions')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', sessionId);

            return NextResponse.json({ message: data });
        }

        if (action === 'generate_title') {
            if (!sessionId || !message) { // message here is the first user message + assistant response context
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Use AI to generate a title
            // We'll use a simple chat completion for this
            const prompt = `Summarize the following conversation start into a very short title (max 4-5 words) in Spanish. Do not use quotes.
            
            Conversation:
            ${message}`;

            const title = await aiService.chat([
                { role: 'system', content: 'You are a helpful assistant that summarizes conversations into short titles.' },
                { role: 'user', content: prompt }
            ]);

            const cleanTitle = title.replace(/^["']|["']$/g, '').trim();

            // Update session title
            const { data, error } = await supabase
                .from('ai_chat_sessions')
                .update({ title: cleanTitle })
                .eq('id', sessionId)
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

        const body = await request.json();
        const { sessionId, title } = body;

        if (!sessionId || !title) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

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

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const { error } = await supabase
            .from('ai_chat_sessions')
            .delete()
            .eq('id', sessionId)
            .eq('user_id', user.id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Error deleting session:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
