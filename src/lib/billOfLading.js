import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";

export async function generateBillOfLading(orderId) {
  const order = await base44.entities.SalesOrder.get(orderId);
  const customer = order.customer_id ? await base44.entities.Customer.get(order.customer_id) : null;
  const doc = new jsPDF();
  const items = order.line_items || [];
  let y = 18;

  doc.setFontSize(18).setFont(undefined, "bold").text("BILL OF LADING", 105, y, { align: "center" });
  y += 10;
  doc.setFontSize(10).setFont(undefined, "normal");
  doc.text(`BOL #: BOL-${order.order_number || order.id.slice(-6)}`, 14, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 140, y);
  y += 6;
  doc.text(`Sales Order: ${order.order_number || order.id.slice(-6)}`, 14, y);
  doc.text(`Route: ${order.route || "—"}   Ship Date: ${order.ship_date || order.route_date || "—"}`, 140, y);
  y += 10;

  doc.setFont(undefined, "bold").text("SHIP FROM", 14, y).text("SHIP TO / CONSIGNEE", 110, y);
  doc.setFont(undefined, "normal");
  y += 6;
  doc.text("TraceMeat ERP", 14, y);
  const to = [order.customer_name, ...(customer?.address || "").split("\n"), customer?.phone].filter(Boolean);
  to.forEach((line, i) => doc.text(String(line), 110, y + i * 5));
  y += Math.max(to.length, 1) * 5 + 8;

  doc.setFont(undefined, "bold");
  ["Product", "Lots", "Cases", "Weight (lbs)"].forEach((h, i) => doc.text(h, [14, 85, 150, 172][i], y));
  doc.line(14, y + 2, 196, y + 2);
  doc.setFont(undefined, "normal");
  y += 8;
  let cases = 0, lbs = 0;
  items.forEach((it) => {
    const lots = (it.fulfilled_lots || []).map((l) => l.lot_number || l.batch_number).filter(Boolean).join(", ");
    const lotLines = doc.splitTextToSize(lots || "—", 60);
    doc.text(doc.splitTextToSize(it.product_name || "", 68), 14, y);
    doc.text(lotLines, 85, y);
    doc.text(String(it.cases_qty || 0), 150, y);
    doc.text((it.total_lbs || 0).toFixed(1), 172, y);
    cases += Number(it.cases_qty) || 0;
    lbs += Number(it.total_lbs) || 0;
    y += Math.max(lotLines.length, 1) * 5 + 3;
  });
  doc.line(14, y - 1, 196, y - 1);
  doc.setFont(undefined, "bold").text("TOTAL", 14, y + 4).text(String(cases), 150, y + 4).text(lbs.toFixed(1), 172, y + 4);
  y += 14;

  doc.setFont(undefined, "normal").text("Keep refrigerated / perishable meat products.", 14, y);
  y += 16;
  ["Shipper Signature", "Driver Signature", "Consignee Signature"].forEach((s, i) => {
    const x = 14 + i * 64;
    doc.line(x, y, x + 56, y);
    doc.text(s, x, y + 5);
    doc.text("Date: ________", x, y + 11);
  });

  doc.save(`BOL-${order.order_number || order.id.slice(-6)}.pdf`);
}