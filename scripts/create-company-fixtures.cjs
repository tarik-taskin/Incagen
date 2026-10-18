const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const technology = process.argv.includes("--technology");
const enterprise = technology || process.argv.includes("--enterprise");
const root = path.resolve(__dirname, technology ? "../fixtures/company-example/v3" : enterprise ? "../fixtures/company-example/v2" : "../fixtures/company-example/v1");

// Şirket örneğini kararlı tohum/formüllerle üretir; tüm tutarlar kuruş bazında ve bütün veriler kurgusaldır.
function main() {
  const sales = [], budgets = [], operations = [];
  const categories = technology ? ["Kurumsal yazılım", "Veri analitiği", "Teknik danışmanlık", "Eğitim hizmetleri", "Sistem entegrasyonu", "Yönetilen hizmetler", "Siber güvenlik", "Bulut hizmetleri"] : ["Elektronik", "Ev ve yaşam", "Ofis", "Aksesuar", ...(enterprise ? ["Giyim", "Spor", "Kişisel bakım", "Bahçe"] : [])];
  const regions = enterprise ? ["Marmara", "Ege", "İç Anadolu", "Akdeniz"] : ["Marmara", "Anadolu"];
  const channels = technology ? ["Doğrudan satış", "İş ortakları", "Dijital kanal"] : ["Web mağazası", "Pazaryeri", "Mağaza"];
  for (let month = 1; month <= 12; month++) {
    const period = `2025-${String(month).padStart(2, "0")}`;
    let monthlyNet = 0;
    for (let region = 0; region < regions.length; region++) for (let channel = 0; channel < 3; channel++) {
      let ordersTotal = 0;
      for (let category = 0; category < categories.length; category++) for (let segment = 0; segment < 3; segment++) {
        const season = [0.78, 0.81, 0.9, 0.93, 1.02, 1.04, 1.1, 1.06, 1.19, 1.28, 1.63, 1.54][month - 1];
        const units = (technology ? 2 : enterprise ? 8 : 1) * (Math.round((20 + category * 9 + segment * 7) * season * [1.18, 1, 0.86][channel] * [1.18, 0.89, 0.76, 0.68][region]) + (month * 7 + category * 11 + segment * 3) % 9);
        const orders = Math.ceil(units / (1.3 + segment * 0.24));
        const gross = units * [145000, 58000, 36000, 19000, 46000, 71000, 24000, 88000][category] * (technology ? 15 : enterprise ? 3 : 1);
        const discounts = Math.round(gross * (0.025 + channel * 0.012 + (month === 11 ? 0.025 : 0)));
        const refunds = Math.round(gross * (0.011 + (category === 0 ? 0.008 : 0) + region * 0.003));
        const net = gross - discounts - refunds;
        const cost = Math.round(net * [0.69, 0.56, 0.49, 0.43, 0.53, 0.58, 0.46, 0.62][category]);
        const marketing = Math.round(net * [0.07, 0.105, 0.023][channel]);
        const fulfillment = orders * [3400, 4100, 1500][channel] + region * orders * 400;
        monthlyNet += net; ordersTotal += orders;
        sales.push([`ATL-${String(sales.length + 1).padStart(5, "0")}`, period, regions[region], channels[channel], categories[category], (technology ? ["Girişim", "KOBİ", "Kurumsal"] : ["Bireysel", "KOBİ", "Kurumsal"])[segment], orders, units, gross / 100, discounts / 100, refunds / 100, cost / 100, marketing / 100, fulfillment / 100]);
      }
      const onTime = Math.floor(ordersTotal * (0.944 + (month % 4) * 0.007 - channel * 0.009 - region * 0.004));
      operations.push([`OPS-${period}-${region}-${channel}`, period, regions[region], channels[channel], ordersTotal, onTime, ordersTotal - onTime]);
    }
    budgets.push([period, Math.round(monthlyNet / (month >= 10 ? 1.075 : month < 4 ? 0.965 : 1.025)) / 100]);
  }
  const files = [
    { id: "atlas-sales", file: "atlas-satis-2025.csv", columns: ["record_id", "period", "region", "channel", "category", "segment", "orders", "units", "gross_sales_try", "discount_try", "refund_try", "cost_of_goods_try", "marketing_try", "fulfillment_try"], rows: sales },
    { id: "atlas-budget", file: "atlas-butce-2025.csv", columns: ["period", "net_sales_budget_try"], rows: budgets },
    { id: "atlas-operations", file: "atlas-operasyon-2025.csv", columns: ["record_id", "period", "region", "channel", "shipped_orders", "on_time_orders", "late_orders"], rows: operations },
  ];
  // V3 kaynaklarında hizmet şirketine ait özgün alan adları kullanılır; eski şemalar korunur.
  if (technology) {
    const aliases = { orders: "service_orders", units: "billable_units", gross_sales_try: "gross_revenue_try", refund_try: "service_credit_try", cost_of_goods_try: "direct_cost_try", marketing_try: "sales_marketing_try", fulfillment_try: "service_delivery_try", shipped_orders: "completed_services", on_time_orders: "on_time_services", late_orders: "late_services" };
    for (const item of files) item.columns = item.columns.map(key => aliases[key] || key);
  }
  fs.mkdirSync(root, { recursive: true });
  for (const item of files) fs.writeFileSync(path.join(root, item.file), [item.columns, ...item.rows].map(row => row.join(",")).join("\n") + "\n");
  fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ version: technology ? 3 : enterprise ? 2 : 1, synthetic: true, company: technology ? "Atlas Teknoloji" : "Atlas Perakende", year: 2025, files: files.map(item => ({ sourceId: item.id, file: item.file, rows: item.rows.length, sha256: crypto.createHash("sha256").update(fs.readFileSync(path.join(root, item.file))).digest("hex") })) }, null, 2) + "\n");
}
main();
