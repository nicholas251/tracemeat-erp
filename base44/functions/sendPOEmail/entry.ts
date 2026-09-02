import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { jsPDF } from 'npm:jspdf@4.2.1';
import { createMimeMessage } from 'npm:mimetext@3.0.24';

const bytesToBase64 = (bytes) => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

const isValidEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export default async function(req) {
  let base44 = null;
  let poId = null;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let po = body.po;
    const logoUrl = body.logoUrl;

    // Prefer the live record when an id is supplied (resend path / stale client copies).
    if (po?.id) {
      poId = po.id;
      const live = await base44.asServiceRole.entities.PurchaseOrder.filter({ id: po.id }).then(r => r?.[0]);
      if (live) po = live;
    }

    if (!po || !po.po_number) {
      return Response.json({ error: 'Missing purchase order data' }, { status: 400 });
    }
    const supplierEmail = (po.supplier_email || '').trim();
    if (!isValidEmail(supplierEmail)) {
      const msg = supplierEmail
        ? `Supplier email "${supplierEmail}" is not a valid address`
        : 'This PO has no supplier email — add one and resend';
      if (poId) await base44.asServiceRole.entities.PurchaseOrder.update(poId, { email_error: msg });
      return Response.json({ error: msg }, { status: 400 });
    }

    // ── Generate PDF ─────────────────────────────────────────────────────────
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    doc.setFillColor(220, 53, 69);
    doc.rect(0, yPos - 5, pageWidth - 70, 20, 'F');

    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBytes = new Uint8Array(await logoResponse.arrayBuffer());
          doc.addImage(`data:image/png;base64,${bytesToBase64(logoBytes)}`, 'PNG', pageWidth - 55, yPos - 2, 40, 18);
        }
      } catch (_e) {
        // Logo is decorative — never block the PO on it.
      }
    }

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text("MITTY'S FOODS", 15, yPos + 8);
    yPos += 25;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Quality Meat Products | sales@mittysfood.com', 15, yPos);
    yPos += 10;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, yPos, pageWidth - 30, 20);
    doc.setFont(undefined, 'bold');
    doc.text('PO Number:', 20, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(String(po.po_number), 50, yPos + 5);
    doc.setFont(undefined, 'bold');
    doc.text('Order Date:', 120, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(po.order_date || 'N/A', 150, yPos + 5);
    doc.setFont(undefined, 'bold');
    doc.text('Expected Delivery:', 20, yPos + 12);
    doc.setFont(undefined, 'normal');
    doc.text(po.expected_delivery_date || 'N/A', 50, yPos + 12);
    yPos += 25;

    const colX1 = 15;
    const colX2 = pageWidth / 2 + 5;
    const colWidth = pageWidth / 2 - 15;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('FROM:', colX1, yPos);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Email: sales@mittysfood.com', colX1, yPos);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('SHIP-TO:', colX2, yPos - 7);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (po.ship_to_contact_name) {
      doc.text(`Attn: ${po.ship_to_contact_name}`, colX2, yPos - 7);
    }

    yPos += 8;
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('SUPPLIER:', colX1, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    const supplierLines = doc.splitTextToSize(po.supplier || '', colWidth - 2);
    doc.text(supplierLines, colX1, yPos);

    const maxAddressLines = Math.max(supplierLines.length, 2);
    let addressY = yPos;
    if (po.ship_to_address) {
      const addressLines = doc.splitTextToSize(po.ship_to_address, colWidth - 2);
      doc.text(addressLines, colX2, addressY);
      addressY += addressLines.length * 4;
    }
    if (po.ship_to_contact_phone) {
      doc.text(`Phone: ${po.ship_to_contact_phone}`, colX2, addressY + 4);
    }
    yPos += maxAddressLines * 4 + 10;

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setFillColor(41, 128, 185);
    doc.setTextColor(255, 255, 255);
    const colWidths = [70, 35, 30, 30, 30];
    const headers = ['Item', 'Category', 'Qty (lbs)', 'Unit Price', 'Total'];
    let xPos = 15;
    const headerY = yPos;
    const rowHeight = 8;
    headers.forEach((header, idx) => {
      doc.rect(xPos, headerY, colWidths[idx], rowHeight, 'F');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text(header, xPos + 2, headerY + 5.5, { align: 'left' });
      xPos += colWidths[idx];
    });

    yPos = headerY + rowHeight;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    let rowCount = 0;
    (po.line_items || []).forEach(item => {
      const qty = Number(item.quantity_lbs) || 0;
      const price = Number(item.unit_price) || 0;
      const total = qty * price;
      if (rowCount % 2 === 1) {
        doc.setFillColor(240, 245, 250);
        doc.rect(15, yPos, pageWidth - 30, rowHeight, 'F');
      }
      const row = [item.material_name || '', item.category || '', qty.toFixed(2), `$${price.toFixed(2)}`, `$${total.toFixed(2)}`];
      xPos = 15;
      row.forEach((cell, idx) => {
        const align = idx > 1 ? 'right' : 'left';
        const cellX = align === 'right' ? xPos + colWidths[idx] - 2 : xPos + 2;
        doc.text(cell, cellX, yPos + 5.5, { align });
        xPos += colWidths[idx];
      });
      yPos += rowHeight;
      rowCount++;
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 15;
        rowCount = 0;
      }
    });

    yPos += 2;
    doc.setFillColor(41, 128, 185);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`TOTAL: $${(Number(po.total_amount) || 0).toFixed(2)}`, pageWidth - 20, yPos + 6.5, { align: 'right' });
    yPos += 12;
    doc.setTextColor(0, 0, 0);

    if (po.notes) {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Notes:', 15, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(po.notes, pageWidth - 30);
      doc.text(notesLines, 15, yPos);
    }

    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an automated purchase order. Please confirm receipt and delivery terms.', pageWidth / 2, pageHeight - 15, { align: 'center' });

    const pdfBase64 = bytesToBase64(new Uint8Array(doc.output('arraybuffer')));

    // ── Email body ───────────────────────────────────────────────────────────
    const lineItemsText = (po.line_items || [])
      .map(item => {
        const qty = Number(item.quantity_lbs) || 0;
        const price = Number(item.unit_price) || 0;
        return `${item.material_name || ''} - ${qty} lbs @ $${price.toFixed(2)}/lb = $${(qty * price).toFixed(2)}`;
      })
      .join('\n');

    const shipTo = [po.ship_to_contact_name, po.ship_to_address, po.ship_to_contact_phone ? `Phone: ${po.ship_to_contact_phone}` : '']
      .filter(Boolean).join('\n');

    const emailBody = [
      'Hello,',
      '',
      'We have created a new Purchase Order for you. Please find the details below:',
      '',
      `PO NUMBER: ${po.po_number}`,
      `ORDER DATE: ${po.order_date || 'N/A'}`,
      `EXPECTED DELIVERY: ${po.expected_delivery_date || 'N/A'}`,
      '',
      shipTo ? `SHIP-TO:\n${shipTo}\n` : '',
      'LINE ITEMS:',
      lineItemsText,
      '',
      `TOTAL AMOUNT: $${(Number(po.total_amount) || 0).toFixed(2)}`,
      '',
      po.notes ? `NOTES:\n${po.notes}\n` : '',
      'Please see the attached PDF for the complete purchase order details.',
      '',
      'Best regards,',
      "Mitty's Foods Purchasing",
    ].join('\n');

    // ── Send via Gmail ───────────────────────────────────────────────────────
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    if (!accessToken) {
      throw new Error('Gmail is not connected — reconnect the Gmail account in the app settings.');
    }

    const msg = createMimeMessage();
    msg.setSender({ name: "Mitty's Foods", addr: user.email });
    msg.setRecipient(supplierEmail);
    msg.setSubject(`Purchase Order ${po.po_number}`);
    msg.addMessage({ contentType: 'text/plain', data: emailBody });
    msg.addAttachment({
      filename: `PO-${po.po_number}.pdf`,
      contentType: 'application/pdf',
      data: pdfBase64,
    });

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: msg.asEncoded() }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `Gmail rejected the message (HTTP ${response.status})`);
    }
    const result = await response.json();

    if (poId) {
      await base44.asServiceRole.entities.PurchaseOrder.update(poId, {
        email_sent_at: new Date().toISOString(),
        email_sent_to: supplierEmail,
        email_error: '',
      });
    }

    return Response.json({ success: true, po_number: po.po_number, sent_to: supplierEmail, message_id: result.id });
  } catch (error) {
    if (base44 && poId) {
      try {
        await base44.asServiceRole.entities.PurchaseOrder.update(poId, { email_error: error.message });
      } catch (_e) { /* best effort */ }
    }
    return Response.json({ error: error.message }, { status: 500 });
  }
}