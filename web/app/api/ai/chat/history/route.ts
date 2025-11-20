import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: Load latest session or specific session
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

// POST: Create session or add message
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
                    title: 'New Conversation',
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

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        console.error('Error in chat history API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
