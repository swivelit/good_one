import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { productAPI, chatAPI, reportAPI } from "../api";
import { useAuth } from "../AuthContext";
import toast from "react-hot-toast";
import { getUploadUrl } from "../config";

function getTimeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return { text: "Expired", cls: "danger" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h < 2) return { text: `${h}h ${m}m left`, cls: "danger" };
  if (h < 8) return { text: `${h}h left`, cls: "warning" };
  return { text: `${h}h left`, cls: "success" };
}

const PLACEHOLDER =
  "https://via.placeholder.com/600x420/FF6B35/ffffff?text=No+Image";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

 useEffect(() => {
    productAPI
      .getOne(id)
      .then(({ data }) => setProduct(data.product))
      .catch(() => toast.error("Product not found"))
      .finally(() => setLoading(false));
  }, [id]);


  // 360° mouse move effect
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;

    const frame = Math.floor(percent * imgs.length);

    if (frame >= 0 && frame < imgs.length) {
      setActiveImg(frame);
    }
  };

 

  const handleChat = async () => {
    if (!user) {
      toast.error("Please login to chat with vendor");
      return navigate("/login");
    }
    if (user.role === "vendor")
      return toast.error("Vendors cannot initiate chats");
    try {
      setChatLoading(true);
      const { data } = await chatAPI.getOrCreate(id);
      navigate(`/chat/${data.conversation._id}`);
    } catch {
      toast.error("Failed to start conversation");
    } finally {
      setChatLoading(false);
    }
  };

  const handleReportListing = async () => {
    if (!user) {
      toast.error("Please login to report this listing");
      return navigate("/login");
    }

    const reason = prompt("Why are you reporting this listing?");
    if (!reason?.trim()) return;
    const details = prompt("Add any extra details (optional):") || "";

    try {
      await reportAPI.create({
        product: product._id,
        reportedUser: product.vendorUser?._id,
        reason,
        details,
      });
      toast.success("Report submitted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit report");
    }
  };

  if (loading)
    return (
      <div className="container py-5 text-center">
        <div
          className="spinner-border text-warning"
          style={{ width: 48, height: 48 }}
        ></div>
      </div>
    );

  if (!product)
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-box-seam display-1 text-muted"></i>
        <h4 className="mt-3">Product not found</h4>
        <Link to="/" className="btn btn-primary-custom mt-3">
          ← Browse Products
        </Link>
      </div>
    );

  const timer = getTimeLeft(product.expiresAt);

  const imgs = product?.images?.length
    ? product.images.map((i) => getUploadUrl(i))
    : [PLACEHOLDER];

  return (
    <div className="container py-4 py-md-5">
      <nav aria-label="breadcrumb" className="mb-4">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/">Home</Link>
          </li>
          <li className="breadcrumb-item">
            <Link to={`/?category=${product.category}`}>
              {product.category}
            </Link>
          </li>
          <li className="breadcrumb-item active">{product.title}</li>
        </ol>
      </nav>

      <div className="row g-4">
        {/* Gallery */}
        <div className="col-md-6">
  

      {/* Main Product Image */}
      <div
        className="product-gallery mb-3"
        onMouseMove={handleMouseMove}
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden",
          borderRadius: "12px",
          position: "relative",
          cursor: "grab",
          border: "1px solid #eee",
            height: "clamp(320px, 50vw, 540px)"

        }}
      >
        <img
          src={imgs[activeImg]}
          alt={product.title}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "opacity 0.2s ease",
            userSelect: "none",
            pointerEvents: "none"
          }}
          onError={(e) => (e.target.src = PLACEHOLDER)}
        />

 {/* Thumbnail Images */}
      {imgs.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "10px",
            alignItems:"center",
            justifyContent:"center"
          }}
        >
          {imgs.map((img, i) => (
            <img
              key={i}
              src={img}
              alt={`thumb-${i}`}
              onClick={() => setActiveImg(i)}
              style={{
                width: "100px",
                height: "100px",
                objectFit: "cover",
                borderRadius: "8px",
                cursor: "pointer",
                border: activeImg === i
                  ? "2px solid #FF6B35"
                  : "2px solid #ddd",
                transition: "all 0.2s ease"
              }}
              onError={(e) => (e.target.src = PLACEHOLDER)}
            />
          ))}
        </div>
      )}


      </div>


     
        </div>

        {/* Info */}
        <div className="col-md-6">
          <div
            className={`alert alert-${timer.cls} d-flex align-items-center gap-2 py-2 mb-3`}
          >
            <i className="bi bi-clock"></i>
            <strong>Listing expires in: {timer.text}</strong>
          </div>

          <span className="badge badge-category mb-2">{product.category}</span>
          {product.condition && (
            <span className="badge bg-info ms-2 mb-2">{product.condition}</span>
          )}

          <h2 className="fw-bold mb-2">{product.title}</h2>

          <div className="d-flex align-items-center gap-3 mb-3">
            <span className="display-6 fw-bold" style={{ color: "#FF6B35" }}>
              ₹{product.price?.toLocaleString()}
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <>
                <span className="fs-5 text-muted text-decoration-line-through">
                  ₹{product.originalPrice?.toLocaleString()}
                </span>
                <span className="badge bg-success">
                  {Math.round(
                    (1 - product.price / product.originalPrice) * 100,
                  )}
                  % OFF
                </span>
              </>
            )}
          </div>

          <p className="text-muted mb-4 lh-lg">{product.description}</p>

          {product.location && (
            <div className="d-flex align-items-center gap-2 mb-3 text-muted">
              <i
                className="bi bi-geo-alt-fill"
                style={{ color: "#FF6B35" }}
              ></i>
              <span>{product.location}</span>
            </div>
          )}

          <div className="d-flex align-items-center gap-2 mb-3 text-muted small">
            <i className="bi bi-eye"></i>
            <span>{product.views} views</span>
            <i className="bi bi-calendar3 ms-2"></i>
            <span>
              Listed {new Date(product.createdAt).toLocaleDateString()}
            </span>
          </div>

          <button
            className="btn btn-primary-custom btn-lg w-100 mb-3"
            onClick={handleChat}
            disabled={chatLoading}
          >
            {chatLoading ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : (
              <i className="bi bi-chat-dots-fill me-2"></i>
            )}
            {user?.role === "vendor"
              ? "Chat Not Available for Vendors"
              : "Chat with Vendor"}
          </button>
          <button
            className="btn btn-outline-danger btn-sm mb-3"
            onClick={handleReportListing}
          >
            <i className="bi bi-flag me-1"></i>Report listing
          </button>

          <div className="d-flex gap-2">
            <div
              className="flex-fill p-3 rounded-3 text-center small"
              style={{ background: "#fff8f4" }}
            >
              <i
                className="bi bi-shield-check fs-4 d-block mb-1"
                style={{ color: "#FF6B35" }}
              ></i>
              Verified Vendor
            </div>
            <div
              className="flex-fill p-3 rounded-3 text-center small"
              style={{ background: "#fff8f4" }}
            >
              <i
                className="bi bi-chat-dots fs-4 d-block mb-1"
                style={{ color: "#FF6B35" }}
              ></i>
              Direct Chat
            </div>
            <div
              className="flex-fill p-3 rounded-3 text-center small"
              style={{ background: "#fff8f4" }}
            >
              <i
                className="bi bi-geo-alt fs-4 d-block mb-1"
                style={{ color: "#FF6B35" }}
              ></i>
              Meetup Safe
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Info */}
      {product.vendor && (
        <div
          className="mt-5 p-4 rounded-4 border"
          style={{ background: "#fff8f4" }}
        >
          <h5 className="fw-bold mb-3">
            <i className="bi bi-shop me-2" style={{ color: "#FF6B35" }}></i>
            About the Seller
          </h5>
          <div className="d-flex gap-3 align-items-start flex-wrap">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
              style={{
                width: 60,
                height: 60,
                background: "linear-gradient(135deg,#FF6B35,#e55a24)",
                fontSize: "1.5rem",
              }}
            >
              {product.vendor.businessName?.charAt(0)}
            </div>
            <div className="flex-grow-1">
              <h6 className="fw-bold mb-1">{product.vendor.businessName}</h6>
              {product.vendor.rating > 0 && (
                <div className="text-warning mb-1">
                  {"★".repeat(Math.round(product.vendor.rating))}
                  {"☆".repeat(5 - Math.round(product.vendor.rating))}
                  <span className="text-muted ms-2 small">
                    ({product.vendor.totalReviews} reviews)
                  </span>
                </div>
              )}
              <p className="text-muted small mb-0">
                {product.vendor.businessDescription}
              </p>
              {product.vendor.businessAddress && (
                <small className="text-muted">
                  <i className="bi bi-geo-alt me-1"></i>
                  {product.vendor.businessAddress}
                </small>
              )}
            </div>
            <Link
              to={`/vendors/${product.vendor._id}`}
              className="btn btn-outline-warning btn-sm"
            >
              View Profile
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
