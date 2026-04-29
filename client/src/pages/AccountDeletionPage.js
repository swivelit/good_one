import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { authAPI } from "../api";
import { useAuth } from "../AuthContext";
import { SUPPORT_EMAIL } from "../config";

export default function AccountDeletionPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "This will permanently delete your GoodOne account, profile, listings, uploads, and conversations where possible. Continue?"
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      await authAPI.deleteMe();
      logout();
      localStorage.removeItem("token");
      toast.success("Account deleted successfully");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="container py-5" style={{ maxWidth: 760 }}>
      <h1 className="fw-bold mb-3">Delete Account</h1>

      {user ? (
        <>
          <div className="alert alert-danger">
            <strong>This action is permanent.</strong> Deleting your account will
            remove your GoodOne account and related marketplace data where
            possible. You will need to create a new account to use GoodOne again.
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <span className="spinner-border spinner-border-sm me-2"></span>
            ) : (
              <i className="bi bi-trash me-2"></i>
            )}
            Delete My Account
          </button>
        </>
      ) : (
        <div className="alert alert-info">
          Please <Link to="/login">login</Link> first to delete your account, or
          contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>{" "}
          from the email address tied to your account.
        </div>
      )}
    </main>
  );
}
