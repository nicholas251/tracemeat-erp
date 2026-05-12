import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.2.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const po = body.po;
    const logoUrl = body.logoUrl;

    if (!po || !po.supplier_email || !po.po_number) {
      return Response.json({ error: 'Missing required PO data' }, { status: 400 });
    }

    // Generate PDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 15;

    // Company branding header
    doc.setFillColor(220, 53, 69);
    doc.rect(0, yPos - 5, pageWidth - 70, 20, 'F');
    
    // Try to add logo image
    if (logoUrl) {
      try {
        const logoResponse = await fetch(logoUrl);
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoArrayBuffer = await logoBlob.arrayBuffer();
          const logoBase64 = btoa(String.fromCharCode(...new Uint8Array(logoArrayBuffer)));
          doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', pageWidth - 55, yPos - 2, 40, 18);
        }
      } catch (e) {
        // Logo fetch failed, continue without it
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

    // Header - Company info and PO title
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // PO Number and dates in a box
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setDrawColor(200, 200, 200);
    doc.rect(15, yPos, pageWidth - 30, 20);
    
    doc.setFont(undefined, 'bold');
    doc.text('PO Number:', 20, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(po.po_number, 50, yPos + 5);
    
    doc.setFont(undefined, 'bold');
    doc.text('Order Date:', 120, yPos + 5);
    doc.setFont(undefined, 'normal');
    doc.text(po.order_date || 'N/A', 150, yPos + 5);
    
    doc.setFont(undefined, 'bold');
    doc.text('Expected Delivery:', 20, yPos + 12);
    doc.setFont(undefined, 'normal');
    doc.text(po.expected_delivery_date || 'N/A', 50, yPos + 12);

    yPos += 25;

    // Two-column layout: FROM and SHIP-TO
    const colX1 = 15;
    const colX2 = pageWidth / 2 + 5;
    const colWidth = pageWidth / 2 - 15;

    // FROM section
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('FROM:', colX1, yPos);
    yPos += 7;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text('Email: sales@mittysfood.com', colX1, yPos);
    
    // SHIP-TO section
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
    
    // SUPPLIER section (below FROM)
    doc.setFont(undefined, 'bold');
    doc.text('SUPPLIER:', colX1, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    const supplierLines = doc.splitTextToSize(po.supplier, colWidth - 2);
    doc.text(supplierLines, colX1, yPos);
    
    // ADDRESS section (below SHIP-TO)
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

    // Line Items Table with professional styling
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

    // Line items with alternating row colors
    let rowCount = 0;
    (po.line_items || []).forEach(item => {
      const total = (item.quantity_lbs || 0) * (item.unit_price || 0);
      
      // Alternate row background
      if (rowCount % 2 === 1) {
        doc.setFillColor(240, 245, 250);
        doc.rect(15, yPos, pageWidth - 30, rowHeight, 'F');
      }

      const row = [
        item.material_name || '',
        item.category || '',
        (item.quantity_lbs || 0).toFixed(2),
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${total.toFixed(2)}`
      ];

      xPos = 15;
      row.forEach((cell, idx) => {
        const align = idx > 1 ? 'right' : 'left';
        const cellX = align === 'right' ? xPos + colWidths[idx] - 2 : xPos + 2;
        doc.text(cell, cellX, yPos + 5.5, { align });
        xPos += colWidths[idx];
      });

      yPos += rowHeight;
      rowCount++;

      // Check if we need a new page
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 15;
        rowCount = 0;
      }
    });

    // Total section with background
    yPos += 2;
    doc.setFillColor(41, 128, 185);
    doc.rect(15, yPos, pageWidth - 30, 10, 'F');
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.text(`TOTAL: $${(po.total_amount || 0).toFixed(2)}`, pageWidth - 20, yPos + 6.5, { align: 'right' });

    yPos += 12;
    doc.setTextColor(0, 0, 0);

    // Notes section
    if (po.notes) {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Notes:', 15, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);
      const notesLines = doc.splitTextToSize(po.notes, pageWidth - 30);
      doc.text(notesLines, 15, yPos);
      yPos += notesLines.length * 4 + 5;
    }

    // Footer
    yPos = pageHeight - 15;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text('This is an automated purchase order. Please confirm receipt and delivery terms.', pageWidth / 2, yPos, { align: 'center' });

    // Get PDF as base64
    const pdfBuffer = doc.output('arraybuffer');
    const pdfArray = new Uint8Array(pdfBuffer);
    let pdfBase64 = '';
    for (let i = 0; i < pdfArray.length; i++) {
      pdfBase64 += String.fromCharCode(pdfArray[i]);
    }
    pdfBase64 = btoa(pdfBase64);

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

Please see the attached PDF for the complete purchase order details.

Best regards,
Purchase Order System
    `.trim();

    // Get Gmail access token
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Create MIME multipart message with attachment
    const boundary = '----boundary_' + Date.now();
    const message = `From: ${user.email}
To: ${po.supplier_email}
Subject: Purchase Order ${po.po_number}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: 7bit

${emailBody}

--${boundary}
Content-Type: application/pdf; name="PO-${po.po_number}.pdf"
Content-Disposition: attachment; filename="PO-${po.po_number}.pdf"
Content-Transfer-Encoding: base64

${pdfBase64}

--${boundary}--`;

    // Encode message in base64url (Gmail API requirement)
    const encodedMessage = btoa(message)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    // Send via Gmail API using gmail.compose scope
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
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || 'Failed to send email';
      return Response.json({ error: errorMessage }, { status: 500 });
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