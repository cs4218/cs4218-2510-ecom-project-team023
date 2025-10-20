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

async function goToUserDashboard(page) {
    await page.getByRole('button', { name: 'test' }).click();
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await page.getByRole('link', { name: 'Users' }).click();
}

// Function to search through the table and verify values for each row
async function checkUserTable(page, expectedUsers, found) {
  const userTable = await page.locator('tbody[data-testid="user table"]');
  const rows = await userTable.locator('tr'); // Get all rows in the table

  // Loop through each row and validate the values
  for (let i = 0; i < await rows.count(); i++) {
    const row = rows.nth(i);
    
    // Extract user data from the row
    const name = await row.locator('td:nth-of-type(1)').innerText();
    const email = await row.locator('td:nth-of-type(2)').innerText();
    const phone = await row.locator('td:nth-of-type(3)').innerText();
    const role = await row.locator('td:nth-of-type(4)').innerText();
    const joined = await row.locator('td:nth-of-type(5)').innerText();
    
    // Check if this row matches any expected user
    const user = expectedUsers.find(u => u.email === email); // Find the user by email
    
    if (user) {
      // Assert the values match the expected structure
      expect(name).toBe(user.name);
      expect(email).toBe(user.email);
      expect(phone).toBe(user.phone);
      expect(role).toBe(user.role);
      expect(joined).toBe(user.joined);  // You might need to format the joined date to match

      found.push(name);
    }
  }
}
test.describe("Non Admin Users should be redirected", () => {
  test('should restrict access for non admin user users', async ({ page }) => {
    await loginNonAdmin(page);

    // Wait for 3 seconds to simulate the delay before redirection
    await page.waitForTimeout(1000); // Wait for 3 seconds
    // Try to access the Create Product page
    await page.goto(`${BASE_URL}/dashboard/admin/users`);
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
    await page.goto(`${BASE_URL}/dashboard/admin/users`);

    // Verify that the word "redirecting" is visible (this could be a message or text rendered on the page)
    await expect(page.locator('text=redirecting')).toBeVisible();

    // Wait for 3 seconds to simulate the delay before redirection
    await page.waitForTimeout(3000); // Wait for 3 seconds

    // Verify that the user is redirected to the homepage with the login page
    await expect(page).toHaveURL(`${BASE_URL}/`); // Ensure redirection to homepage
    await expect(page.locator('text=Login')).toBeVisible(); // Ensure login form is visible
  });
});

test.describe("User Dashboard Pagination", () => {
    test.beforeEach(async ({page}) => {
        await loginAdmin(page);
        await goToUserDashboard(page)
    });

    test("should page through all available pages", async ({ page }) => {
        // Step 2: Extract total number of users and calculate number of pages
        const totalUsersText = await page.locator('h1:has-text("All Users")').innerText();
        const totalUsers = parseInt(totalUsersText.match(/\d+/)[0], 10);  // Extract number of users
        const usersPerPage = 10;
        const totalPages = Math.ceil(totalUsers / usersPerPage);

        console.log(`Total Users: ${totalUsers}, Total Pages: ${totalPages}`);

        let currentPage = 1;

        while (currentPage <= totalPages) {
            const paginationInfo = await page.getByTestId('pagination info'); // Assuming the pagination info has a test ID
            await expect(paginationInfo).toBeVisible();  // Ensure pagination info is visible

            const paginationText = await paginationInfo.innerText();
            expect(paginationText).toContain(`Page ${currentPage} of ${totalPages}`);

            const userTable = await page.locator('tbody[data-testid="user table"]');
            const rows = await userTable.locator('tr'); // Get all rows in the table

            if (currentPage === totalPages) {
                const remainingUsers = totalUsers % usersPerPage;
                await expect(rows).toHaveCount(remainingUsers > 0 ? remainingUsers : 10); // Last page check
            } else {
                await expect(rows).toHaveCount(10); // For all other pages, expect 10 users per page
            }

            console.log(`Page num: ${currentPage}, Rows count: ${await rows.count()}`);

            if (currentPage < totalPages) {
                const nextButton = await page.locator('text=Next');
                await expect(nextButton).toBeVisible();  // Ensure the "Next" button is visible
                await nextButton.click();
                await page.waitForTimeout(1000);  // Wait for the page to load
            }
            currentPage += 1;
        }
    });

    test("should have created admin user and created non admin user", async ({ page }) => {
        const expectedUsers = [
            {
                name: 'test',
                email: 'testdh@gmail.com',
                phone: '123',
                role: 'Admin',
                joined: '10/18/2025'
            },
            {
                name: 'normaluser',
                email: 'normal@gmail.com',
                phone: '1',
                role: 'User',
                joined: '10/19/2025'
            }
        ];

        // Go through all pages and validate user data
        const totalUsersText = await page.locator('h1:has-text("All Users")').innerText();
        const totalUsers = parseInt(totalUsersText.match(/\d+/)[0], 10);  // Extract total users
        const usersPerPage = 10;
        const totalPages = Math.ceil(totalUsers / usersPerPage);

        let currentPage = 1;
        const found = [];
        while (currentPage <= totalPages && found.length < 2) {
            // Validate the rows on the current page
            await checkUserTable(page, expectedUsers, found);

            // If it's not the last page, click 'Next' to go to the next page
            if (currentPage < totalPages) {
                const nextButton = await page.locator('text=Next');
                await expect(nextButton).toBeVisible();  // Ensure the "Next" button is visible
                await nextButton.click();
                await page.waitForTimeout(1000);  // Wait for the page to load
            }
            currentPage += 1;
        }
        expect(found.length).toBe(2)
    });
});



  


