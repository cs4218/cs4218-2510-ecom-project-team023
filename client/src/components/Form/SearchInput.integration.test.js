// import React from "react";
// import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// import { MemoryRouter } from "react-router-dom";
// import { SearchProvider } from "../../context/search"; // Import your SearchContext
// import SearchInput from "./SearchInput"; // Path to your SearchInput component

// // Setup Search Context Wrapper
// const renderWithContext = (ui) => {
//   return render(
//     <MemoryRouter>
//       <SearchProvider>
//         {ui}
//       </SearchProvider>
//     </MemoryRouter>
//   );
// };

// describe("SearchInput Integration Test with SearchContext", () => {
//   test("should update the context value when the user types a keyword and submits the form", async () => {
//     renderWithContext(<SearchInput />);

//     const input = screen.getByPlaceholderText("Search");
//     const button = screen.getByRole("button", { name: /Search/i });

//     // Simulate user typing
//     fireEvent.change(input, { target: { value: "laptop" } });

//     // Ensure the input value is correctly updated
//     expect(input).toHaveValue("laptop");

//     // Simulate form submission
//     fireEvent.click(button);

//     // Wait for the context to update
//     await waitFor(() => {
//       // After form submission, check if the context values are set as expected.
//       // In this case, ensure that 'results' has been updated based on the search input.
//       expect(screen.getByText(/laptop/i)).toBeInTheDocument();
//     });
//   });
// });
