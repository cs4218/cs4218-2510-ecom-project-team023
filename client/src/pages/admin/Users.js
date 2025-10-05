import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import AdminMenu from '../../components/AdminMenu';
import toast from 'react-hot-toast'; 
import axios from 'axios'; 

const API_BASE = '/api/v1/auth'; 
const ITEMS_PER_PAGE = 10; 

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/users?page=${page}&limit=${ITEMS_PER_PAGE}`
      );

      // Safeguard: Check if the response and response.data are valid
      if (response && response.data) {
        const { data } = response;

        if (data.success) {
          setUsers(data.users);
          setCurrentPage(data.currentPage);
          setTotalPages(data.totalPages);
          setTotalUsers(data.totalUsers);
        } else {
          toast.error(data.message || "Failed to fetch users");
        }
      } else {
        throw new Error("Invalid response structure");
      }
    } catch (error) {
      console.log("Error fetching users:", error);
      toast.error("Something went wrong while fetching users.");
    } finally {
      setLoading(false);
    }
  };

  // useEffect hook to call fetchUsers whenever currentPage changes
  useEffect(() => {
    fetchUsers(currentPage);
  }, [currentPage]); // Dependency array ensures refetching when page changes

  // Function to handle page navigation
  const handlePageChange = (newPage) => {
    // Only change page if the new page is within the valid range
    if (newPage > 0 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  return (
    <Layout title={"Dashboard - All Users"}>
      <div className="container-fluid m-3 p-3">
        <div className="row">
          <div className="col-md-3">
            <AdminMenu />
          </div>
          <div className="col-md-9">
            <h1>All Users ({totalUsers})</h1>
            
            {loading ? (
              <div className="text-center">
                <p>Loading users...</p>
                <div className="spinner-border" role="status">
                  <span className="sr-only">Loading...</span>
                </div>
              </div>
            ) : (
              <>
                {/* User List Table */}
                <div className="border shadow p-3">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Name</th>
                        <th scope="col">Email</th>
                        <th scope="col">Phone</th>
                        <th scope="col">Role</th>
                        <th scope="col">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user, index) => (
                        <tr key={user._id}>
                          <th scope="row">
                            {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                          </th>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>{user.phone}</td>
                          <td>
                            <span className={`badge ${user.role === 1 ? 'bg-danger' : user.role === 2 ? 'bg-primary' : 'bg-secondary'}`}>
                              {user.role === 1 ? 'Admin' : user.role === 2 ? 'Manager' : 'User'}
                            </span>
                          </td>
                          <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* End of User List Table */}

                {/* Pagination Controls */}
                <div className="d-flex justify-content-center mt-4">
                  <button
                    className="btn btn-outline-primary mx-1"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    &laquo; Previous
                  </button>
                  <span className="p-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn btn-outline-primary mx-1"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    data-testid="disable_btn"
                  >
                    Next &raquo;
                  </button>
                </div>
                {/* End of Pagination Controls */}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Users;
