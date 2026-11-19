import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";

const LOGO_URL = "https://media.base44.com/images/public/69fa3d25d6b48b9b300a8c3a/b83d65d90_MittysFoods_GroteWiegel_MuckesLogos.webp";

// jsPDF can't read webp, so convert to PNG via canvas
function loadLogoPng() {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = LOGO_URL;
  });
}

// Customer name, ship-to location, street, city/state/zip and phone
function shipToLines(order, customer) {
  const street = customer?.address || "";
  const cityLine = [[customer?.city, customer?.state].filter(Boolean).join(", "), customer?.zip].filter(Boolean).join(" ");
  const cityInStreet = customer?.city && street.toLowerCase().includes(customer.city.toLowerCase());
  const shipToName = (customer?.ship_to_name || "").trim();
  const sameAsName = shipToName.toLowerCase() === (order.customer_name || "").trim().toLowerCase();
  return [order.customer_name, sameAsName ? null : shipToName, ...street.split("\n"), cityInStreet ? null : cityLine, customer?.phone];
}

// yyyy-mm-dd -> mm/dd/yyyy
function mdy(date) {
  const [yyyy, mm, dd] = String(date || "").slice(0, 10).split("-");
  return dd ? `${mm}/${dd}/${yyyy}` : "";
}

export async function generateBillOfLading(orderId, shipFrom) {
  const order = await base44.entities.SalesOrder.get(orderId);
  const customer = order.customer_id ? await base44.entities.Customer.get(order.customer_id) : null;
  const doc = new jsPDF();
  const items = order.line_items || [];
  // Manually entered lots print the lot number that was typed in, not the date-based one
  const lotIds = items.flatMap((it) => (it.fulfilled_lots || []).map((l) => l.inventory_item_id)).filter(Boolean);
  const invItems = lotIds.length ? await base44.entities.InventoryItem.filter({ id: { $in: lotIds } }) : [];
  const manualLot = Object.fromEntries(invItems.filter((i) => i.batch_id === "manual").map((i) => [i.id, i.batch_number]));
  const productIds = [...new Set(items.map((it) => it.product_id).filter(Boolean))];
  const products = productIds.length ? await base44.entities.Product.filter({ id: { $in: productIds } }) : [];
  const productCode = Object.fromEntries(products.map((p) => [p.id, p.product_number]));
  const logo = await loadLogoPng();
  doc.addImage(logo, "PNG", 14, 8, 35, 28);
  let y = 22;

  doc.setFontSize(18).setFont(undefined, "bold").text("BILL OF LADING", 120, y, { align: "center" });
  y += 18;
  doc.setFontSize(10).setFont(undefined, "normal");
  doc.text(`BOL #: BOL-${order.order_number || order.id.slice(-6)}`, 14, y);
  doc.text(`Date: ${mdy(new Date().toLocaleDateString("en-CA"))}`, 140, y);
  y += 6;
  doc.text(`Sales Order: ${order.order_number || order.id.slice(-6)}`, 14, y);
  doc.text(`Route: ${order.route || "—"}   Ship Date: ${mdy(order.ship_date || order.route_date) || "—"}`, 140, y);
  y += 10;

  doc.setFont(undefined, "bold").text("SHIP FROM", 14, y).text("SHIP TO / CONSIGNEE", 110, y);
  doc.setFont(undefined, "normal");
  y += 6;
  const wrap = (lines) => lines.filter(Boolean).flatMap((l) => doc.splitTextToSize(String(l), 86));
  const from = wrap([shipFrom?.name, ...(shipFrom?.address || "").split("\n"), shipFrom?.phone]);
  const to = wrap(shipToLines(order, customer));
  from.forEach((line, i) => doc.text(line, 14, y + i * 5));
  to.forEach((line, i) => doc.text(line, 110, y + i * 5));
  y += Math.max(from.length, to.length, 1) * 5 + 8;

  doc.setFont(undefined, "bold");
  ["Code", "Product", "Lots", "Cases", "Weight (lbs)"].forEach((h, i) => doc.text(h, [14, 36, 92, 150, 172][i], y));
  doc.line(14, y + 2, 196, y + 2);
  doc.setFont(undefined, "normal");
  y += 8;
  let cases = 0, lbs = 0;
  items.forEach((it) => {
    const lots = (it.fulfilled_lots || []).map((l) => manualLot[l.inventory_item_id] || l.lot_number || l.batch_number).filter(Boolean).join(", ");
    const lotLines = doc.splitTextToSize(lots || "—", 54);
    const codeLines = doc.splitTextToSize(productCode[it.product_id] || it.sku || "—", 20);
    const nameLines = doc.splitTextToSize(it.product_name || "", 53);
    doc.text(codeLines, 14, y);
    doc.text(nameLines, 36, y);
    doc.text(lotLines, 92, y);
    doc.text(String(it.cases_qty || 0), 150, y);
    doc.text((it.total_lbs || 0).toFixed(1), 172, y);
    cases += Number(it.cases_qty) || 0;
    lbs += Number(it.total_lbs) || 0;
    y += Math.max(lotLines.length, nameLines.length, codeLines.length) * 5 + 3;
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

  // Truck inspection checklist, bottom right, filled in by hand
  y += 22;
  if (y + 70 > 287) { doc.addPage(); y = 20; }
  const bx = 110;
  doc.rect(bx, y, 86, 70);
  doc.setFont(undefined, "bold").text("TRUCK INSPECTION", bx + 3, y + 6);
  doc.setFont(undefined, "normal");
  ["Date", "Shipper's name", "Truck setpoint", "Truck temperature", "Product temperature"].forEach((label, i) => {
    const ly = y + 13 + i * 6;
    doc.text(`${label}:`, bx + 3, ly);
    doc.line(bx + 5 + doc.getTextWidth(`${label}:`), ly + 0.5, bx + 83, ly + 0.5);
  });
  ["Trailer passes visual inspection?", "Items show signs of damage?", "Evidence of pest activity?", "Any off odor detected?", "Any items rejected?"].forEach((q, i) => {
    const ly = y + 43 + i * 6;
    doc.text(q, bx + 3, ly);
    doc.text("Y / N", bx + 83, ly, { align: "right" });
  });

  doc.save(`BOL-${order.order_number || order.id.slice(-6)}.pdf`);
}