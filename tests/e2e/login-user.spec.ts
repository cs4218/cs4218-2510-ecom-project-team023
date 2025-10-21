import { test, expect } from "@playwright/test";

const NON_ADMIN_USERNAME = "TestUserAccount";
const NON_ADMIN_EMAIL = "testuser@user.com";
const NON_ADMIN_PHONE = "123";
const NON_ADMIN_PW = "password";

const ADMIN_USERNAME = "TestAdminAccount";
const ADMIN_EMAIL = "testadmin@admin.com";
const ADMIN_PW = "password";
const ADMIN_PHONE = "123456";

test.describe("User Login + Forgot Password Flows UI tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("FLOW: login with valid non_admin credentials → home page → user profile page → logout", async ({
    page,
  }) => {
    await test.step("Fill login form", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(NON_ADMIN_EMAIL);
      await page.getByPlaceholder("Enter Your Password").fill(NON_ADMIN_PW);
    });

    await test.step("Submit form and verify successful login", async () => {
      await page.getByRole("button", { name: "LOGIN" }).click();

      await expect(page.getByText("login successfully")).toBeVisible();
      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
      ).toBeVisible();

      // Verify localStorage items after login
      const authData = await page.evaluate(() => localStorage.getItem("auth"));
      expect(authData).not.toBeNull();

      const parsed = JSON.parse(authData);
      expect(parsed?.user?.email).toBe(NON_ADMIN_EMAIL);
      expect(parsed?.token).toBeTruthy();
    });

    await test.step("Access user profile page", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/user");
      await expect(
        page.getByRole("heading", {
          name: ` User Name : ${NON_ADMIN_USERNAME}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` User Email : ${NON_ADMIN_EMAIL}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` User Contact : ${NON_ADMIN_PHONE}`,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step("Logout user", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();

      // Verify localStorage cleared after logout
      const cleared = await page.evaluate(() => localStorage.getItem("auth"));
      expect(cleared).toBeNull();
    });
  });

  test("FLOW: login with valid admin credentials → home page → admin profile page → logout", async ({
    page,
  }) => {
    await test.step("Fill login form", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(ADMIN_EMAIL);
      await page.getByPlaceholder("Enter Your Password").fill(ADMIN_PW);
    });

    await test.step("Submit form and verify successful login", async () => {
      await page.getByRole("button", { name: "LOGIN" }).click();

      await expect(page.getByText("login successfully")).toBeVisible();
      await expect(page).toHaveURL("/");
      await expect(
        page.getByRole("button", { name: ADMIN_USERNAME.toUpperCase() })
      ).toBeVisible();

      const authData = await page.evaluate(() => localStorage.getItem("auth"));
      expect(authData).not.toBeNull();

      const parsed = JSON.parse(authData);
      expect(parsed?.user?.email).toBe(ADMIN_EMAIL);
      expect(parsed?.token).toBeTruthy();
    });

    await test.step("Access admin profile page", async () => {
      await page
        .getByRole("button", { name: ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/admin");
      await expect(
        page.getByRole("heading", {
          name: ` Admin Name : ${ADMIN_USERNAME}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` Admin Email : ${ADMIN_EMAIL}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` Admin Contact : ${ADMIN_PHONE}`,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step("Logout admin", async () => {
      await page
        .getByRole("button", { name: ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();

      // ✅ Verify localStorage cleared after logout
      const cleared = await page.evaluate(() => localStorage.getItem("auth"));
      expect(cleared).toBeNull();
    });
  });

  test("FLOW: unable to login with email that is not registered", async ({
    page,
  }) => {
    await page.getByPlaceholder("Enter Your Email").fill("invalid@example.com");
    await page.getByPlaceholder("Enter Your Password").fill("invalidpass");

    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page.getByText("Email is not registered")).toBeVisible();

    // localStorage should remain empty
    const auth = await page.evaluate(() => localStorage.getItem("auth"));
    expect(auth).toBeNull();
  });

  test("FLOW: unable to login with incorrect password", async ({ page }) => {
    await page.getByPlaceholder("Enter Your Email").fill(NON_ADMIN_EMAIL);
    await page.getByPlaceholder("Enter Your Password").fill("wrongpassword");

    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page.getByText("Invalid password")).toBeVisible();

    // localStorage should remain empty
    const auth = await page.evaluate(() => localStorage.getItem("auth"));
    expect(auth).toBeNull();
  });

  test("FLOW: unable to login due to server error", async ({ page }) => {
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Internal Server Error",
        }),
      });
    });

    await page.getByPlaceholder("Enter Your Email").fill(NON_ADMIN_EMAIL);
    await page.getByPlaceholder("Enter Your Password").fill(NON_ADMIN_PW);
    await page.getByRole("button", { name: "LOGIN" }).click();

    await expect(page.getByText("Something went wrong")).toBeVisible();

    // localStorage should remain empty
    const auth = await page.evaluate(() => localStorage.getItem("auth"));
    expect(auth).toBeNull();
  });
});
