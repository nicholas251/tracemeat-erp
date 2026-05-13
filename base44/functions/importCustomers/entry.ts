import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'No file_url provided' }, { status: 400 });

    // Fetch the file
    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Failed to download file' }, { status: 400 });
    const buffer = await fileRes.arrayBuffer();

    // Parse with xlsx
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

    // Find the sheet with actual data (skip sheets that are all empty)
    let rows = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (data.length > 0) {
        rows = data;
        break;
      }
    }

    if (rows.length === 0) {
      return Response.json({ error: 'No data rows found in any sheet', sheets: workbook.SheetNames }, { status: 400 });
    }

    // Normalize column names for matching
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-\/]+/g, '_').trim();
    const findCol = (row, candidates) => {
      const keys = Object.keys(row);
      for (const candidate of candidates) {
        const match = keys.find(k => norm(k) === norm(candidate));
        if (match !== undefined) return String(row[match] || '').trim();
      }
      return '';
    };

    const customers = [];
    for (const row of rows) {
      const name = findCol(row, ['customer', 'company', 'customer_name', 'name']);
      if (!name) continue;
      if (name.toLowerCase().includes('beginning balance')) continue;

      const billTo1 = findCol(row, ['bill_to_1', 'bill_to']);
      const billTo2 = findCol(row, ['bill_to_2']);
      const billTo3 = findCol(row, ['bill_to_3']);
      const billParts = [billTo1, billTo2, billTo3].filter(Boolean).join('\n');

      const shipTo1 = findCol(row, ['ship_to_1', 'ship_to']);
      const shipTo2 = findCol(row, ['ship_to_2']);
      const shipTo3 = findCol(row, ['ship_to_3']);
      const shipTo4 = findCol(row, ['ship_to_4']);
      const shipTo5 = findCol(row, ['ship_to_5']);

      // Parse city/state/zip — try shipTo3 (city), shipTo4 (state), shipTo5 (zip)
      // OR parse from a single "City, ST ZIP" line
      let city = '', state = '', zip = '';
      if (shipTo4 && /^[A-Z]{2}$/i.test(shipTo4.trim())) {
        // Separate columns: shipTo3=city, shipTo4=state, shipTo5=zip
        city = shipTo3.trim();
        state = shipTo4.trim().toUpperCase();
        zip = shipTo5.trim();
      } else {
        // Try parsing "City, ST ZIP" from shipTo3
        const cityStateLine = shipTo3 || billTo3 || '';
        const csMatch = cityStateLine.match(/^([^,]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
        if (csMatch) {
          city = csMatch[1].trim();
          state = csMatch[2].toUpperCase();
          zip = csMatch[3] ? csMatch[3].trim() : '';
        } else if (cityStateLine) {
          city = cityStateLine;
        }
      }

      const activeStatus = findCol(row, ['active_status', 'status', 'active']);
      const isActive = !activeStatus || activeStatus.toLowerCase() !== 'inactive';

      customers.push({
        name,
        contact_name: '',
        email: findCol(row, ['main_email', 'email']),
        phone: findCol(row, ['main_phone', 'phone']),
        address: shipTo2 || billTo2,
        city,
        state,
        zip,
        billing_address: billParts,
        ship_to_name: shipTo1,
        customer_type: findCol(row, ['customer_type', 'type']),
        terms: findCol(row, ['terms', 'payment_terms']),
        rep: findCol(row, ['rep', 'sales_rep', 'salesperson']),
        status: isActive ? 'active' : 'inactive',
      });
    }

    if (customers.length === 0) {
      const sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
      return Response.json({ error: 'No valid customers found', sample_keys: sampleKeys, total_rows: rows.length }, { status: 400 });
    }

    let created = 0;
    for (let i = 0; i < customers.length; i += 50) {
      const batch = customers.slice(i, i + 50);
      await base44.asServiceRole.entities.Customer.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({ success: true, imported: created });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});