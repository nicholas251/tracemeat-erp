import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fetch the logo from the public URL
    const logoUrl = 'https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/abc6cd33d_MittysFoods_GroteWiegel_MuckesLogos.png';
    const logoResponse = await fetch(logoUrl);
    
    if (!logoResponse.ok) {
      return Response.json({ error: 'Failed to fetch logo' }, { status: 400 });
    }

    const logoBuffer = await logoResponse.arrayBuffer();
    const logoFile = new File([logoBuffer], 'mittysfood-logo.png', { type: 'image/png' });

    // Upload to private storage
    const uploadResult = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
      file: logoFile
    });

    // Store the URI in app settings or return it
    return Response.json({
      success: true,
      file_uri: uploadResult.file_uri,
      message: 'Logo uploaded to private storage'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});