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
    let yPos = 15;

    // Company branding header with logo
    doc.setFillColor(220, 53, 69);
    doc.rect(0, yPos - 5, pageWidth, 20, 'F');
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text("MITTY'S FOODS", 15, yPos + 8);
    
    // Try to add logo from public URL
    try {
      doc.addImage('https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/abc6cd33d_MittysFoods_GroteWiegel_MuckesLogos.png', 'PNG', pageWidth - 65, yPos - 3, 50, 25);
    } catch (logoErr) {
      // Silently fail if logo can't be added, header text is sufficient
    }
    
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
    doc.setFillColor(41, 128, 185); // Professional blue
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

    // Generate PDF as bytes
    const pdfBuffer = doc.output('arraybuffer');
    const uint8Array = new Uint8Array(pdfBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PO-${po.po_number}.pdf"`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});