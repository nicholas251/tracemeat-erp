import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const po = body.po;

    if (!po || !po.supplier_email || !po.po_number) {
      return Response.json({ error: 'Missing required PO data' }, { status: 400 });
    }

    // Build email body
    const lineItemsText = (po.line_items || [])
      .map(item => `${item.material_name} - ${item.quantity_lbs} lbs @ $${item.unit_price}/lb = $${(item.quantity_lbs * item.unit_price).toFixed(2)}`)
      .join('\n');

    const emailBody = `
Hello,

We have created a new Purchase Order for you. Please find the details below:

PO NUMBER: ${po.po_number}
ORDER DATE: ${po.order_date}
EXPECTED DELIVERY: ${po.expected_delivery_date || 'N/A'}

SHIP-TO:
${po.ship_to_contact_name}
${po.ship_to_address}
Phone: ${po.ship_to_contact_phone}

LINE ITEMS:
${lineItemsText}

TOTAL AMOUNT: $${(po.total_amount || 0).toFixed(2)}

${po.notes ? `NOTES:\n${po.notes}\n` : ''}

Please confirm receipt of this purchase order.

Best regards,
Purchase Order System
    `.trim();

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Build MIME message
    const message = `From: ${user.email}
To: ${po.supplier_email}
Subject: Purchase Order ${po.po_number}
Content-Type: text/plain; charset="UTF-8"

${emailBody}`;

    // Encode message in base64url
    const encodedMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Send via Gmail API
    const response = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          raw: encodedMessage,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ error: error.error.message }, { status: 500 });
    }

    const result = await response.json();

    return Response.json({
      success: true,
      message: 'PO email sent successfully via Gmail',
      po_number: po.po_number,
      sent_to: po.supplier_email,
      message_id: result.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});