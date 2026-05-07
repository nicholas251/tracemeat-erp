import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { fullName, email, password } = await req.json();

    if (!fullName || !email || !password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to create the user (invites work for signup)
    const result = await base44.asServiceRole.users.inviteUser(email, 'user');

    return Response.json({ 
      success: true, 
      message: 'Profile created successfully. Check your email to set your password.',
      email 
    });
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: error.message || 'Failed to create profile' }, { status: 500 });
  }
});