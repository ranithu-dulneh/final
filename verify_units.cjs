const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
     args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  const BASE_URL = 'http://localhost:5173';

  try {
    // 1. Visit Inventory and Add Product with Kg
    console.log('Navigating to Inventory...');
    await page.goto(`${BASE_URL}/`);
    await page.click('text=Inventory');
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("Enter")');

    console.log('Adding Sugar (Kg)...');
    await page.fill('input[name="name"]', 'Sugar');
    await page.selectOption('select[name="category"]', 'Chemicals'); // Reuse existing category

    // Variant
    await page.fill('input[name="name"] >> nth=1', 'White Sugar');
    await page.fill('input[name="sku"]', 'SUGAR-W');
    await page.fill('input[name="cost_price"]', '100');
    await page.fill('input[name="selling_price"]', '200'); // Rs 200 per Kg
    await page.fill('input[name="stock"]', '10'); // 10 Kg
    await page.selectOption('select[name="measure_unit"]', 'Kg'); // Select Kg
    await page.click('button:has-text("Add Variant")');

    await page.click('button:has-text("Save Product")');
    await page.waitForTimeout(1000);

    // 2. Go to Register and Sell 500g
    console.log('Navigating to Register...');
    await page.click('text=Register');
    await page.waitForTimeout(2000);

    // Select Sugar
    await page.click('text=Sugar');

    // Modal Interaction
    console.log('Entering 500g...');
    await page.fill('input[placeholder="Qty"]', '500');
    await page.selectOption('select:has-text("Kg")', 'g'); // Change Unit to g

    await page.click('button:has-text("Add to Cart")');
    await page.screenshot({ path: '/home/jules/verification/cart_sugar.png' });

    // Check Cart Total
    // 500g = 0.5 Kg. Price = 200 * 0.5 = 100.
    const cartTotal = await page.textContent('div.p-4.border-t >> text=Rs.');
    console.log('Cart Total Display:', cartTotal);
    if (cartTotal.includes('100.00')) {
        console.log('Price calculation correct (Rs 100 for 500g)');
    } else {
        throw new Error('Price calc failed');
    }

    // Checkout
    await page.click('button:has-text("Charge")');
    await page.waitForSelector('text=Payment Successful', { timeout: 10000 });
    console.log('Sale Complete');

  } catch (err) {
    console.error('Error during verification:', err);
    await page.screenshot({ path: '/home/jules/verification/verification_unit_error.png' });
  } finally {
    await browser.close();
  }
})();
