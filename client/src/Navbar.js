import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  const handleSearch = (e) => {
    e.preventDefault();

    if (search.trim()) {
      navigate(`/?search=${search}`);
    } else {
      navigate(`/`);
    }
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light navbar-custom sticky-top">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <span className="brand-logo">
            <i className="bi bi-shop-window me-1"></i>GoodOne
          </span>
        </Link>

        <button
          className="navbar-toggler border-0"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navMain"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navMain">
          {/* Search */}

          <form
            className="d-flex mx-auto my-2 my-lg-0"
            style={{ maxWidth: "380px", width: "100%" }}
            onSubmit={handleSearch}
          >
            <div className="input-group">
              <input
                className="form-control border-end-0"
                type="search"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ borderRadius: "10px 0 0 10px" }}
              />

              <button
                className="btn btn-primary-custom"
                type="submit"
                style={{ borderRadius: "0 10px 10px 0" }}
              >
                <i className="bi bi-search text-primary"></i>
              </button>
            </div>
          </form>

          {/* Nav links */}
          <ul className="navbar-nav ms-auto align-items-center gap-1">
            <li className="nav-item">
              <Link className="nav-link fw-500" to="/">
                Browse
              </Link>
            </li>

            {!user ? (
              <>
                <li className="nav-item">
                  <Link className="nav-link" to="/login">
                    Login
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className="btn btn-primary-custom btn-sm"
                    to="/register/vendor"
                  >
                    <i className="bi bi-shop me-1"></i>Sell
                  </Link>
                </li>
              </>
            ) : (
              <>
                {user.role === "customer" && (
                  <li className="nav-item">
                    <Link className="nav-link" to="/chat">
                      <i className="bi bi-chat-dots me-1"></i>Messages
                    </Link>
                  </li>
                )}
                {user.role === "vendor" && (
                  <li className="nav-item">
                    <Link className="nav-link" to="/dashboard">
                      <i className="bi bi-speedometer2 me-1"></i>Dashboard
                    </Link>
                  </li>
                )}
                <li className="nav-item dropdown">
                  <a
                    className="nav-link dropdown-toggle d-flex align-items-center gap-2"
                    href="/#"
                    data-bs-toggle="dropdown"
                  >
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                      style={{
                        width: 34,
                        height: 34,
                        background: "linear-gradient(135deg,#FF6B35,#e55a24)",
                        fontSize: "0.85rem",
                      }}
                    >
                      {user.name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="d-none d-lg-block">
                      {user.name?.split(" ")[0]}
                    </span>
                  </a>
                  <ul
                    className="dropdown-menu dropdown-menu-end shadow border-0"
                    style={{ borderRadius: 12, minWidth: 180 }}
                  >
                    <li>
                      <span className="dropdown-item-text text-muted small px-3 pt-2">
                        {user.role?.toUpperCase()}
                      </span>
                    </li>
                    <li>
                      <hr className="dropdown-divider my-1" />
                    </li>
                    {user.role === "vendor" && (
                      <>
                        <li>
                          <Link className="dropdown-item" to="/dashboard"  style={{ color: "#0d6efd" }}>
                            <i className="bi bi-speedometer2 me-2" ></i>Dashboard
                          </Link>
                        </li>
                        <li>
                          <Link
                            className="dropdown-item"
                            to="/dashboard/add-product"
                             style={{ color: "#0d6efd" }}
                          >
                            <i className="bi bi-plus-circle me-2"></i>Add
                            Product
                          </Link>
                        </li>
                        <li>
                          <Link className="dropdown-item" to="/chat"  style={{ color: "#0d6efd" }}>
                            <i className="bi bi-chat-dots me-2"></i>Messages
                          </Link>
                        </li>
                      </>
                    )}
                    {user.role === "customer" && (
                      <li>
                        <Link className="dropdown-item" to="/chat"  style={{ color: "#0d6efd" }}>
                          <i className="bi bi-chat-dots me-2"></i>Messages
                        </Link>
                      </li>
                    )}
                    <li>
                      <hr className="dropdown-divider my-1" />
                    </li>
                    <li>
                      <button
                        className="dropdown-item text-danger"
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right me-2"></i>Logout
                      </button>
                    </li>
                  </ul>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
