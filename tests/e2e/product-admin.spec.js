// written with the help of AI

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

/* ---------------------------- Helper functions ---------------------------- */

// Login as Admin user
async function loginUser(page, user) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByRole('textbox', { name: 'Enter Your Email' }).click();
  await page.getByRole('textbox', { name: 'Enter Your Email' }).fill(user.email);
  await page.getByRole('textbox', { name: 'Enter Your Password' }).click();
  await page.getByRole('textbox', { name: 'Enter Your Password' }).fill(user.password);
  await page.getByRole('button', { name: 'LOGIN' }).click();
}

async function loginAdmin(page) {
  return loginUser(page, {email: "testdh@gmail.com", password: "tttttt"})
}

async function loginNonAdmin(page) {
  return loginUser(page, {email: "normal@gmail.com", password: "nnnnnn"})
}

// Go to Create Product Page
async function goToCreateProduct(page) {
  await page.getByRole('button', { name: 'test' }).click();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'Create Product' }).click();
}

async function fillProductDetails(page, productData) {
  await page.locator('div').filter({ hasText: /^Select a category$/ }).first().click();
  await page.getByText(productData.category).nth(1).click(); // dynamically select the category from productData

  // Fill in the Product Name
  await page.getByRole('textbox', { name: 'write a name' }).click();
  await page.getByRole('textbox', { name: 'write a name' }).fill(productData.name);

  // Fill in the Product Description
  await page.getByRole('textbox', { name: 'write a description' }).click();
  await page.getByRole('textbox', { name: 'write a description' }).fill(productData.description);

  // Fill in the Price
  await page.getByPlaceholder('write a Price').click();
  await page.getByPlaceholder('write a Price').fill(productData.price);

  // Fill in the Quantity
  await page.getByPlaceholder('write a quantity').click();
  await page.getByPlaceholder('write a quantity').fill(productData.quantity);

  // Select the Shipping Option
  await page.locator('.mb-3 > .ant-select').click();
  await page.getByText(productData.shipping).click(); // dynamically select the shipping option (e.g., "Yes" or "No")
}

// Function to delete a product in the admin dashboard
async function deleteProduct(page, productName) {
  // Navigate to the Products page
  await page.getByRole('button', { name: 'test' }).click();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'Products' }).click();

  // Find the product by name and click on it
  const productLink = page.getByRole('link', { name: productName });
  await productLink.click();

  // Click the delete button for the product
  page.once('dialog', async dialog => {
    await page.waitForTimeout(1000)
    console.log(`Dialog message: ${dialog.message()}`);
    await dialog.accept('yes'); // Accept (click) the dialog to confirm
  });

  await page.getByRole('button', { name: 'DELETE PRODUCT' }).click(); 

  // Optionally, you can add checks here to verify the product was deleted
  // E.g., check if the product is no longer in the list
  await expect(page.locator(`text=${productName}`)).not.toBeVisible();
}

async function goToProductDashboard(page) {
  await page.locator('body').click();
  await page.getByRole('button', { name: 'test' }).click();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('link', { name: 'Products' }).click();
}

async function checkProduct(page, expectedProductData) {
  // Assert that the product name is prefilled
  await expect(page.getByRole('textbox', { name: 'write a name' })).toHaveValue(expectedProductData.name);

  // Assert that the product description is prefilled
  await expect(page.getByRole('textbox', { name: 'write a description' })).toHaveValue(expectedProductData.description);

  // Assert that the price is prefilled
  await expect(page.getByPlaceholder('write a Price')).toHaveValue(expectedProductData.price);

  // Assert that the quantity is prefilled
  await expect(page.getByPlaceholder('write a quantity')).toHaveValue(expectedProductData.quantity);

  // Assert that the category and shipping are selected, and both are visible in their respective elements
  const selectedElements = await page.locator('.ant-select-selection-item').allTextContents();
  
  // Ensure both category and shipping are selected from the options
  const { category, shipping } = expectedProductData;

  const selectedText = selectedElements.map(text => text.toLowerCase());
  expect(selectedText).toContain(category.toLowerCase());
  expect(selectedText).toContain(shipping.toLowerCase());
}


async function openProductFromAdminList(page, productNameRx) {
  await goToProductDashboard(page);
  await page.getByRole('link', { name: productNameRx }).click();
}

async function setAntSelectByLabel(page, idx, labelRx) {
  await page.locator(`#rc_select_${idx}`).click();
  await page.getByText(labelRx, { exact: false }).nth(1).click();
}

async function updateFields(page, { name, description, price, quantity, categoryLabel, shippingLabel, photoPath }) {
  if (categoryLabel) await setAntSelectByLabel(page, 0, categoryLabel);
  if (photoPath) {
    const btn = page.getByRole('button', { name: /upload photo/i }).or(page.locator('label:has(input[type="file"])')).first();
    await btn.click().catch(() => {});
    await page.locator('input[type="file"]').setInputFiles(photoPath);
  }
  if (name !== undefined) await page.getByRole('textbox', { name: /write a name/i }).fill(String(name));
  if (description !== undefined) await page.getByRole('textbox', { name: /write a description/i }).fill(String(description));
  if (price !== undefined) await page.getByPlaceholder(/write a price/i).fill(String(price));
  if (quantity !== undefined) await page.getByPlaceholder(/write a quantity/i).fill(String(quantity));
  if (shippingLabel) {
    await page.locator('#rc_select_1').click();
    await page.getByText(shippingLabel, { exact: false }).click();
  }
}

