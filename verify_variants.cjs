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
    await page.screenshot({ path: '/home/jules/verification/after_add_product.png' });

    // 2. Go to Register and Sell
    console.log('Navigating to Register...');
    await page.click('text=Register');
    await page.waitForTimeout(2000); // Wait for fetch
    await page.screenshot({ path: '/home/jules/verification/register_screen.png' });

    // Wait for Product
    try {
        await page.waitForSelector('text=Test Soap', { timeout: 5000 });
    } catch (e) {
        console.log("Product not found, taking screenshot");
        await page.screenshot({ path: '/home/jules/verification/product_not_found.png' });
        throw e;
    }

    // Select Product
    await page.click('text=Test Soap');

    // Modal Interaction - Select Small
    console.log('Selecting Variant Small...');
    await page.click('button:has-text("Small")');
    await page.fill('input[type="number"] >> nth=1', '10'); // Discount input
    await page.click('button:has-text("Add to Cart")');

    await page.screenshot({ path: '/home/jules/verification/cart_added.png' });

    // Checkout
    console.log('Checking out...');
    await page.click('button:has-text("Charge")');
    await page.waitForSelector('text=Payment Successful');

    await page.screenshot({ path: '/home/jules/verification/verification_success.png' });
    console.log('Success! Screenshot saved.');

  } catch (err) {
    console.error('Error during verification:', err);
    await page.screenshot({ path: '/home/jules/verification/verification_error.png' });
  } finally {
    await browser.close();
  }
})();
