import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'No file_url provided' }, { status: 400 });

    // Use Base44 ExtractDataFromUploadedFile integration to parse the Excel/CSV
    const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "object",
        properties: {
          customers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                active_status: { type: "string" },
                customer: { type: "string" },
                company: { type: "string" },
                main_phone: { type: "string" },
                main_email: { type: "string" },
                bill_to_1: { type: "string" },
                bill_to_2: { type: "string" },
                bill_to_3: { type: "string" },
                ship_to_1: { type: "string" },
                ship_to_2: { type: "string" },
                ship_to_3: { type: "string" },
                customer_type: { type: "string" },
                terms: { type: "string" },
                rep: { type: "string" }
              }
            }
          }
        }
      }
    });

    if (extracted.status !== 'success' || !extracted.output?.customers?.length) {
      return Response.json({ error: 'Failed to extract data', details: extracted.details }, { status: 400 });
    }

    const rows = extracted.output.customers;
    const customers = [];

    for (const row of rows) {
      const name = row.customer || row.company;
      if (!name || !name.trim()) continue;
      if (name.trim().toLowerCase().includes('beginning balance')) continue;

      const billParts = [row.bill_to_1, row.bill_to_2, row.bill_to_3]
        .filter(p => p && p.trim()).join(', ');

      const shipLine2 = row.ship_to_2 ? row.ship_to_2.trim() : '';
      let city = '', state = '';
      const cityStateLine = row.ship_to_3 || '';
      const csMatch = cityStateLine.match(/^([^,]+),?\s*([A-Z]{2})/i);
      if (csMatch) { city = csMatch[1].trim(); state = csMatch[2].toUpperCase().trim(); }

      customers.push({
        name: name.trim(),
        contact_name: '',
        email: row.main_email || '',
        phone: row.main_phone || '',
        address: shipLine2,
        city,
        state,
        zip: '',
        billing_address: billParts,
        ship_to_name: row.ship_to_1 ? row.ship_to_1.trim() : '',
        customer_type: row.customer_type || '',
        terms: row.terms || '',
        rep: row.rep || '',
        status: (row.active_status || 'Active').toLowerCase() === 'active' ? 'active' : 'inactive',
      });
    }

    if (customers.length === 0) {
      return Response.json({ error: 'No valid customers after filtering', total_extracted: rows.length }, { status: 400 });
    }

    let created = 0;
    for (let i = 0; i < customers.length; i += 50) {
      await base44.asServiceRole.entities.Customer.bulkCreate(customers.slice(i, i + 50));
      created += customers.slice(i, i + 50).length;
    }

    return Response.json({ success: true, imported: created });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});