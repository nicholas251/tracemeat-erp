import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role === 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json();
    const logoUrl = body.logoUrl || 'https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/abc6cd33d_MittysFoods_GroteWiegel_MuckesLogos.png';

    // Fetch the logo image
    const logoResp = await fetch(logoUrl);
    if (!logoResp.ok) {
      return Response.json({ error: 'Failed to fetch logo' }, { status: 400 });
    }

    const logoBlob = await logoResp.blob();

    // Upload to private storage
    const file = new File([logoBlob], 'logo.png', { type: 'image/png' });
    const uploadResp = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file });

    // Create a signed URL (valid for 1 year)
    const signedUrl = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: uploadResp.file_uri,
      expires_in: 31536000, // 1 year in seconds
    });

    return Response.json({ 
      success: true,
      file_uri: uploadResp.file_uri,
      signed_url: signedUrl.signed_url
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});