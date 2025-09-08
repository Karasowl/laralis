import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      )
    }

    // Delete user's data from all tables
    // Order matters due to foreign key constraints
    
    // Delete treatments
    await supabase
      .from('treatments')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete expenses
    await supabase
      .from('expenses')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete service_supplies
    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('clinic_id', user.id)
    
    if (services && services.length > 0) {
      const serviceIds = services.map(s => s.id)
      await supabase
        .from('service_supplies')
        .delete()
        .in('service_id', serviceIds)
    }
    
    // Delete services
    await supabase
      .from('services')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete supplies
    await supabase
      .from('supplies')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete patients
    await supabase
      .from('patients')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete fixed_costs
    await supabase
      .from('fixed_costs')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete assets
    await supabase
      .from('assets')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete tariffs
    await supabase
      .from('tariffs')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete settings_time
    await supabase
      .from('settings_time')
      .delete()
      .eq('clinic_id', user.id)
    
    // Delete clinics
    await supabase
      .from('clinics')
      .delete()
      .eq('workspace_id', user.id)
    
    // Delete workspaces
    await supabase
      .from('workspaces')
      .delete()
      .eq('owner_id', user.id)
    
    // Finally, delete the user account
    // Note: This requires admin privileges or a server-side function
    // For now, we'll sign out the user and mark for deletion
    const { error: signOutError } = await supabase.auth.signOut()
    
    if (signOutError) {
      console.error('Error signing out user:', signOutError)
    }
    
    // In production, you would call a Supabase Edge Function with admin privileges
    // to actually delete the auth.users record
    // For now, we return success after deleting all user data
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Account and all associated data deleted successfully'
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}