import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { order } = await req.json();
    if (!order) return Response.json({ error: 'Missing order data' }, { status: 400 });

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageW, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('PACKING SLIP', 14, 16);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Order #: ${order.order_number || 'N/A'}`, 14, 27);
    doc.text(`Date: ${order.ship_date || order.order_date || new Date().toLocaleDateString()}`, pageW - 14, 27, { align: 'right' });

    // Customer block
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Ship To:', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(order.customer_name || '', 14, 58);
    if (order.customer_address) doc.text(order.customer_address, 14, 65);
    if (order.customer_city_state) doc.text(order.customer_city_state, 14, 72);
    if (order.customer_phone) doc.text(`Phone: ${order.customer_phone}`, 14, 79);

    // Status / Notes block
    let infoY = 50;
    doc.setFont('helvetica', 'bold');
    doc.text('Order Info:', pageW / 2, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Status: ${order.status || ''}`, pageW / 2, infoY + 8);
    if (order.notes) {
      const lines = doc.splitTextToSize(`Notes: ${order.notes}`, pageW / 2 - 20);
      doc.text(lines, pageW / 2, infoY + 16);
    }

    // Line items table
    let y = 95;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageW - 28, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(50, 50, 50);
    doc.text('Product', 16, y + 5.5);
    doc.text('SKU', 80, y + 5.5);
    doc.text('Cases', 115, y + 5.5);
    doc.text('Lbs/Case', 135, y + 5.5);
    doc.text('Total Lbs', 160, y + 5.5);
    doc.text('Lot(s)', 185, y + 5.5);

    y += 10;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const items = order.line_items || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (y > 260) { doc.addPage(); y = 20; }
      const bg = i % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
      doc.setFillColor(...bg);
      doc.rect(14, y - 2, pageW - 28, 9, 'F');

      doc.text(item.product_name || '', 16, y + 4, { maxWidth: 62 });
      doc.text(item.sku || '', 80, y + 4);
      doc.text(String(item.cases_qty || 0), 115, y + 4);
      doc.text(String(item.case_weight_lbs || ''), 135, y + 4);
      doc.text(String(item.total_lbs?.toFixed(1) || ''), 160, y + 4);

      const lots = (item.fulfilled_lots || []).map(l => l.lot_number || l.batch_number).filter(Boolean).join(', ');
      doc.text(lots || '—', 185, y + 4, { maxWidth: 20 });
      y += 10;
    }

    // Totals
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(14, y, pageW - 14, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    const totalCases = items.reduce((s, i) => s + (i.cases_qty || 0), 0);
    const totalLbs = items.reduce((s, i) => s + (i.total_lbs || 0), 0);
    doc.text(`Total Cases: ${totalCases}`, 115, y);
    doc.text(`Total Lbs: ${totalLbs.toFixed(1)}`, 160, y);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Thank you for your business.', pageW / 2, 285, { align: 'center' });

    const pdfBytes = doc.output('arraybuffer');
    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=packing-slip-${order.order_number || 'order'}.pdf`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});