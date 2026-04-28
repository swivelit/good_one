import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { productAPI } from "../api";
import ProductCard from "../productCard";
import toast from "react-hot-toast";
import "../App.css";
import CountUp from "react-countup";

const CATEGORIES = [
  "All",
  "Electronics",
  "Mobiles",
  "Furniture",
  "Clothing",
  "Books",
  "Sports",
  "Home & Garden",
  "Vehicles",
  "Other",
];

/* Demo products fallback if API fails */

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState("All");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get("search") || "";

  useEffect(() => {
    fetchProducts();
  }, [category, page, search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const params = { page, limit: 12 };

      if (category !== "all") params.category = category;
      if (search) params.search = search;

      const { data } = await productAPI.getAll(params);

      console.log("Products API response:", data);

      setProducts(data?.products || []);
      setPages(data?.pages || 1);
      setTotal(data?.total || 0);
    } catch (error) {
      console.error("Product fetch error:", error);

      toast.error("Failed to load products, showing demo data");

      setProducts();
      setPages(1);
      setTotal();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="hero-section">
        <div className="container position-relative" style={{ zIndex: 1 }}>
          <div className="row align-items-center">
            <div className="col-lg-7 text-white">
              <span
                className="badge bg-white text-warning fw-bold mb-3 px-3 py-2"
                style={{ borderRadius: 20 }}
              >
                <i className="bi bi-lightning-fill me-1"></i>24-Hour Fresh
                Listings
              </span>
              <h1 className="display-4 fw-900 mb-3" style={{ fontWeight: 900 }}>
                Buy & Sell
                <br />
                <span style={{ color: "#F7C59F" }}>Directly. Locally.</span>
              </h1>
              <p className="lead mb-4 opacity-90">
                Connect with verified vendors. Chat, negotiate, and meet up — no
                middleman, no hassle.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <Link
                  to="/register/customer"
                  className="btn btn-light fw-bold px-4 py-2"
                  style={{ borderRadius: 10, color: "#FF6B35" }}
                >
                  <i className="bi bi-person-plus me-2"></i>Start Shopping Free
                </Link>
                <Link
                  to="/register/vendor"
                  className="btn btn-outline-light fw-bold px-4 py-2"
                  style={{ borderRadius: 10 }}
                >
                  <i className="bi bi-shop me-2"></i>Sell Your Products
                </Link>
              </div>
              <div className="d-flex gap-4 mt-4 flex-wrap">
                {[
                  ["bi-shield-check", "Verified Vendors"],
                  ["bi-chat-dots", "Direct Chat"],
                  ["bi-clock", "24h Listings"],
                ].map(([ic, label]) => (
                  <div
                    key={label}
                    className="d-flex align-items-center gap-2 text-white opacity-90 small"
                  >
                    <i className={`bi ${ic} fs-5`}></i>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="col-lg-5 d-none d-lg-flex justify-content-end">
              <div
                className="p-4 bg-white rounded-4 shadow-lg"
                style={{ maxWidth: 320, width: "100%" }}
              >
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <span className="fw-bold text-dark">Latest Listings</span>
                  <span
                    className="badge"
                    style={{
                      background: "#FF6B35",
                      color: "#fff",
                      borderRadius: 20,
                    }}
                  >
                    {total || "100+"} Active
                  </span>
                </div>

                {products
                  .filter((p) => p.isActive)
                  .slice(0, 4)
                  .map((p) => (
                    <div
                      key={p._id}
                      className="d-flex align-items-center mb-3 border-bottom pb-2"
                    >
                      <img
                        src={`http://localhost:5000/uploads/${p.images?.[0]}`}
                        alt={p.title}
                        style={{
                          width: 50,
                          height: 50,
                          objectFit: "cover",
                          borderRadius: 8,
                          marginRight: 10,
                        }}
                      />

                      <div style={{ flex: 1 }}>
                        <div className="fw-semibold small text-dark">
                          {p.title}
                        </div>
                        <div className="text-muted small">₹{p.price}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-white shadow-sm py-3">
        <div className="container">
          <div className="row text-center g-3">
            {[
              [500, "Active Listings"],
              [200, "Verified Vendors"],
              [1000, "Happy Buyers"],
              [24, "Auto Renewal"],
            ].map(([num, lbl]) => (
              <div key={lbl} className="col-6 col-md-3">
                <div className="fw-bold fs-4" style={{ color: "#FF6B35" }}>
                  <CountUp end={num} duration={2} />+
                </div>

                <div className="text-muted small">{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Products */}
      <section className="py-5">
        <div className="container">
          {search && (
            <div className="alert alert-warning d-flex align-items-center gap-2 mb-4">
              <i className="bi bi-search"></i>
              <span>
                Showing results for "<strong>{search}</strong>"
              </span>
              <button
                className="btn btn-sm btn-outline-warning ms-auto"
                onClick={() => navigate("/")}
              >
                Clear
              </button>
            </div>
          )}

          {/* Category Filter */}
          <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
            <span className="fw-bold me-1 text-muted">Filter:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`category-chip ${category === cat ? "active" : ""}`}
                onClick={() => {
                  setCategory(cat);
                  setPage(1);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="section-title mb-0">
              {search
                ? "Search Results"
                : category === "all"
                  ? "All Products"
                  : category}
            </h2>
            <span className="text-muted small">{total} products</span>
          </div>

          {loading ? (
            <div className="row g-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="col-6 col-md-4 col-lg-3">
                  <div
                    className="card h-100 border-0 shadow-sm"
                    style={{ borderRadius: 14 }}
                  >
                    <div className="placeholder-glow">
                      <div
                        className="placeholder bg-secondary"
                        style={{
                          height: 200,
                          width: "100%",
                          borderRadius: "14px 14px 0 0",
                        }}
                      ></div>
                    </div>
                    <div className="card-body">
                      <p className="placeholder-glow">
                        <span className="placeholder col-10"></span>
                      </p>
                      <p className="placeholder-glow">
                        <span className="placeholder col-7"></span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox display-1 text-muted"></i>
              <h4 className="mt-3 text-muted">No products found</h4>
              <p className="text-muted">
                Try a different category or search term
              </p>
              <Link to="/register/vendor" className="btn btn-primary-custom">
                <i className="bi bi-plus-circle me-2"></i>Be the first to list!
              </Link>
            </div>
          ) : (
            <>
              <div className="row g-3 g-md-4">
                {products.map((p) => (
                  <div key={p._id} className="col-6 col-md-4 col-lg-3">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>

              {pages > 1 && (
                <nav className="mt-5 d-flex justify-content-center">
                  <ul className="pagination">
                    <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => p - 1)}
                      >
                        ‹
                      </button>
                    </li>
                    {[...Array(pages)].map((_, i) => (
                      <li
                        key={i}
                        className={`page-item ${page === i + 1 ? "active" : ""}`}
                      >
                        <button
                          className="page-link"
                          onClick={() => setPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      </li>
                    ))}
                    <li
                      className={`page-item ${page === pages ? "disabled" : ""}`}
                    >
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => p + 1)}
                      >
                        ›
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-5" style={{ background: "#FFF8F4" }}>
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="section-title d-inline-block">How GoodOne Works</h2>
          </div>
          <div className="row g-4 justify-content-center">
            {[
              {
                icon: "bi-person-check-fill",
                color: "#FF6B35",
                step: "01",
                title: "Create Account",
                desc: "Register as a customer to shop or as a verified vendor to sell products.",
              },
              {
                icon: "bi-grid-fill",
                color: "#2C3E50",
                step: "02",
                title: "Browse Products",
                desc: "Explore fresh 24-hour listings from verified vendors in your area.",
              },
              {
                icon: "bi-chat-dots-fill",
                color: "#FF6B35",
                step: "03",
                title: "Chat & Negotiate",
                desc: "Message vendors directly to negotiate price and discuss product details.",
              },
              {
                icon: "bi-geo-alt-fill",
                color: "#2C3E50",
                step: "04",
                title: "Meet & Buy",
                desc: "Arrange a safe meetup location and complete the purchase offline.",
              },
            ].map((item) => (
              <div key={item.step} className="col-6 col-md-3 text-center">
                <div
                  className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: 80,
                    height: 80,
                    background: item.color + "1a",
                  }}
                >
                  <i
                    className={`bi ${item.icon} fs-2`}
                    style={{ color: item.color }}
                  ></i>
                </div>
                <span className="d-block small fw-bold text-muted mb-1">
                  STEP {item.step}
                </span>
                <h6 className="fw-bold">{item.title}</h6>
                <p className="text-muted small">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-5"
        style={{ background: "linear-gradient(135deg,#FF6B35,#2C3E50)" }}
      >
        <div className="container text-center text-white">
          <h2 className="fw-bold mb-2">Ready to Start Selling?</h2>
          <p className="opacity-80 mb-4">
            Join 200+ vendors already growing their business on GoodOne
          </p>
          <Link
            to="/register/vendor"
            className="btn btn-light btn-lg fw-bold px-5"
            style={{ color: "#FF6B35", borderRadius: 12 }}
          >
            <i className="bi bi-shop me-2"></i>Register as Vendor Free
          </Link>
        </div>
      </section>
    </>
  );
}
