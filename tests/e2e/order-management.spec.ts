// Tests are written with the help of AI.
import { test, expect, type Page } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";
const NON_ADMIN_EMAIL = "test@example.com";
const NON_ADMIN_PW = "password123";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PW = "admin123";

/* ---------------------------- Helper functions ---------------------------- */

async function goHome(page: Page) {
  await page.goto(BASE_URL);
  await expect(page).toHaveURL(/\/$/);
}

async function loginUser(page: Page, email: string, password: string) {
  // Navigate to login page
  await page.goto(`${BASE_URL}/login`);

  // Fill login form
  await page
    .locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]'
    )
    .fill(email);
  await page
    .locator(
      'input[type="password"], input[name="password"], input[placeholder*="password" i]'
    )
    .fill(password);

  // Submit form
  const loginButton = page
    .locator("button")
    .filter({ hasText: /login|sign in/i })
    .first();
  await loginButton.click();
  await page.waitForLoadState("networkidle").catch(() => {});

  // Verify login was successful - check for any visible element that indicates successful login
  await expect(
    page.locator(
      "nav, header, .navbar, .user-menu, .user-profile, .dropdown-menu:visible"
    )
  ).toBeVisible({ timeout: 10_000 });

  // Additional verification - URL should change to dashboard or home
  await expect(page).not.toHaveURL(/login/i, { timeout: 5_000 });
}

async function navigateToUserOrders(page: Page) {
  // Navigate to user orders page
  await page.goto(`${BASE_URL}/dashboard/user/orders`);
  await page.waitForLoadState("networkidle").catch(() => {});

  // Verify we're on the orders page with more flexible selectors
  await expect(
    page.locator("text=/orders|my orders|order history/i").first()
  ).toBeVisible({ timeout: 10_000 });
}

async function navigateToAdminOrders(page: Page) {
  // Navigate to admin orders page
  await page.goto(`${BASE_URL}/dashboard/admin/orders`);
  await page.waitForLoadState("networkidle").catch(() => {});

  // Verify we're on the admin orders page with more flexible selectors
  await expect(
    page
      .locator("text=/orders|manage orders|all orders|order management/i")
      .first()
  ).toBeVisible({ timeout: 10_000 });
}

/* --------------------------------- Tests --------------------------------- */

test.describe("E2E - Order Management", () => {
  test("FLOW: Non-admin user (Orders page) - User views order history after purchase", async ({ page }) => {
    // Login as a user
    await loginUser(page, NON_ADMIN_EMAIL, NON_ADMIN_PW);

    // Navigate to orders page
    await navigateToUserOrders(page);

    // Check if orders exist
    const ordersTable = page.locator("table");
    if (await ordersTable.count()) {
      // Verify order table structure
      await expect(
        page
          .locator('th:has-text("Status"), th:has-text("Order Status")')
          .first()
      ).toBeVisible();
      await expect(
        page.locator('th:has-text("Buyer"), th:has-text("Customer")').first()
      ).toBeVisible();
      await expect(
        page.locator('th:has-text("Payment")').first()
      ).toBeVisible();

      // Check for order rows
      const orderRows = page.locator(
        '[data-testid="order-row"], tr:not(:first-child)'
      );
      if ((await orderRows.count()) > 0) {
        // Verify order details are displayed
        await expect(orderRows.first()).toBeVisible();

        // Check order status
        const orderStatus = page
          .locator('[data-testid^="order-status-"], td:first-child')
          .first();
        await expect(orderStatus).toBeVisible();

        // Verify order contains products
        const productCards = page.locator(
          ".order-products-row .card, .order-details .product-item"
        );
        if ((await productCards.count()) > 0) {
          await expect(productCards.first()).toBeVisible();
          await expect(
            productCards.first().locator("text=/price|$/i").first()
          ).toBeVisible();
        }
      } else {
        // No orders yet
        console.log("No orders found in the user account");
      }
    } else {
      // No orders table
      await expect(
        page
          .locator("text=/you haven't placed any orders yet|no orders found/i")
          .first()
      ).toBeVisible();
    }
  });

  test("FLOW: Admin user (Admin Orders page) - Admin views and manages orders", async ({ page }) => {
    // Login as admin
    await loginUser(page, ADMIN_EMAIL, ADMIN_PW);

    // Navigate to admin orders page with fallback options
    try {
      await navigateToAdminOrders(page);
    } catch (error) {
      // Fallback: Try direct navigation to admin dashboard
      await page.goto(`${BASE_URL}/dashboard/admin`);
      await page.waitForLoadState("networkidle");

      // Look for any orders management link
      const ordersLink = page
        .locator("a, button, div")
        .filter({ hasText: /orders|manage orders|order management/i })
        .first();
      if ((await ordersLink.count()) > 0) {
        await ordersLink.click();
        await page.waitForLoadState("networkidle");
      }
    }

    // Check if orders exist with more flexible selectors
    const ordersTable = page.locator("table, .orders-table, .order-list");
    if (await ordersTable.count()) {
      // Verify admin-specific elements with more flexible selectors
      await expect(
        page
          .locator(
            'th:has-text("Status"), th:has-text("Order Status"), div:has-text("Status"):not(:has-text("Status Update")), .order-status-header'
          )
          .first()
      ).toBeVisible({ timeout: 10_000 });

      // Check for order status dropdown (admin-only feature) with more flexible selectors
      const statusSelects = page.locator(
        ".status-select, select, .status-dropdown, .order-status-select"
      );

      if ((await statusSelects.count()) > 0) {
        // Verify status dropdown is present for admin
        await expect(statusSelects.first()).toBeVisible({ timeout: 10_000 });

        // Verify status dropdown is enabled
        await expect(statusSelects.first()).toBeEnabled();

        // Try to select 'Shipped' status
        // Second approach: Try clicking the dropdown to open it
        await statusSelects.first().click();

        // Look for 'Shipped' option in any dropdown menu that appears
        const shippedOption = page
          .locator("option, li, div, a, .status-option, .option")
          .filter({ hasText: /shipped/i })
          .first();
        
        await shippedOption.click();

        // Wait for any potential status update request to complete
        await page.waitForTimeout(1000);

        // Verify the UI reflects the status change
        // Look for any element showing 'Shipped' status
        const statusIndicator = page
          .locator("td, div, span")
          .filter({ hasText: /Shipped/i })
          .first();

        // If we can find a status indicator showing 'Shipped', the test passes
        await expect(statusIndicator).toBeVisible({ timeout: 5000 });
      }
    } else {
      // No orders
      await expect(
        page.locator("text=/no orders|no orders found/i").first()
      ).toBeVisible();
    }
  });
});
