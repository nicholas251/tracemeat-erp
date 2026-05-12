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

    if (!po || !po.po_number || !po.supplier) {
      return Response.json({ error: 'Missing required PO data' }, { status: 400 });
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('PURCHASE ORDER', pageWidth / 2, yPos, { align: 'center' });

    yPos += 15;

    // PO Details
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`PO #: ${po.po_number}`, 20, yPos);
    doc.text(`Order Date: ${po.order_date || 'N/A'}`, 120, yPos);
    yPos += 7;
    doc.text(`Expected Delivery: ${po.expected_delivery_date || 'N/A'}`, 120, yPos);

    yPos += 15;

    // FROM Section
    doc.setFont(undefined, 'bold');
    doc.text('FROM:', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (po.sender_email) {
      doc.text(`Email: ${po.sender_email}`, 20, yPos);
      yPos += 5;
    }

    yPos += 5;

    // TO Section (Supplier)
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('SUPPLIER:', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.text(po.supplier, 20, yPos);
    yPos += 12;

    // SHIP-TO Section
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.text('SHIP-TO:', 20, yPos);
    yPos += 6;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    if (po.ship_to_contact_name) {
      doc.text(`Attn: ${po.ship_to_contact_name}`, 20, yPos);
      yPos += 5;
    }
    if (po.ship_to_address) {
      const addressLines = doc.splitTextToSize(po.ship_to_address, 80);
      doc.text(addressLines, 20, yPos);
      yPos += addressLines.length * 5 + 2;
    }
    if (po.ship_to_contact_phone) {
      doc.text(`Phone: ${po.ship_to_contact_phone}`, 20, yPos);
      yPos += 5;
    }

    yPos += 5;

    // Line Items Table
    doc.setFont(undefined, 'bold');
    doc.setFontSize(10);
    doc.setFillColor(240, 240, 240);
    
    // Table headers
    const headers = ['Item', 'Category', 'Qty (lbs)', 'Unit Price', 'Total'];
    const colWidths = [70, 35, 30, 30, 30];
    let xPos = 20;

    headers.forEach((header, idx) => {
      doc.rect(xPos, yPos, colWidths[idx], 7, 'F');
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text(header, xPos + 2, yPos + 5, { align: 'left' });
      xPos += colWidths[idx];
    });

    yPos += 8;
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);

    // Line items
    (po.line_items || []).forEach(item => {
      const total = (item.quantity_lbs || 0) * (item.unit_price || 0);
      const row = [
        item.material_name || '',
        item.category || '',
        (item.quantity_lbs || 0).toFixed(2),
        `$${(item.unit_price || 0).toFixed(2)}`,
        `$${total.toFixed(2)}`
      ];

      xPos = 20;
      row.forEach((cell, idx) => {
        const align = idx > 1 ? 'right' : 'left';
        const cellX = align === 'right' ? xPos + colWidths[idx] - 2 : xPos + 2;
        doc.text(cell, cellX, yPos + 4, { align });
        xPos += colWidths[idx];
      });

      doc.line(20, yPos + 6, pageWidth - 20, yPos + 6);
      yPos += 8;

      // Check if we need a new page
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
      }
    });

    yPos += 5;

    // Total
    doc.setFont(undefined, 'bold');
    doc.setFontSize(11);
    xPos = 20;
    headers.forEach((_, idx) => {
      xPos += colWidths[idx];
    });
    doc.text(`Total: $${(po.total_amount || 0).toFixed(2)}`, xPos - 30, yPos, { align: 'right' });

    // Notes
    if (po.notes) {
      yPos += 15;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(10);
      doc.text('Notes:', 20, yPos);
      yPos += 6;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      const notesLines = doc.splitTextToSize(po.notes, pageWidth - 40);
      doc.text(notesLines, 20, yPos);
    }

    // Generate PDF as data URL
    const pdfData = doc.output('dataurlstring');

    // Upload to storage
    const timestamp = new Date().getTime();
    const filename = `PO-${po.po_number}-${timestamp}.pdf`;
    
    const uploadRes = await base44.integrations.Core.UploadFile({
      file: pdfData,
    });

    return Response.json({
      success: true,
      pdf_url: uploadRes.file_url,
      po_number: po.po_number
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});