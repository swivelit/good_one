import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authAPI } from "../api";
import { useAuth } from "../AuthContext";
import toast from "react-hot-toast";
import { FaEye, FaEyeSlash } from "react-icons/fa";

const CATEGORIES = [
  "Electronics",
  "Mobiles",
  "Furniture",
  "Clothing",
  "Books",
  "Sports",
  "Home & Garden",
  "Vehicles",
  "Food",
  "Other",
];

export default function RegisterVendor() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessDescription: "",
    businessCategory: "Electronics",
    businessAddress: "",
  });
  
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
 
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [timer, setTimer] = useState(30);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const otpRefs = useRef([]);
  const { login } = useAuth();
  const navigate = useNavigate();

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      streamRef.current = stream;

      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 200);
    } catch (error) {
      console.error(error);
      toast.error("Cannot access camera");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || video.readyState !== 4) {
      toast.error("Camera still loading...");
      return;
    }

    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("Capture failed");
        return;
      }

      const url = URL.createObjectURL(blob);
      setCapturedPhoto(url);

      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      setPhotoFile(file);

      stopCamera();
    });
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

 
  //   e.preventDefault();
  //   if (form.password !== form.confirmPassword)
  //     return toast.error("Passwords do not match");
  //   if (!capturedPhoto)
  //     return toast.error("Live photo verification is required");
  //   try {
  //     setLoading(true);
  //     const fd = new FormData();
  //     Object.entries(form).forEach(([k, v]) => {
  //       if (k !== "confirmPassword") fd.append(k, v);
  //     });
  //     if (photoFile) fd.append("livePhoto", photoFile);
  //     const { data } = await authAPI.registerVendor(fd);
  //     setUserId(data.userId);
  //     setDemoOtp(data.otp);
  //     setStep(3);
  //     toast.success("Almost done! Verify your OTP.");
  //   } catch (err) {
  //     toast.error(err.response?.data?.message || "Registration failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword)
      return toast.error("Passwords do not match");

    if (!capturedPhoto)
      return toast.error("Live photo verification is required");

    try {
      setLoading(true);

      // 👉 Send OTP first
      await authAPI.sendOtp({ email: form.email });

      toast.success("OTP sent to your email");

      setStep(3); // move to OTP screen
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

 
  //   e.preventDefault();

  //   if (form.password !== form.confirmPassword)
  //     return toast.error("Passwords do not match");

  //   if (!capturedPhoto)
  //     return toast.error("Live photo verification is required");

  //   try {
  //     setLoading(true);

  //     const fd = new FormData();

  //     Object.entries(form).forEach(([k, v]) => {
  //       if (k !== "confirmPassword") fd.append(k, v);
  //     });

  //     if (photoFile) fd.append("livePhoto", photoFile);

  //     const { data } = await authAPI.registerVendor(fd);

  //     // Direct login after registration
  //     login(data.token, data.user, data.vendorProfile);

  //     toast.success("Vendor account created successfully!");

  //     navigate("/dashboard");

  //   } catch (err) {
  //     toast.error(err.response?.data?.message || "Registration failed");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const n = [...otp];
    n[index] = value;
    setOtp(n);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (!value && index > 0) otpRefs.current[index - 1]?.focus();
  };

 

  const handleVerifyOTP = async (e) => {
    e.preventDefault();

    const otpStr = otp.join("");

    if (otpStr.length < 6) return toast.error("Enter complete 6-digit OTP");

    try {
      setLoading(true);

      const fd = new FormData();

      // 👉 append all form data
      Object.entries(form).forEach(([k, v]) => {
        if (k !== "confirmPassword") fd.append(k, v);
      });

      fd.append("otp", otpStr);

      if (photoFile) fd.append("livePhoto", photoFile);

      const { data } = await authAPI.registerVendor(fd);

      login(data.token, data.user, data.vendor);

      toast.success("Vendor account created successfully!");

      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try {
      await authAPI.resendOtp({ email: form.email });

      toast.success("OTP resent successfully");

      setTimer(30); // reset timer
    } catch (err) {
      toast.error(err.response?.data?.message || "Try again later");
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (step === 3 && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, timer]);

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: step === 2 ? 520 : 460 }}>
        <div className="auth-header">
          <i className="bi bi-shop display-5 mb-2 d-block"></i>
          <h4 className="fw-bold mb-1">Become a Vendor on GoodOne</h4>
          <p className="opacity-80 mb-0 small">
            Verified sellers get more trust & visibility
          </p>
          <div className="d-flex justify-content-center gap-2 mt-3 flex-wrap">
            {["1. Account", "2. Live Verify", "3. OTP"].map((label, i) => (
              <div
                key={i}
                className="rounded-pill px-3 py-1 small fw-semibold"
                style={{
                  background: step >= i + 1 ? "#fff" : "rgba(255,255,255,0.3)",
                  color: step >= i + 1 ? "#FF6B35" : "#fff",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="auth-body">
          {/* Step 1: Business Details */}
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep(2);
              }}
            >
              <div className="row g-3 mb-3">
                <div className="col-12">
                  <label className="form-label small fw-semibold">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder="Your full name"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="your@email.com"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Phone</label>
                  <input
                    type="tel"
                    className="form-control"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="+91 9876543210"
                  />
                </div>
                <div className="col-md-6 position-relative">
        <label className="form-label small fw-semibold">
          Password *
        </label>

        <input
          type={showPassword ? "text" : "password"}
          className="form-control pe-5"
          value={form.password}
          onChange={(e) =>
            setForm({ ...form, password: e.target.value })
          }
          required
        />

        <span
          onClick={() => setShowPassword(!showPassword)}
          style={{
            position: "absolute",
            top: "38px",
            right: "15px",
            cursor: "pointer",
          }}
        >
          {showPassword ? <FaEyeSlash /> : <FaEye />}
        </span>
      </div>

      <div className="col-md-6 position-relative">
        <label className="form-label small fw-semibold">
          Confirm Password *
        </label>

        <input
          type={showConfirmPassword ? "text" : "password"}
          className="form-control pe-5"
          value={form.confirmPassword}
          onChange={(e) =>
            setForm({ ...form, confirmPassword: e.target.value })
          }
          required
        />

        <span
          onClick={() =>
            setShowConfirmPassword(!showConfirmPassword)
          }
          style={{
            position: "absolute",
            top: "38px",
            right: "15px",
            cursor: "pointer",
          }}
        >
          {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
        </span>
      </div>
              </div>
              <hr />
              <div className="row g-3 mb-4">
                <div className="col-12">
                  <label className="form-label small fw-semibold">
                    Business Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.businessName}
                    onChange={(e) =>
                      setForm({ ...form, businessName: e.target.value })
                    }
                    required
                    placeholder="e.g. Raj Electronics"
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Category *
                  </label>
                  <select
                    className="form-select"
                    value={form.businessCategory}
                    onChange={(e) =>
                      setForm({ ...form, businessCategory: e.target.value })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">
                    Business Address
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={form.businessAddress}
                    onChange={(e) =>
                      setForm({ ...form, businessAddress: e.target.value })
                    }
                    placeholder="City, Area"
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">
                    Business Description
                  </label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={form.businessDescription}
                    onChange={(e) =>
                      setForm({ ...form, businessDescription: e.target.value })
                    }
                    placeholder="Brief description of your business..."
                  />
                </div>
              </div>
              <button
                type="submit"
                className="btn btn-primary-custom w-100 py-2"
              >
                <i className="bi bi-arrow-right me-2"></i>Next: Live
                Verification
              </button>
            </form>
          )}

          {/* Step 2: Live Photo */}
          {step === 2 && (
            <div>
              <div className="text-center mb-3">
                <i
                  className="bi bi-camera-video display-5"
                  style={{ color: "#FF6B35" }}
                ></i>
                <h6 className="fw-bold mt-2">Live Photo Verification</h6>
                <p className="text-muted small">
                  Take a live selfie to verify your identity as a vendor
                </p>
              </div>

              {!capturedPhoto ? (
                <div
                  className="webcam-container mb-3 position-relative"
                  style={{ background: "#000", minHeight: 240 }}
                >
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        width="100%"
                        height="240"
                      />

                      <canvas ref={canvasRef} style={{ display: "none" }} />
                      <div className="webcam-overlay"></div>
                      {/* <canvas ref={canvasRef} className="d-none" /> */}
                      <canvas ref={canvasRef} style={{ display: "none" }} />
                    </>
                  ) : (
                    <div className="d-flex flex-column align-items-center justify-content-center text-white py-5">
                      <i className="bi bi-camera display-4 mb-2 opacity-50"></i>
                      <p className="small opacity-75">
                        Camera preview will appear here
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center mb-3">
                  <img
                    src={capturedPhoto}
                    alt="Live Photo"
                    className="rounded-3 img-fluid mb-2"
                    style={{ maxHeight: 220, border: "3px solid #FF6B35" }}
                  />
                  <div
                    className="badge"
                    style={{ background: "#d1fae5", color: "#065f46" }}
                  >
                    <i className="bi bi-check-circle me-1"></i>Photo captured
                    successfully
                  </div>
                </div>
              )}

              <div className="d-flex gap-2 flex-wrap mb-4">
                {!cameraActive && !capturedPhoto && (
                  <button
                    type="button"
                    className="btn btn-primary-custom flex-fill"
                    onClick={startCamera}
                  >
                    <i className="bi bi-camera me-2"></i>Open Camera
                  </button>
                )}
                {cameraActive && (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary-custom flex-fill"
                      onClick={capturePhoto}
                    >
                      <i className="bi bi-camera-fill me-2"></i>Capture Photo
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={stopCamera}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {capturedPhoto && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary flex-fill"
                    onClick={() => {
                      setCapturedPhoto(null);
                      setPhotoFile(null);
                      startCamera();
                    }}
                  >
                    <i className="bi bi-arrow-repeat me-2"></i>Retake
                  </button>
                )}
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  className="btn btn-primary-custom flex-fill"
                  onClick={handleRegister}
                  disabled={loading || !capturedPhoto}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="bi bi-check-circle me-2"></i>
                  )}
                  Complete Registration
                </button>
              </div>
            </div>
          )}

          {/* Step 3: OTP Verification */}
          {step === 3 && (
            <form onSubmit={handleVerifyOTP}>
              <div className="text-center mb-4">
                <i
                  className="bi bi-shield-check display-4"
                  style={{ color: "#FF6B35" }}
                ></i>

                <h6 className="fw-bold mt-2">Verify Your Account</h6>

                <p className="text-muted small">
                  Enter the 6-digit OTP sent to your email
                </p>
              </div>

              {/* OTP Inputs */}
              <div className="d-flex justify-content-center gap-2 mb-3">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    className="otp-input form-control text-center"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    inputMode="numeric"
                    style={{ width: "45px", height: "45px", fontSize: "18px" }}
                  />
                ))}
              </div>

              {/* ✅ Resend OTP Button */}
              <div className="text-center mb-3">
                <button
                  type="button"
                  className="btn btn-link"
                  disabled={timer > 0}
                  onClick={handleResendOtp}
                >
                  {timer > 0 ? `Resend OTP in ${timer}s` : "Resend OTP"}
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="btn btn-primary-custom w-100 py-2"
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner-border spinner-border-sm me-2"></span>
                ) : (
                  <i className="bi bi-check-circle me-2"></i>
                )}
                Verify & Start Selling!
              </button>
            </form>
          )}

          <div className="text-center mt-3">
            <small className="text-muted">
              Already a vendor? <Link to="/login">Sign in</Link>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
