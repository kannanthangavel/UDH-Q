const { db } = require('../db/database');

const query = `
  SELECT id, item_name, sale_rate, section 
  FROM products 
  WHERE is_active = 1 
    AND (item_name LIKE '%2"%' OR item_name LIKE '%2 INCH%')
    AND (item_name LIKE '%BRUSH%' OR item_name LIKE 'BR %' OR item_name LIKE '% BR %')
  LIMIT 20
`;

const res = db.prepare(query).all();
console.log(`Found ${res.length} targeted 2" brush products:`);
res.forEach(p => console.log(`- #${p.id}: ${p.item_name} (₹${p.sale_rate})`));