async function clickUpdate(page) {
  await page.getByRole('button', { name: 'UPDATE PRODUCT' }).click();
}
// Submit the Create Product Form
async function submitCreateProduct(page) {
  await page.getByRole('button', { name: 'CREATE PRODUCT' }).click();
}

// Function to check for the error toast and ensure it contains the expected message
async function checkErrorToast(page, expectedMessage) {
  await page.waitForTimeout(1000);
  const toastError = page.locator('div[role="status"][aria-live="polite"]'); 
  
  // Wait for at least one toast to appear (with a timeout)
  const toastCount = await toastError.count();
  await expect(toastCount).toBeGreaterThan(0, 'No toast messages found'); // Ensure at least one toast exists
  
  // Iterate over all toasts to check if one of them contains the expected message
  const toastMessages = await toastError.allTextContents();
  
  // Check if any toast message contains the expected message
  const isMessagePresent = toastMessages.some((msg) => msg.includes(expectedMessage));
  
  // Assert that the expected message is found in at least one of the toast messages
  expect(isMessagePresent).toBeTruthy();
}


async function createProductHelper(page) {
    await goToCreateProduct(page);
    const uniqueName = `Macbook Pro Version ${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;

    const productData = {
      name: uniqueName,
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '199.99',
      quantity: '50',
      category: 'electronics', // Replace with actual category id or slug
      shipping: 'Yes',
      image: 'path/to/your/product-image.jpg', // Provide path to an actual image file
    };

    // Fill in product details and create the product
    await fillProductDetails(page, productData);
    await submitCreateProduct(page);
    return { uniqueName, productData };
}


async function searchForItem(page, searchTerm) {
    await page.getByRole('searchbox', { name: 'Search' }).fill(searchTerm);
    await page.getByRole('button', { name: 'Search' }).click();
}
/* ------------------------------- Tests ---------------------------------- */

test.describe("Non Admin Users should be redirected", () => {
  test('should restrict access for non admin user users', async ({ page }) => {
    await loginNonAdmin(page);

    // Wait for 3 seconds to simulate the delay before redirection
    await page.waitForTimeout(1000); // Wait for 3 seconds
    // Try to access the Create Product page
    await page.goto(`${BASE_URL}/dashboard/admin/create-product`);
      // Verify that the word "redirecting" is visible (this could be a message or text rendered on the page)
    await expect(page.locator('text=redirecting')).toBeVisible();

    // Wait for 3 seconds to simulate the delay before redirection
    await page.waitForTimeout(3000); // Wait for 3 seconds

    // // Verify that the user is redirected to the homepage with the login page
    await expect(page).toHaveURL(`${BASE_URL}/`); // Ensure redirection to homepage
  });


  // Flow 4: Admin user without required permissions tries to access the Create Product page
  test('should restrict access for guest users', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
      // Try to access the Create Product page
    await page.goto(`${BASE_URL}/dashboard/admin/create-product`);

    // Verify that the word "redirecting" is visible (this could be a message or text rendered on the page)
    await expect(page.locator('text=redirecting')).toBeVisible();

    // Wait for 3 seconds to simulate the delay before redirection
    await page.waitForTimeout(3000); // Wait for 3 seconds

    // Verify that the user is redirected to the homepage with the login page
    await expect(page).toHaveURL(`${BASE_URL}/`); // Ensure redirection to homepage
    await expect(page.locator('text=Login')).toBeVisible(); // Ensure login form is visible
  });
});

test.describe("Product Creation", () => {
  test('should allow admin to create a product successfully', async ({ page }) => {
    await loginAdmin(page);
    await goToCreateProduct(page);

    const uniqueName = `Macbook Pro Version ${Date.now()}`; // Unique name using timestamp
    const productData = {
      name: uniqueName,
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '199.99',
      quantity: '50',
      category: 'electronics', // Replace with actual category id or slug
      shipping: 'Yes',
      image: 'path/to/your/product-image.jpg', // Provide path to an actual image file
    };

    // Fill in product details and create the product
    await fillProductDetails(page, productData);
    await submitCreateProduct(page);

    // Check that the product has been created successfully
    await expect(page).toHaveURL(`${BASE_URL}/dashboard/admin/products`);
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible(); // Check if the product is visible by its unique name

    // Verify the product name appears on the homepage
    await page.goto(BASE_URL); // Go to the homepage
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible(); // Verify that the unique product name appears on the homepage
    // Delete the product
    await deleteProduct(page, uniqueName);

    // Ensure the product is no longer in the products list
    await expect(page.locator(`text=${uniqueName}`)).not.toBeVisible();
  });

    // Flow 2: Admin user attempts to create a product with missing required fields
  test('should show error for missing required fields', async ({ page }) => {
    await loginAdmin(page);
    await goToCreateProduct(page);

    const productData = {
      name: '', // Empty name should trigger an error
      description: 'Comfortable Macbook Pro Version',
      price: '199.99',
      quantity: '50',
      category: 'electronics', // Replace with actual category id or slug
      shipping: 'Yes',
      image: 'path/to/your/product-image.jpg',
    };

    await fillProductDetails(page, productData);
    await submitCreateProduct(page);

    await checkErrorToast(page, "something went wrong");
  });

  // Flow 6: Admin user creates a product with invalid price (negative or non-numeric)
  test('should show error for invalid price input', async ({ page }) => {
    await loginAdmin(page);
    await goToCreateProduct(page);

    const productData = {
      name: 'Macbook Pro Version',
      description: 'Comfortable Macbook Pro Version with adjustable features.',
      price: '-199.99', // Invalid price
      quantity: '50',
      category: 'electronics', // Replace with actual category id or slug
      shipping: 'Yes',
      image: 'path/to/your/product-image.jpg',
    };

    await fillProductDetails(page, productData);
    await submitCreateProduct(page);

    await checkErrorToast(page, "something went wrong");
  });
})


// update product flow

let updateProductUniqueName;
let updateProductData;

test.describe('Update Product Admin User', () => {
  test.beforeEach(async ({ page }) => {
    await page.waitForTimeout(1000);
    await loginAdmin(page);
    const { uniqueName, productData } = await createProductHelper(page)
    await goToProductDashboard(page);
    updateProductUniqueName = uniqueName;
    updateProductData = productData;
  });

  test.afterEach(async ({page}) => {
    await deleteProduct(page, updateProductUniqueName);
  })
  test('loads with existing data prefilled', async ({ page }) => {
    await openProductFromAdminList(page, updateProductUniqueName)
    await checkProduct(page, updateProductData)
  });

  test('happy path update name and price', async ({ page }) => {
    await openProductFromAdminList(page, updateProductUniqueName);
    const unique = `Updated ${Date.now()}`;
    const price = '123.45';
    await updateFields(page, { name: unique, price:  price});
    await clickUpdate(page);
    await openProductFromAdminList(page, unique);

    updateProductUniqueName = unique;
    updateProductData.name = unique;
    updateProductData.price = price;
    await checkProduct(page, updateProductData);
  });

  test('validation errors when required fields cleared', async ({ page }) => {
    await openProductFromAdminList(page, updateProductUniqueName);
    await updateFields(page, { name: '', description: '', price: '', quantity: '' });
    await clickUpdate(page);
    await checkErrorToast(page, "something went wrong");
  });

  test('boundary values for price and quantity', async ({ page }) => {
    await openProductFromAdminList(page, updateProductUniqueName);
    await updateFields(page, { price: '-1', quantity: '-5' });
    await clickUpdate(page);
    await checkErrorToast(page, "something went wrong");
    
    await updateFields(page, { price: '0', quantity: '0' });
    await clickUpdate(page);
    await checkErrorToast(page, "something went wrong");
  });
});


let readProductUniqueNames = [];
let readProductDatas = [];

test.describe("Read Product and Delete Product Admin User", () => {
  test.beforeEach(async ({ page }) => {
    readProductUniqueNames = [];
    readProductDatas = [];

    await page.waitForTimeout(1000);

    await loginAdmin(page);

    const { uniqueName: n1, productData: p1 } = await createProductHelper(page);
    readProductUniqueNames.push(n1);
    readProductDatas.push(p1); 

    await page.waitForTimeout(1000)

    const { uniqueName: n2, productData: p2 } = await createProductHelper(page);
    readProductUniqueNames.push(n2);
    readProductDatas.push(p2);
  });

  test('should create 2 products and both should appear on the homepage and delete should remove from the homepage', async ({ page }) => {
    await page.goto(BASE_URL); // Go to the homepage
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage

    await deleteProduct(page, readProductUniqueNames[0]);
    await deleteProduct(page, readProductUniqueNames[1]);

    await page.goto(BASE_URL); // Go to the homepage
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage
  });

  test('should create 2 products and both should be appear on searchPage', async ({ page }) => {
    await searchForItem(page, readProductUniqueNames[0]);
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage

    await searchForItem(page, readProductUniqueNames[1]);
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage

    await deleteProduct(page, readProductUniqueNames[0]);
    await deleteProduct(page, readProductUniqueNames[1]);

    await searchForItem(page, readProductUniqueNames[0]);
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage

    await searchForItem(page, readProductUniqueNames[1]);
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage
  });

  test('should create 2 products and both should be appear on product admin products', async ({ page }) => {
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('link', { name: 'Products' }).click();
    
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).toBeVisible(); // Verify that the unique product name appears on the homepage

    await deleteProduct(page, readProductUniqueNames[0]);
    await deleteProduct(page, readProductUniqueNames[1]);

    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('link', { name: 'Products' }).click();
    
    await expect(page.locator(`text=${readProductUniqueNames[0]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage
    await expect(page.locator(`text=${readProductUniqueNames[1]}`)).not.toBeVisible(); // Verify that the unique product name appears on the homepage
  });

})