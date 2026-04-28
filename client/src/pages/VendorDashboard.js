import React, { useState, useEffect } from "react";
import { Link,} from "react-router-dom";
import { productAPI, vendorAPI } from "../api";
import { useAuth } from "../AuthContext";
import toast from "react-hot-toast";

function getTimeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return { text: "Expired", cls: "timer-urgent", pct: 0 };
  const hours = Math.floor(diff / 3600000);
  const pct = Math.round((diff / (24 * 3600000)) * 100);
  if (hours < 2) return { text: `${hours}h left`, cls: "timer-urgent", pct };
  if (hours < 8) return { text: `${hours}h left`, cls: "timer-warning", pct };
  return { text: `${hours}h left`, cls: "timer-ok", pct };
}

export default function VendorDashboard() {
  const { user, vendorProfile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
 

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data } = await productAPI.getMine();
      setProducts(data.products);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (productId) => {
    try {
      await productAPI.renew(productId);
      toast.success("Product renewed for 24 hours!");
      fetchProducts();
    } catch {
      toast.error("Failed to renew product");
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await productAPI.delete(productId);
      toast.success("Product deleted");
      fetchProducts();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const activeProducts = products.filter(
    (p) => p.isActive && new Date(p.expiresAt) > new Date(),
  );
  const expiredProducts = products.filter(
    (p) => !p.isActive || new Date(p.expiresAt) <= new Date(),
  );

  const stats = [
    {
      label: "Total Listings",
      value: products.length,
      icon: "bi-grid-fill",
      color: "#FF6B35",
      bg: "#fff5f0",
    },
    {
      label: "Active Now",
      value: activeProducts.length,
      icon: "bi-check-circle-fill",
      color: "#198754",
      bg: "#f0fdf4",
    },
    {
      label: "Expired",
      value: expiredProducts.length,
      icon: "bi-clock-history",
      color: "#dc3545",
      bg: "#fff5f5",
    },
    {
      label: "Total Views",
      value: products.reduce((a, p) => a + (p.views || 0), 0),
      icon: "bi-eye-fill",
      color: "#0d6efd",
      bg: "#f0f4ff",
    },
  ];

  const navItems = [
    { id: "overview", icon: "bi-speedometer2", label: "Overview" },
    { id: "products", icon: "bi-grid", label: "My Products" },
    { id: "profile", icon: "bi-person-badge", label: "Business Profile" },
  ];

  return (
    <div className="d-flex" style={{ minHeight: "calc(100vh - 70px)" }}>
      {/* Sidebar */}
      <div
        className="dashboard-sidebar d-none d-lg-block"
        style={{ width: 220, flexShrink: 0 }}
      >
        <div className="px-3 mb-4">
          <div className="d-flex align-items-center gap-2 mb-3">
            {vendorProfile?.livePhoto ? (
              <img
                src={`http://localhost:5000/uploads/${vendorProfile.livePhoto}`}
                className="rounded-circle"
                style={{ width: 42, height: 42, objectFit: "cover" }}
              />
            ) : (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                style={{ width: 42, height: 42, background: "#c1f572" }}
              >
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            )}

            <div>
              <div className="text-white fw-semibold small"> {user.name?.split(" ")[0]}</div>
              <div className="text-primary small">Vendor</div>

            </div>
          </div>
        </div>
        <nav className="px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-link w-100 text-start border-0 bg-transparent ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <i className={`bi ${item.icon}`}></i>
              {item.label}
            </button>
          ))}
          <Link
            to="/dashboard/add-product"
            className="nav-link d-block mt-2"
            style={{
              background: "rgba(255,107,53,0.15)",
              color: "#FF6B35",
              borderRadius: 10,
              padding: "0.75rem 1.25rem",
            }}
          >
            <i className="bi bi-plus-circle"></i>Add New Product
          </Link>
        </nav>
      </div>

      {/* Mobile Tabs */}
      <div
        className="d-lg-none w-100 bg-dark px-2 py-1 position-sticky top-0"
        style={{ zIndex: 10 }}
      >
        <div className="d-flex gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`btn btn-sm flex-fill ${activeTab === item.id ? "btn-warning" : "btn-outline-secondary text-white"}`}
              onClick={() => setActiveTab(item.id)}
              style={{ fontSize: "0.75rem" }}
            >
              <i className={`bi ${item.icon}`}></i>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
        {/* Overview */}
        {activeTab === "overview" && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
              <div>
                <h4 className="fw-bold mb-0">
                  Welcome back, {user.name?.split(" ")[0]}! 👋
                </h4>
                <small className="text-muted">
                  {vendorProfile?.businessName}
                </small>
              </div>
              <Link
                to="/dashboard/add-product"
                className="btn btn-primary-custom"
              >
                <i className="bi bi-plus-circle me-2"></i>Add Product
              </Link>
            </div>

            <div className="row g-3 mb-4">
              {stats.map((s) => (
                <div key={s.label} className="col-6 col-md-3">
                  <div
                    className="stat-card"
                    style={{
                      background: s.bg,
                      border: `1px solid ${s.color}20`,
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div
                          className="fw-bold fs-3"
                          style={{ color: s.color }}
                        >
                          {s.value}
                        </div>
                        <div className="text-muted small">{s.label}</div>
                      </div>
                      <i
                        className={`bi ${s.icon} fs-3`}
                        style={{ color: s.color, opacity: 0.4 }}
                      ></i>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Products needing renewal */}
            {products.filter((p) => {
              const h = Math.floor(
                (new Date(p.expiresAt) - new Date()) / 3600000,
              );
              return h >= 0 && h < 6;
            }).length > 0 && (
              <div className="alert alert-warning mb-4">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Attention!</strong>{" "}
                {
                  products.filter((p) => {
                    const h = Math.floor(
                      (new Date(p.expiresAt) - new Date()) / 3600000,
                    );
                    return h >= 0 && h < 6;
                  }).length
                }{" "}
                product(s) expiring within 6 hours. Renew now!
              </div>
            )}

            {/* Recent products */}
            <h6 className="fw-bold mb-3">Recent Listings</h6>
            <div className="row g-3">
              {products.slice(0, 6).map((p) => {
                const timer = getTimeLeft(p.expiresAt);
                return (
                  <div key={p._id} className="col-md-6 col-lg-4">
                    <div
                      className="card border-0 shadow-sm"
                      style={{ borderRadius: 12 }}
                    >
                      <div className="card-body">
                        <div className="d-flex gap-3 align-items-start">
                          <div
                            className="rounded-3 d-flex align-items-center justify-content-center text-white"
                            style={{
                              width: 48,
                              height: 48,
                              background: "#FF6B35",
                              minWidth: 48,
                              fontSize: "1.2rem",
                            }}
                          >
                            <i className="bi bi-tag-fill"></i>
                          </div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="fw-semibold small text-truncate">
                              {p.title}
                            </div>
                            <div
                              className="fw-bold"
                              style={{ color: "#FF6B35" }}
                            >
                              ₹{p.price?.toLocaleString()}
                            </div>
                            <div
                              className={`timer-badge mt-1 d-inline-block ${timer.cls}`}
                            >
                              <i className="bi bi-clock me-1"></i>
                              {timer.text}
                            </div>
                          </div>
                        </div>
                        <div
                          className="progress mt-2"
                          style={{ height: 4, borderRadius: 4 }}
                        >
                          <div
                            className="progress-bar"
                            style={{
                              width: `${timer.pct}%`,
                              background: "#FF6B35",
                            }}
                          ></div>
                        </div>
                        <div className="d-flex gap-2 mt-2">
                          <button
                            className="btn btn-sm btn-outline-success flex-fill"
                            style={{ fontSize: "0.75rem" }}
                            onClick={() => handleRenew(p._id)}
                          >
                            <i className="bi bi-arrow-repeat me-1"></i>Renew
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            style={{ fontSize: "0.75rem" }}
                            onClick={() => handleDelete(p._id)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h5 className="fw-bold mb-0">My Products</h5>
              <Link
                to="/dashboard/add-product"
                className="btn btn-primary-custom btn-sm"
              >
                <i className="bi bi-plus me-1"></i>Add Product
              </Link>
            </div>
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-warning"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-5">
                <i className="bi bi-inbox display-1 text-muted"></i>
                <h5 className="mt-3">No products yet</h5>
                <Link
                  to="/dashboard/add-product"
                  className="btn btn-primary-custom mt-3"
                >
                  <i className="bi bi-plus-circle me-2"></i>Add First Product
                </Link>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Views</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const timer = getTimeLeft(p.expiresAt);
                      const isExp = new Date(p.expiresAt) <= new Date();
                      return (
                        <tr key={p._id}>
                          <td>
                            <div className="fw-semibold">{p.title}</div>
                            <small className="text-muted">{p.category}</small>
                          </td>
                          <td className="fw-bold" style={{ color: "#FF6B35" }}>
                            ₹{p.price?.toLocaleString()}
                          </td>
                          <td>
                            <span
                              className={`badge ${isExp ? "bg-danger" : "bg-success"}`}
                            >
                              {isExp ? "Expired" : "Active"}
                            </span>
                          </td>
                          <td>
                            <span className={`timer-badge ${timer.cls}`}>
                              {timer.text}
                            </span>
                          </td>
                          <td>{p.views || 0}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handleRenew(p._id)}
                                title="Renew 24h"
                              >
                                <i className="bi bi-arrow-repeat"></i>
                              </button>
                              <Link
                                to={`/products/${p._id}`}
                                className="btn btn-sm btn-outline-primary"
                              >
                                <i className="bi bi-eye"></i>
                              </Link>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(p._id)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <VendorProfileEdit vendorProfile={vendorProfile} />
        )}
      </div>
    </div>
  );
}

function VendorProfileEdit({ vendorProfile }) {
  const [form, setForm] = useState({
    businessName: vendorProfile?.businessName || "",
    businessDescription: vendorProfile?.businessDescription || "",
    businessCategory: vendorProfile?.businessCategory || "",
    businessAddress: vendorProfile?.businessAddress || "",
    website: vendorProfile?.website || "",
  });
  const [saving, setSaving] = useState(false);
  const { setVendorProfile } = require("../AuthContext").useAuth();

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const { data } = await vendorAPI.updateProfile(form);
      setVendorProfile(data.vendor);
      toast.success("Profile updated!");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">Business Profile</h5>
      <form onSubmit={handleSave}>
        {[
          ["businessName", "Business Name", "text"],
          ["businessDescription", "Description", "textarea"],
          ["businessCategory", "Category", "text"],
          ["businessAddress", "Address", "text"],
          ["website", "Website", "url"],
        ].map(([key, label, type]) => (
          <div className="mb-3" key={key}>
            <label className="form-label small fw-semibold">{label}</label>
            {type === "textarea" ? (
              <textarea
                className="form-control"
                rows={3}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            ) : (
              <input
                type={type}
                className="form-control"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            )}
          </div>
        ))}
        <button
          type="submit"
          className="btn btn-primary-custom"
          disabled={saving}
        >
          {saving ? (
            <span className="spinner-border spinner-border-sm me-2"></span>
          ) : (
            <i className="bi bi-check-circle me-2"></i>
          )}
          Save Profile
        </button>
      </form>
    </div>
  );
}
