import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../api";
import { useAuth } from "../AuthContext";

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      phone: user?.phone || "",
    });
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      const { data } = await authAPI.updateMe({
        name: form.name,
        phone: form.phone,
      });
      updateUser(data.user);
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success("Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="profile-page container py-4 py-md-5">
      <div className="profile-card bg-white border-0 shadow-sm">
        <div className="profile-card-header">
          <div>
            <span className="text-uppercase small fw-bold text-muted">Account</span>
            <h1 className="h4 fw-bold mb-1">My Profile</h1>
            <p className="text-muted mb-0">
              Update your name and contact number. Your email is read-only.
            </p>
          </div>
          <div className="profile-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || "G"}
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="profile-name">
                Name
              </label>
              <input
                id="profile-name"
                name="name"
                className="form-control"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="profile-phone">
                Contact number
              </label>
              <input
                id="profile-phone"
                name="phone"
                className="form-control"
                value={form.phone}
                onChange={handleChange}
                inputMode="tel"
                placeholder="Optional"
              />
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="profile-email">
                Email
              </label>
              <input
                id="profile-email"
                className="form-control"
                value={user?.email || ""}
                readOnly
              />
              <small className="text-muted">Email changes require OTP verification.</small>
            </div>

            <div className="col-md-6">
              <label className="form-label fw-semibold" htmlFor="profile-role">
                Role
              </label>
              <input
                id="profile-role"
                className="form-control text-capitalize"
                value={user?.role || ""}
                readOnly
              />
            </div>
          </div>

          <div className="profile-actions">
            <button className="btn btn-primary-custom px-4" type="submit" disabled={saving}>
              {saving ? (
                <span className="spinner-border spinner-border-sm me-2" />
              ) : (
                <i className="bi bi-check2-circle me-2"></i>
              )}
              Save Profile
            </button>
            <button className="btn btn-outline-secondary" type="button" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right me-2"></i>
              Logout
            </button>
            <Link className="btn btn-link text-danger ms-md-auto" to="/account-deletion">
              Delete account
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
