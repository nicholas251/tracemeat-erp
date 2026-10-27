// Code 39 barcode (n = narrow, w = wide; alternating bar/space, 9 elements per char)
const CODE39 = {
  "0":"nnnwwnwnn","1":"wnnwnnnnw","2":"nnwwnnnnw","3":"wnwwnnnnn","4":"nnnwwnnnw","5":"wnnwwnnnn",
  "6":"nnwwwnnnn","7":"nnnwnnwnw","8":"wnnwnnwnn","9":"nnwwnnwnn","A":"wnnnnwnnw","B":"nnwnnwnnw",
  "C":"wnwnnwnnn","D":"nnnnwwnnw","E":"wnnnwwnnn","F":"nnwnwwnnn","G":"nnnnnwwnw","H":"wnnnnwwnn",
  "I":"nnwnnwwnn","J":"nnnnwwwnn","K":"wnnnnnnww","L":"nnwnnnnww","M":"wnwnnnnwn","N":"nnnnwnnww",
  "O":"wnnnwnnwn","P":"nnwnwnnwn","Q":"nnnnnnwww","R":"wnnnnnwwn","S":"nnwnnnwwn","T":"nnnnwnwwn",
  "U":"wwnnnnnnw","V":"nwwnnnnnw","W":"wwwnnnnnn","X":"nwnnwnnnw","Y":"wwnnwnnnn","Z":"nwwnwnnnn",
  "-":"nwnnnnwnw",".":"wwnnnnwnn"," ":"nwwnnnwnn","*":"nwnnwnwnn",
};

export function code39Svg(value, height = 80) {
  const text = `*${value.toUpperCase()}*`;
  const n = 2, w = 5;
  let x = 10, bars = "";
  for (const ch of text) {
    const pat = CODE39[ch] || CODE39["-"];
    [...pat].forEach((p, i) => {
      const width = p === "w" ? w : n;
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${width}" height="${height}"/>`;
      x += width;
    });
    x += n;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="${height}" viewBox="0 0 ${x + 10} ${height}">${bars}</svg>`;
}

export function printPalletLabel(pallet) {
  const rows = (pallet.lots || []).map(l =>
    `<tr><td>${l.product_name || ""}</td><td>${l.lot_number || ""}</td><td>${l.cases ?? ""}</td><td>${l.lbs ?? ""}</td><td>${l.expiry_date || ""}</td></tr>`).join("");
  const totalCases = (pallet.lots || []).reduce((s, l) => s + (l.cases || 0), 0);
  const win = window.open("", "_blank", "width=600,height=700");
  win.document.write(`<html><head><title>${pallet.pallet_number}</title><style>
    body{font-family:Arial,sans-serif;padding:16px} h1{margin:0;font-size:28px} .loc{font-size:20px;margin:6px 0 12px}
    .bc{text-align:center;margin:12px 0} .bc div{font-family:monospace;font-size:16px;letter-spacing:2px}
    table{width:100%;border-collapse:collapse;font-size:13px} td,th{border:1px solid #000;padding:4px;text-align:left}
  </style></head><body>
    <h1>PALLET ${pallet.pallet_number}</h1>
    <div class="loc">${pallet.building_name || ""} · Spot ${pallet.location || ""}</div>
    <div class="bc">${code39Svg(pallet.pallet_number)}<div>${pallet.pallet_number}</div></div>
    <table><tr><th>Product</th><th>Lot</th><th>Cases</th><th>Lbs</th><th>Expiry</th></tr>${rows}</table>
    <p><b>Total cases:</b> ${totalCases} &nbsp; <b>Stored:</b> ${new Date(pallet.stored_at || Date.now()).toLocaleString()}</p>
    <script>window.onload=()=>{window.print();}</script>
  </body></html>`);
  win.document.close();
}