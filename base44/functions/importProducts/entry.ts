import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'No file_url provided' }, { status: 400 });

    const fileRes = await fetch(file_url);
    if (!fileRes.ok) return Response.json({ error: 'Failed to download file' }, { status: 400 });
    const buffer = await fileRes.arrayBuffer();

    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });

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
      return Response.json({ error: 'No data rows found in the spreadsheet' }, { status: 400 });
    }

    // Normalize column name for matching
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s_\-\/]+/g, '_').trim();

    const findCol = (row, candidates) => {
      const keys = Object.keys(row);
      for (const candidate of candidates) {
        const match = keys.find(k => norm(k) === norm(candidate));
        if (match !== undefined) return String(row[match] || '').trim();
      }
      return '';
    };

    const products = [];
    for (const row of rows) {
      // Try multiple common column name variants for product code and description
      const productNumber = findCol(row, [
        'product_code', 'product_number', 'item_code', 'item_number',
        'code', 'sku', 'part_number', 'part_no', 'prod_code'
      ]);
      const name = findCol(row, [
        'product_description', 'description', 'item_description',
        'product_name', 'name', 'item_name', 'prod_description'
      ]);

      if (!productNumber && !name) continue;
      if (!productNumber && !name) continue;

      // Use description as the product name, product code as product_number and sku
      const finalName = name || productNumber;
      const finalCode = productNumber || name;

      products.push({
        name: finalName,
        product_number: finalCode,
        sku: finalCode,
        // Leave all other fields empty — user will fill in manually
        category: 'other',
        status: 'draft',
      });
    }

    if (products.length === 0) {
      const sampleKeys = rows[0] ? Object.keys(rows[0]) : [];
      return Response.json({
        error: 'No valid products found. Make sure your spreadsheet has columns for product code and description.',
        sample_columns: sampleKeys,
        total_rows: rows.length,
      }, { status: 400 });
    }

    let created = 0;
    for (let i = 0; i < products.length; i += 50) {
      const batch = products.slice(i, i + 50);
      await base44.asServiceRole.entities.Product.bulkCreate(batch);
      created += batch.length;
    }

    return Response.json({ success: true, imported: created });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});