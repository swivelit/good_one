import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const isNative = Capacitor.isNativePlatform();
  const browsePath = "/browse";
  const logoutPath = isNative ? "/" : "/login";
  const showNativeSearch =
    isNative &&
    ["/browse", "/products"].some((path) => location.pathname.startsWith(path));

  useEffect(() => {
    const currentSearch = new URLSearchParams(location.search).get("search") || "";
    setSearch(currentSearch);
  }, [location.search]);

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate(logoutPath);
  };

  const handleSearch = (e) => {
    e.preventDefault();

    if (search.trim()) {
      navigate(`${browsePath}?search=${encodeURIComponent(search.trim())}`);
    } else {
      navigate(browsePath);
    }
  };

  const handleSearchChange = (e) => {
    const nextSearch = e.target.value;
    setSearch(nextSearch);

    if (!nextSearch.trim() && new URLSearchParams(location.search).has("search")) {
      navigate(browsePath);
    }
  };

  if (isNative) {
    return (
      <>
        <header className="native-topbar">
          <div className="native-topbar-row">
            <Link className="native-brand" to={user?.role === "vendor" ? "/dashboard" : "/"}>
              <i className="bi bi-shop-window"></i>
              <span>GoodOne</span>
            </Link>

            <div className="d-flex align-items-center gap-2">
              {!user ? (
                <Link className="btn btn-primary-custom btn-sm px-3" to="/login">
                  Sign In
                </Link>
              ) : (
                <>
                  <Link
                    className="native-icon-button"
                    to={user.role === "vendor" ? "/dashboard" : "/browse"}
                    aria-label={user.role === "vendor" ? "Dashboard" : "Browse"}
                  >
                    <i className={`bi ${user.role === "vendor" ? "bi-speedometer2" : "bi-grid"}`}></i>
                  </Link>
                  <Link className="native-icon-button" to="/chat" aria-label="Messages">
                    <i className="bi bi-chat-dots"></i>
                  </Link>
                  <Link className="native-icon-button" to="/profile" aria-label="Profile">
                    <i className="bi bi-person-circle"></i>
                  </Link>
                  <button
                    type="button"
                    className="native-icon-button"
                    onClick={handleLogout}
                    aria-label="Logout"
                  >
                    <i className="bi bi-box-arrow-right"></i>
                  </button>
                </>
              )}
            </div>
          </div>

          {showNativeSearch && (
            <form className="native-search-form" onSubmit={handleSearch}>
              <i className="bi bi-search"></i>
              <input
                type="search"
                placeholder="Search products"
                value={search}
                onChange={handleSearchChange}
              />
            </form>
          )}
        </header>

        {user && (
          <nav className="native-bottom-nav">
            <Link to="/browse" className={location.pathname === "/browse" ? "active" : ""}>
              <i className="bi bi-grid"></i>
              <span>Browse</span>
            </Link>
            {user.role === "vendor" && (
              <>
                <Link
                  to="/dashboard"
                  className={location.pathname === "/dashboard" ? "active" : ""}
                >
                  <i className="bi bi-speedometer2"></i>
                  <span>Dashboard</span>
                </Link>
                <Link
                  to="/dashboard/add-product"
                  className={location.pathname === "/dashboard/add-product" ? "active" : ""}
                >
                  <i className="bi bi-plus-circle"></i>
                  <span>Add</span>
                </Link>
              </>
            )}
            <Link to="/chat" className={location.pathname.startsWith("/chat") ? "active" : ""}>
              <i className="bi bi-chat-dots"></i>
              <span>Chat</span>
            </Link>
            <Link to="/profile" className={location.pathname === "/profile" ? "active" : ""}>
              <i className="bi bi-person-circle"></i>
              <span>Profile</span>
            </Link>
          </nav>
        )}
      </>
    );
  }

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
                onChange={handleSearchChange}
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
              <Link className="nav-link fw-500" to={browsePath}>
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
                      <Link className="dropdown-item" to="/profile" style={{ color: "#0d6efd" }}>
                        <i className="bi bi-person-circle me-2"></i>Profile
                      </Link>
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
