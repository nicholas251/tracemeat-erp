import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const { fullName, email, requestedProfileIds, requestedProfileNames } = await req.json();

    if (!fullName || !email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Create work profile request record
    if (requestedProfileIds && requestedProfileIds.length > 0) {
      await base44.asServiceRole.entities.WorkProfileRequest.create({
        user_email: email,
        requested_profile_ids: requestedProfileIds,
        requested_profile_names: requestedProfileNames || [],
        status: 'pending'
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Profile request submitted. An administrator will review your application.',
      email 
    });
  } catch (error) {
    console.error('Signup error:', error);
    return Response.json({ error: error.message || 'Failed to create profile' }, { status: 500 });
  }
});