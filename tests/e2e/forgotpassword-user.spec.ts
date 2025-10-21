import { test, expect } from "@playwright/test";

const FORGETFUL_USERNAME = "ForgetfulUser";
const FORGETFUL_EMAIL = "forgetfuluser@user.com";
const FORGETFUL_OLD_PW = "oldpassword";
const FORGETFUL_NEW_PW = "newpassword";
const FORGETFUL_PHONE = "987654";

test.describe("User Forgot Password Flows UI tests", () => {
  test.beforeEach(async ({ page }) => {
    // start at login page to test navigation to forgot password
    await page.goto("/login");
  });

  test("FLOW: forgot password → reset password → login with new password -> user profile page → update password to oldpassword → logout", async ({
    page,
  }) => {
    await test.step("Navigate to Forgot Password page", async () => {
      await page.getByRole("button", { name: "Forgot Password" }).click();
      await expect(page).toHaveURL("/forgot-password");
    });

    await test.step("Submit forgot password form", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(FORGETFUL_EMAIL);
      await page.getByPlaceholder("Enter Your Favourite Sports").fill("forgot");
      await page.getByPlaceholder("Enter New Password").fill(FORGETFUL_NEW_PW);
      await page.getByRole("button", { name: "RESET PASSWORD" }).click();

      await expect(page.getByText("Password reset successfully")).toBeVisible();
    });

    await test.step("Login with new password", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(FORGETFUL_EMAIL);
      await page.getByPlaceholder("Enter Your Password").fill(FORGETFUL_NEW_PW);
      await page.getByRole("button", { name: "LOGIN" }).click();

      await expect(page.getByText("login successfully")).toBeVisible();
      await expect(page).toHaveURL("/");
    });

    await test.step("Access user profile page", async () => {
      await page
        .getByRole("button", { name: FORGETFUL_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "DASHBOARD" }).click();

      await expect(page).toHaveURL("/dashboard/user");
      await expect(
        page.getByRole("heading", {
          name: ` User Name : ${FORGETFUL_USERNAME}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` User Email : ${FORGETFUL_EMAIL}`,
          exact: true,
        })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: ` User Contact : ${FORGETFUL_PHONE}`,
          exact: true,
        })
      ).toBeVisible();
    });

    await test.step("Access update profile form and change back to old password", async () => {
      await page.getByRole("link", { name: "Profile" }).click();

      await expect(page).toHaveURL("/dashboard/user/profile");

      await page
        .getByRole("textbox", { name: "Enter Your Password" })
        .fill(FORGETFUL_OLD_PW);
      await page.getByRole("button", { name: "UPDATE" }).click();

      await expect(
        page.getByText("Profile updated successfully")
      ).toBeVisible();
    });

    await test.step("Logout user", async () => {
      await page
        .getByRole("button", { name: FORGETFUL_USERNAME.toUpperCase() })
        .click();
      await page.getByRole("link", { name: "LOGOUT" }).click();

      await expect(page).toHaveURL("/login");
      await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();
    });
  });

  test("FLOW: unable to reset password with incorrect answer", async ({
    page,
  }) => {
    await test.step("Navigate to Forgot Password page", async () => {
      await page.getByRole("button", { name: "Forgot Password" }).click();
      await expect(page).toHaveURL("/forgot-password");
    });

    await test.step("Submit forgot password form with incorrect answer", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(FORGETFUL_EMAIL);
      await page
        .getByPlaceholder("Enter Your Favourite Sports")
        .fill("wronganswer");
      await page.getByPlaceholder("Enter New Password").fill(FORGETFUL_NEW_PW);
      await page.getByRole("button", { name: "RESET PASSWORD" }).click();

      await expect(page.getByText("Wrong Email Or Answer")).toBeVisible();
      await expect(page).toHaveURL("/forgot-password");
    });
  });

  test("FLOW: unable to reset password with incorrect email", async ({
    page,
  }) => {
    await test.step("Navigate to Forgot Password page", async () => {
      await page.getByRole("button", { name: "Forgot Password" }).click();
      await expect(page).toHaveURL("/forgot-password");
    });

    await test.step("Submit forgot password form with incorrect email", async () => {
      await page.getByPlaceholder("Enter Your Email").fill("wrong@example.com");
      await page.getByPlaceholder("Enter Your Favourite Sports").fill("forgot"); // correct answer
      await page.getByPlaceholder("Enter New Password").fill(FORGETFUL_NEW_PW);
      await page.getByRole("button", { name: "RESET PASSWORD" }).click();

      await expect(page.getByText("Wrong Email Or Answer")).toBeVisible();
      await expect(page).toHaveURL("/forgot-password");
    });
  });

  test("FLOW: unable to reset password due to server error", async ({
    page,
  }) => {
    // Simulate server error by intercepting the forgot-password API call
    await page.route("**/api/v1/auth/forgot-password", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "Internal Server Error",
        }),
      });
    });

    await test.step("Navigate to Forgot Password page", async () => {
      await page.getByRole("button", { name: "Forgot Password" }).click();
      await expect(page).toHaveURL("/forgot-password");
    });

    await test.step("Fill Forgot Password form", async () => {
      await page.getByPlaceholder("Enter Your Email").fill(FORGETFUL_EMAIL);
      await page.getByPlaceholder("Enter Your Favourite Sports").fill("forgot");
      await page.getByPlaceholder("Enter New Password").fill(FORGETFUL_NEW_PW);

      await test.step("Submit and verify fallback message", async () => {
        await page.getByRole("button", { name: "RESET PASSWORD" }).click();
        await expect(page.getByText("Something went wrong")).toBeVisible();
      });
    });
  });
});
