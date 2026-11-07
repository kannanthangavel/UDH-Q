const app = require('./app');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  UD-QM (Udhayam Agencies Quotation Management)`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Paint Division Quotation Engine Ready`);
  console.log(`====================================================`);
});
