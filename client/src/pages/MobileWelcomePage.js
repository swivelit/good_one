import React from "react";
import { Link } from "react-router-dom";

export default function MobileWelcomePage() {
  return (
    <div className="auth-wrapper mobile-welcome-wrapper">
      <div className="auth-card mobile-welcome-card">
        <div className="auth-header">
          <div className="mobile-welcome-logo">
            <i className="bi bi-shop-window"></i>
          </div>
          <h1 className="h3 fw-bold mb-2">GoodOne</h1>
          <p className="opacity-80 mb-0">
            Buy & sell directly with verified local vendors
          </p>
        </div>

        <div className="auth-body">
          <div className="d-grid gap-3 mobile-welcome-actions">
            <Link to="/login" className="btn btn-primary-custom py-2">
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Sign In
            </Link>
            <Link
              to="/register/customer"
              className="btn btn-outline-secondary py-2"
            >
              <i className="bi bi-person-plus me-2"></i>
              Create Customer Account
            </Link>
            <Link to="/register/vendor" className="btn btn-outline-warning py-2">
              <i className="bi bi-shop me-2"></i>
              Become a Vendor
            </Link>
            <Link to="/browse" className="btn btn-link text-decoration-none">
              Continue Browsing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
