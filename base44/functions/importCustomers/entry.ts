import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'No file_url provided' }, { status: 400 });

    // Extract raw rows from the file - use a generic array schema so the LLM reads all columns
    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          rows: {
            type: "array",
            description: "All rows from the spreadsheet as-is",
            items: {
              type: "object",
              description: "One row with all columns as key-value pairs. Use the exact column header as the key."
            }
          }
        }
      }
    });

    if (extracted.status !== 'success') {
      return Response.json({ error: 'Failed to extract data', details: extracted.details }, { status: 400 });
    }

    const rows = extracted.output?.rows || extracted.output;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return Response.json({ error: 'No rows found in file', raw: JSON.stringify(extracted.output).slice(0, 500) }, { status: 400 });
    }

    // Normalize column names: lowercase + trim + collapse spaces/underscores
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-]+/g, '_').trim();

    // Find column key in a row object by fuzzy matching
    const findCol = (row, candidates) => {
      const keys = Object.keys(row);
      for (const candidate of candidates) {
        const match = keys.find(k => norm(k) === norm(candidate));
        if (match) return row[match] || '';
      }
      return '';
    };

    const customers = [];

    for (const row of rows) {
      const name = findCol(row, ['customer', 'company', 'customer_name', 'name']) ||
                   findCol(row, ['bill_to_1', 'bill_to']);
      if (!name || !name.toString().trim()) continue;
      const nameStr = name.toString().trim();
      if (nameStr.toLowerCase().includes('beginning balance')) continue;
      if (nameStr.toLowerCase() === 'customer' || nameStr.toLowerCase() === 'name') continue; // skip header row if returned

      const billTo1 = findCol(row, ['bill_to_1', 'bill_to']);
      const billTo2 = findCol(row, ['bill_to_2']);
      const billTo3 = findCol(row, ['bill_to_3']);
      const billParts = [billTo1, billTo2, billTo3].map(p => String(p).trim()).filter(Boolean).join('\n');

      const shipTo1 = findCol(row, ['ship_to_1', 'ship_to']);
      const shipTo2 = findCol(row, ['ship_to_2']);
      const shipTo3 = findCol(row, ['ship_to_3']);

      let city = '', state = '', zip = '';
      const cityStateLine = String(shipTo3 || billTo3 || '');
      const csMatch = cityStateLine.match(/^([^,]+),?\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/i);
      if (csMatch) {
        city = csMatch[1].trim();
        state = csMatch[2].toUpperCase();
        zip = csMatch[3] ? csMatch[3].trim() : '';
      }

      const activeStatus = findCol(row, ['active_status', 'status', 'active']);
      const isActive = !activeStatus || activeStatus.toString().toLowerCase() !== 'inactive';

      customers.push({
        name: nameStr,
        contact_name: '',
        email: findCol(row, ['main_email', 'email']),
        phone: findCol(row, ['main_phone', 'phone']),
        address: String(shipTo2 || '').trim(),
        city,
        state,
        zip,
        billing_address: billParts,
        ship_to_name: String(shipTo1).trim(),
        customer_type: findCol(row, ['customer_type', 'type']),
        terms: findCol(row, ['terms', 'payment_terms']),
        rep: findCol(row, ['rep', 'sales_rep', 'salesperson']),
        status: isActive ? 'active' : 'inactive',
      });
    }

    if (customers.length === 0) {
      return Response.json({
        error: 'No valid customers found. Check your file format.',
        sample_keys: rows[0] ? Object.keys(rows[0]) : [],
        total_rows: rows.length
      }, { status: 400 });
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