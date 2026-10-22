
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { couponAPI, productAPI } from "../api";
import toast from "react-hot-toast";
import "./CheckoutPage.css";

const money = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const productId = searchParams.get("productId");

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState([]);
const [couponsLoading, setCouponsLoading] = useState(true);
  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    productAPI
      .getOne(productId)
      .then(({ data }) => {
        if (!cancelled) setProduct(data.product);
      })
      .catch(() => {
        if (!cancelled) toast.error("Unable to load this product.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [productId]);
useEffect(() => {
  if (!productId) {
    setLoading(false);
    return;
  }

  let cancelled = false;

  productAPI
    .getOne(productId)
    .then(({ data }) => {
      if (!cancelled) setProduct(data.product);
    })
    .catch(() => {
      if (!cancelled) toast.error("Unable to load this product.");
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [productId]);

// ADD THE NEW EFFECT DIRECTLY HERE
useEffect(() => {
  let cancelled = false;

  couponAPI
    .getAvailable()
    .then(({ data }) => {
      if (!cancelled) {
        setAvailableCoupons(
          Array.isArray(data.coupons) ? data.coupons : []
        );
      }
    })
    .catch(() => {
      if (!cancelled) {
        setAvailableCoupons([]);
      }
    })
    .finally(() => {
      if (!cancelled) {
        setCouponsLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, []);


const applyCouponForCode = async (inputCode) => {
  const code = inputCode.trim().toUpperCase();

  if (!code) {
    toast.error("Enter a coupon code.");
    return;
  }

  if (subtotal <= 0) {
    toast.error("This product has an invalid price.");
    return;
  }

  setCouponCode(code);
  setCouponLoading(true);

  try {
    const { data } = await couponAPI.validate({
      code,
      purchaseAmount: subtotal,
    });

    const discount = Number(data.discount);
    const finalAmount = Number(data.finalAmount);

    if (
      !data.success ||
      !Number.isFinite(discount) ||
      !Number.isFinite(finalAmount) ||
      discount < 0 ||
      finalAmount < 0 ||
      discount > subtotal ||
      Math.abs(finalAmount - (subtotal - discount)) > 0.01
    ) {
      toast.error(data.message || "This coupon could not be applied.");
      return;
    }

    setAppliedCoupon({
      code,
      discount,
      finalAmount,
    });

    toast.success("Coupon applied successfully!");
  } catch (error) {
    toast.error(
      error.response?.data?.message ||
        "Unable to validate this coupon. Please try again."
    );
  } finally {
    setCouponLoading(false);
  }
};

const applyCoupon = () => applyCouponForCode(couponCode);

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-warning" />
        <p className="mt-3">Loading checkout...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container py-5 text-center">
        <h3>Checkout</h3>
        <p>Open checkout from a product listing to continue.</p>
        <Link to="/browse" className="btn btn-primary-custom">
          Browse products
        </Link>
      </div>
    );
  }

  const subtotal = Math.max(0, Number(product.price) || 0);
  const discount = appliedCoupon
  ? Math.min(subtotal, Number(appliedCoupon.discount) || 0)
  : 0;

const total = appliedCoupon
  ? Math.max(0, Number(appliedCoupon.finalAmount))
  : subtotal - discount;

  return (
    <main className="container py-4 py-md-5 goodone-checkout">
      <Link
        to={`/products/${product.id || product._id}`}
        className="checkout-back"
      >
        <i className="bi bi-arrow-left me-2" />
        Back to product
      </Link>

      <header className="my-4">
        <span className="checkout-eyebrow">GOODONE MARKETPLACE</span>
        <h1 className="fw-bold mt-2">Checkout</h1>
        <p className="text-muted">
          Review your product and available savings.
        </p>
      </header>

      <div className="row g-4">
        <section className="col-lg-7">
          <div className="checkout-card">
            <h5 className="fw-bold mb-3">Your product</h5>

            <div className="d-flex align-items-center gap-3">
              {product.images?.[0] && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  className="checkout-product-image"
                />
              )}

              <div className="flex-grow-1">
                <h6 className="fw-bold mb-1">{product.title}</h6>
                <p className="text-muted small mb-1">
                  {product.location || "Marketplace listing"}
                </p>
                <strong className="checkout-price">
                  {money(subtotal)}
                </strong>
              </div>
            </div>
          </div>

          <div className="checkout-card mt-3">
            <div className="d-flex align-items-center gap-3 mb-3">
              <div className="checkout-coupon-icon">
                <i className="bi bi-ticket-perforated" />
              </div>
              <div>
                <h5 className="fw-bold mb-1">Apply coupon</h5>
                <p className="text-muted small mb-0">
                  Using a coupon is completely optional.
                </p>
              </div>
            </div>

{couponsLoading ? (
  <p className="text-muted small mt-3">Loading available coupons...</p>
) : availableCoupons.length > 0 ? (
  <div className="checkout-available-coupons mt-3 mb-3">
    <p className="small fw-semibold mb-2">Available offers</p>
    {availableCoupons.map((coupon) => (
      <div className="checkout-offer" key={coupon.id}>
        <div>
          <strong>{coupon.code}</strong>
          <p className="small text-muted mb-1">
            {coupon.discountType === "percentage"
              ? `${coupon.discountValue}% off`
              : `${money(coupon.discountValue)} off`}
            {coupon.maxDiscount != null &&
            coupon.discountType === "percentage"
              ? ` · Max discount ${money(coupon.maxDiscount)}`
              : ""}
          </p>
          <p className="small text-muted mb-0">
            Minimum purchase: {money(coupon.minPurchase)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-primary btn-sm"
          disabled={couponLoading || Boolean(appliedCoupon)}
          onClick={() => {
            setCouponCode(coupon.code);
            applyCouponForCode(coupon.code);
          }}
        >
          Apply
        </button>
      </div>
    ))}
  </div>
) : (
  <p className="text-muted small mt-3">
    No available offers right now. You can still enter a coupon code.
  </p>
)}

            {appliedCoupon ? (
              <div className="checkout-applied-coupon">
                <div>
                  <strong>{appliedCoupon.code}</strong>
                  <p className="small mb-0">Coupon applied successfully</p>
                </div>
                <button
                  type="button"
                  className="btn btn-outline-danger btn-sm"
                  onClick={removeCoupon}
                >
                  Remove
                </button>
              </div>
            ) : (
              <form
                className="d-flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  applyCoupon();
                }}
              >
                <input
                  className="form-control checkout-coupon-input"
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value)}
                  placeholder="Enter coupon code"
                  maxLength={40}
                  aria-label="Coupon code"
                />
                <button
                  className="btn checkout-apply-btn"
                  type="submit"
                  disabled={couponLoading}
                >
                  {couponLoading ? "Checking..." : "Apply"}
                </button>
              </form>
            )}

            {!appliedCoupon && (
              <button
                type="button"
                className="checkout-skip"
                onClick={() => navigate(`/products/${product.id || product._id}`)}
              >
                Skip coupon and return to product
              </button>
            )}
          </div>
        </section>

        <aside className="col-lg-5">
          <div className="checkout-card checkout-summary">
            <h5 className="fw-bold mb-4">Payment summary</h5>

            <div className="checkout-summary-row">
              <span>Product price</span>
              <span>{money(subtotal)}</span>
            </div>

            <div className="checkout-summary-row">
              <span>Coupon discount</span>
              <span className={discount ? "checkout-discount" : ""}>
                {discount ? `−${money(discount)}` : money(0)}
              </span>
            </div>

            <hr />

            <div className="checkout-summary-row checkout-total">
              <strong>Total</strong>
              <strong>{money(total)}</strong>
            </div>

            <p className="text-muted small mt-3 mb-0">
              This is a price preview. Payment and order placement are not
              available yet.
            </p>

            <button
              type="button"
              className="btn checkout-continue-btn w-100 mt-3"
              onClick={() =>
                toast("Order placement will be implemented after coupon validation.")
              }
            >
              Continue
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
