const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
     args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Base URL
  const BASE_URL = 'http://localhost:5173';

  try {
    // 1. Visit Inventory and Add Category
    console.log('Navigating to Inventory...');
    await page.goto(`${BASE_URL}/`);
    await page.click('text=Inventory');

    // Enter PIN
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("Enter")');

    console.log('Adding Category...');
    // Trigger prompt
    page.on('dialog', async dialog => {
        console.log(`Dialog message: ${dialog.message()}`);
        await dialog.accept('Test Category');
    });

    await page.click('button:has-text("+")');
    await page.waitForTimeout(1000);

    console.log('Adding Product in New Category...');
    await page.fill('input[name="name"]', 'Cat Test Product');
    // Select Category
    await page.selectOption('select[name="category"]', 'Test Category');

    // Variant
    await page.fill('input[name="name"] >> nth=1', 'Standard');
    await page.fill('input[name="sku"]', 'CAT-TEST');
    await page.fill('input[name="cost_price"]', '100');
    await page.fill('input[name="selling_price"]', '200');
    await page.fill('input[name="stock"]', '20');
    await page.fill('input[name="max_discount"]', '0');
    await page.click('button:has-text("Add Variant")');

    await page.click('button:has-text("Save Product")');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/home/jules/verification/after_cat_add.png' });

    // 2. Go to Register and Filter
    console.log('Navigating to Register...');
    await page.click('text=Register');
    await page.waitForTimeout(2000);

    // Check Filter Buttons
    await page.screenshot({ path: '/home/jules/verification/register_filters.png' });

    console.log('Filtering by Test Category...');
    await page.click('button:has-text("Test Category")');
    await page.waitForTimeout(500);

    // Check if product visible
    if (await page.isVisible('text=Cat Test Product')) {
        console.log('Filtered Product Found!');
    } else {
        throw new Error('Filtered Product NOT Found');
    }

    // 3. Perform Sale (Verify Bug Fix)
    console.log('Adding to Cart and Charging...');
    await page.click('text=Cat Test Product');
    await page.click('button:has-text("Add to Cart")');
    await page.click('button:has-text("Charge")');

    await page.waitForSelector('text=Payment Successful', { timeout: 10000 });
    console.log('Payment Successful! Transaction Bug Fixed.');

    await page.screenshot({ path: '/home/jules/verification/success_final.png' });

  } catch (err) {
    console.error('Error during verification:', err);
    await page.screenshot({ path: '/home/jules/verification/verification_error_final.png' });
  } finally {
    await browser.close();
  }
})();
