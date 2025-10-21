import { test, expect } from "@playwright/test";

test.describe("User Registration Flow UI tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/register");
  });

  // Happy path: register new user → redirect to login → login successfully
  test("FLOW: user registration → login successfully → logout", async ({
    page,
  }) => {
    const uniqueEmail = `testuser_${Date.now()}@example.com`;

    await test.step("Fill registration form", async () => {
      await page.getByPlaceholder("Enter Your Name").fill("Test User");
      await page.getByPlaceholder("Enter Your Email").fill(uniqueEmail);
      await page.getByPlaceholder("Enter Your Password").fill("strongpass");
      await page.getByPlaceholder("Enter Your Phone Number").fill("91234567");
      await page
        .getByPlaceholder("Enter Your Address")
        .fill("123 Playwright Street");
      await page.getByPlaceholder("Enter Your DOB").fill("2000-01-01");
      await page
        .getByPlaceholder("What is Your Favorite Sports?")
        .fill("Football");
    });

    await test.step("Submit form and verify redirect to login", async () => {
      await page.getByRole("button", { name: "REGISTER" }).click();
      await expect(page).toHaveURL("/login");
    });

    await test.step("Login with registered credentials", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(uniqueEmail);
      await page.getByPlaceholder("Enter Your Password").fill("strongpass");
      await page.getByRole("button", { name: "LOGIN" }).click();
      await expect(page).toHaveURL("/");

      // Verify localStorage items after login
      const authData = await page.evaluate(() => localStorage.getItem("auth"));
      expect(authData).not.toBeNull();

      const parsed = JSON.parse(authData);
      expect(parsed?.user?.email).toBe(uniqueEmail);
      expect(parsed?.token).toBeTruthy();
    });

    await test.step("Logout user", async () => {
      await page.getByRole("button", { name: "TEST USER" }).click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();

      // Verify localStorage cleared after logout
      const cleared = await page.evaluate(() => localStorage.getItem("auth"));
      expect(cleared).toBeNull();
    });
  });

  test("FLOW: unable to register with empty form", async ({ page }) => {
    await test.step("Submit empty form", async () => {
      await page.getByRole("button", { name: "REGISTER" }).click();
    });

    await test.step("Verify user still on same page", async () => {
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test("FLOW: unable to register with password length < 6", async ({
    page,
  }) => {
    await test.step("Fill registration form with short password", async () => {
      await page.getByPlaceholder("Enter Your Name").fill("Short Pass");
      await page.getByPlaceholder("Enter Your Email").fill("short@example.com");
      await page.getByPlaceholder("Enter Your Password").fill("123");
      await page.getByPlaceholder("Enter Your Phone Number").fill("99999999");
      await page.getByPlaceholder("Enter Your Address").fill("Somewhere");
      await page.getByPlaceholder("Enter Your DOB").fill("1999-09-09");
      await page
        .getByPlaceholder("What is Your Favorite Sports?")
        .fill("Tennis");
    });

    await test.step("Submit and verify validation message", async () => {
      await page.getByRole("button", { name: "REGISTER" }).click();
      await expect(
        page.getByText("Password must be at least 6 characters long")
      ).toBeVisible();
    });
  });

  test("FLOW: unable to register with existing email", async ({ page }) => {
    await test.step("Fill registration form with existing email", async () => {
      await page.getByPlaceholder("Enter Your Name").fill("Existing User");
      await page
        .getByPlaceholder("Enter Your Email")
        .fill("existing@example.com");
      await page.getByPlaceholder("Enter Your Password").fill("strongpass");
      await page.getByPlaceholder("Enter Your Phone Number").fill("88888888");
      await page
        .getByPlaceholder("Enter Your Address")
        .fill("Existing Address");
      await page.getByPlaceholder("Enter Your DOB").fill("1990-10-10");
      await page
        .getByPlaceholder("What is Your Favorite Sports?")
        .fill("Football");
    });

    await test.step("Submit and verify duplicate message", async () => {
      await page.getByRole("button", { name: "REGISTER" }).click();
      await expect(
        page.getByText("User already registered, please login")
      ).toBeVisible();
    });
  });

  test("FLOW: unable to register due to server error", async ({ page }) => {
    // Simulate server error by intercepting the registration API call
    await page.route("**/api/v1/auth/register", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Internal Server Error",
        }),
      });
    });

    await test.step("Fill registration form", async () => {
      await page.getByPlaceholder("Enter Your Name").fill("Server Crash");
      await page.getByPlaceholder("Enter Your Email").fill("crash@example.com");
      await page.getByPlaceholder("Enter Your Password").fill("strongpass");
      await page.getByPlaceholder("Enter Your Phone Number").fill("92222222");
      await page.getByPlaceholder("Enter Your Address").fill("Crash Ave");
      await page.getByPlaceholder("Enter Your DOB").fill("1995-05-05");
      await page
        .getByPlaceholder("What is Your Favorite Sports?")
        .fill("Chess");
    });

    await test.step("Submit and verify fallback message", async () => {
      await page.getByRole("button", { name: "REGISTER" }).click();
      await expect(page.getByText("Something went wrong")).toBeVisible();
    });
  });
});
