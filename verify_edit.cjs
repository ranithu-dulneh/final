const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
     args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  // Base URL
  const BASE_URL = 'http://localhost:5173';

  try {
    // 1. Visit Inventory and Add Product
    console.log('Navigating to Inventory...');
    await page.goto(`${BASE_URL}/`);
    await page.click('text=Inventory');

    // Enter PIN
    await page.fill('input[type="password"]', '1234');
    await page.click('button:has-text("Enter")');

    console.log('Adding Product with Variants...');
    await page.fill('input[name="name"]', 'Test Soap');
    await page.fill('input[name="category"]', 'Hygiene');

    // Variant 1: Small
    await page.fill('input[name="name"] >> nth=1', 'Small');
    await page.fill('input[name="sku"]', 'SOAP-S');
    await page.fill('input[name="cost_price"]', '50');
    await page.fill('input[name="selling_price"]', '100');
    await page.fill('input[name="stock"]', '10');
    await page.fill('input[name="max_discount"]', '10');
    await page.click('button:has-text("Add Variant")');

    await page.click('button:has-text("Save Product")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/jules/verification/after_add.png' });

    // 2. Edit the Product
    console.log('Editing Product...');
    await page.click('text=Edit');
    await page.fill('input[name="name"]', 'Test Soap Updated');

    // Add new variant in Edit mode
    await page.fill('input[name="name"] >> nth=1', 'Medium');
    await page.fill('input[name="sku"]', 'SOAP-M');
    await page.fill('input[name="cost_price"]', '75');
    await page.fill('input[name="selling_price"]', '150');
    await page.fill('input[name="stock"]', '8');
    await page.fill('input[name="max_discount"]', '5');
    await page.click('button:has-text("Add Variant")');

    await page.click('button:has-text("Update Product")');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/home/jules/verification/after_edit.png' });

    // 3. Go to Register and Sell Updated Product
    console.log('Navigating to Register...');
    await page.click('text=Register');
    await page.waitForTimeout(2000);

    // Wait for Product
    try {
        await page.waitForSelector('text=Test Soap Updated', { timeout: 10000 });
    } catch (e) {
        console.log("Updated Product not found, taking screenshot");
        await page.screenshot({ path: '/home/jules/verification/product_update_fail.png' });
        throw e;
    }

    await page.click('text=Test Soap Updated');
    await page.screenshot({ path: '/home/jules/verification/modal_open.png' });

    // Close Modal
    await page.click('button:has-text("Cancel")');

    console.log('Success!');

  } catch (err) {
    console.error('Error during verification:', err);
    await page.screenshot({ path: '/home/jules/verification/verification_error.png' });
  } finally {
    await browser.close();
  }
})();
