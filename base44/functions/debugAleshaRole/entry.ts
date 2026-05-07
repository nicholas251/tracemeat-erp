import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get all users
    const users = await base44.asServiceRole.entities.User.list();
    const alesha = users.find(u => u.email?.toLowerCase().includes('alesha') || u.full_name?.toLowerCase().includes('alesha'));
    
    if (!alesha) {
      return Response.json({ error: 'Alesha not found', allUsers: users.map(u => ({ id: u.id, name: u.full_name, email: u.email, role: u.role })) }, { status: 404 });
    }
    
    // Force update her role to supervisor
    await base44.asServiceRole.entities.User.update(alesha.id, { role: 'supervisor' });
    
    // Verify it was updated
    const updated = await base44.asServiceRole.entities.User.list();
    const aleshaUpdated = updated.find(u => u.id === alesha.id);
    
    return Response.json({ 
      success: true,
      aleshaId: alesha.id,
      beforeRole: alesha.role,
      afterRole: aleshaUpdated.role,
      message: 'Alesha role forced to supervisor'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});