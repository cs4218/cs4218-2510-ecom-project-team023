import { test, expect } from "@playwright/test";

const NON_ADMIN_USERNAME = "TestUserAccount";
const NON_ADMIN_EMAIL = "testuser@user.com";
const NON_ADMIN_PHONE = "123";
const NON_ADMIN_PW = "password";

test.describe("Update User Profile Detail Flows UI tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  // Test flow without password change
  test("FLOW: login with valid non_admin credentials → home page → user profile page → update profile details → logout", async ({
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
    });

    await test.step("Access user dashboard page", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/user");
    });

    await test.step("Access update profile form and change back username and verify username auth context is updated", async () => {
      await page.getByRole("link", { name: "Profile" }).click();

      await expect(page).toHaveURL("/dashboard/user/profile");

      // Quick check to ensure email field is disabled
      await expect(
        page.getByRole("textbox", { name: "Enter Your Email" })
      ).toBeDisabled();

      await page
        .getByRole("textbox", { name: "Enter Your Name" })
        .fill("UpdatedUserName");
      await page.getByRole("button", { name: "UPDATE" }).click();

      await expect(
        page.getByText("Profile updated successfully")
      ).toBeVisible();

      // Verify updated username is reflected in the header in UI
      await expect(
        page.getByRole("button", { name: "UPDATEDUSERNAME" })
      ).toBeVisible();
    });

    await test.step("Navigate to user dashboard and verify updated username is reflected on other pages and auth context", async () => {
      await page.getByRole("button", { name: "UPDATEDUSERNAME" }).click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      // Verify localStorage items after profile update
      const authData = await page.evaluate(() => localStorage.getItem("auth"));
      expect(authData).not.toBeNull();

      const parsed = JSON.parse(authData);
      expect(parsed?.user?.name).toBe("UpdatedUserName");

      await expect(page).toHaveURL("/dashboard/user");
      await expect(
        page.getByRole("heading", {
          name: ` User Name : UpdatedUserName`,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step("Revert changed name back to original name", async () => {
      await page.getByRole("link", { name: "Profile" }).click();
      const profileForm = page.locator('form:has-text("USER PROFILE")');
      await profileForm
        .getByRole("textbox", { name: "Enter Your Name" })
        .fill(NON_ADMIN_USERNAME);
      await profileForm.getByRole("button", { name: "UPDATE" }).click();

      await expect(
        page.getByText("Profile updated successfully")
      ).toBeVisible();

      // Verify localStorage items after profile update
      await expect
        .poll(async () => {
          const authData = await page.evaluate(() =>
            localStorage.getItem("auth")
          );
          return JSON.parse(authData)?.user?.name;
        })
        .toBe(NON_ADMIN_USERNAME);

      // Verify updated username is reflected in the header in UI
      await expect(
        page.getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
      ).toBeVisible();
    });

    await test.step("Logout user", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();
    });
  });

  // Test flow with password change
  test("FLOW: login with valid non_admin credentials → home page → user profile page → update profile details with password change → logout → login with new password → logout", async ({
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
    });

    await test.step("Access user dashboard page", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/user");
    });

    await test.step("Access update profile form and change password", async () => {
      await page.getByRole("link", { name: "Profile" }).click();

      await expect(page).toHaveURL("/dashboard/user/profile");

      // Quick check to ensure email field is disabled
      await expect(
        page.getByRole("textbox", { name: "Enter Your Email" })
      ).toBeDisabled();

      await page
        .getByRole("textbox", { name: "Enter Your Password" })
        .fill("newpassword123");
      await page.getByRole("button", { name: "UPDATE" }).click();

      await expect(
        page.getByText("Profile updated successfully")
      ).toBeVisible();
    });

    await test.step("Logout user", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();
    });

    await test.step("Login with new password", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(NON_ADMIN_EMAIL);
      await page.getByPlaceholder("Enter Your Password").fill("newpassword123");
      await page.getByRole("button", { name: "LOGIN" }).click();

      await expect(page.getByText("login successfully")).toBeVisible();
      await expect(page).toHaveURL("/");
    });

    // Revert password back to original password for test idempotency
    await test.step("Revert password back to original password", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/user");

      await page.getByRole("link", { name: "Profile" }).click();

      await expect(page).toHaveURL("/dashboard/user/profile");

      await page
        .getByRole("textbox", { name: "Enter Your Password" })
        .fill(NON_ADMIN_PW);
      await page.getByRole("button", { name: "UPDATE" }).click();

      await expect(
        page.getByText("Profile updated successfully")
      ).toBeVisible();
    });

    await test.step("Logout user", async () => {
      await page
        .getByRole("button", { name: NON_ADMIN_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();
    });
  });
});
