import { useState, useEffect } from "react";
import { useAuth } from "../../context/auth";
import { Outlet, useNavigate } from "react-router-dom";
import axios from "axios";
import Spinner from "../Spinner";
import toast from "react-hot-toast";

export default function PrivateRoute() {
  const [ok, setOk] = useState(false);
  const [auth, setAuth] = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const authCheck = async () => {
      try {
        const res = await axios.get("/api/v1/auth/user-auth");

        if (res.data.ok) {
          setOk(true);
        } else {
          handleSessionExpired();
        }
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          handleSessionExpired();
        } else {
          console.error("Unexpected auth error:", error);
        }
        setOk(false);
      }
    };

    const handleSessionExpired = () => {
      setAuth({ ...auth, user: null, token: "" });
      localStorage.removeItem("auth");

      toast.error("Session expired. Please log in again.");

      navigate("/login");
    };

    if (auth?.token) {
      authCheck();
    } else {
      setOk(false);
    }
  }, [auth?.token, setAuth, navigate, auth]);

  return ok ? <Outlet /> : <Spinner path="" />;
}
