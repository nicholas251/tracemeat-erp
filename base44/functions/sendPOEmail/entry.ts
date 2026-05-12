import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@3.2.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

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

    // Send email using Resend
    const result = await resend.emails.send({
      from: `Purchase Order System <noreply@resend.dev>`,
      to: po.supplier_email,
      subject: `Purchase Order ${po.po_number}`,
      text: emailBody,
    });

    if (result.error) {
      return Response.json({ error: result.error.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: 'PO email sent successfully',
      po_number: po.po_number,
      sent_to: po.supplier_email,
      email_id: result.data?.id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});