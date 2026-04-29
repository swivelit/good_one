import React from "react";
import { SUPPORT_EMAIL } from "../config";

export default function PrivacyPolicy() {
  return (
    <main className="container py-5" style={{ maxWidth: 860 }}>
      <h1 className="fw-bold mb-3">Privacy Policy</h1>
      <p className="text-muted">Last updated: April 30, 2026</p>

      <p>
        GoodOne collects the information needed to run local marketplace accounts,
        listings, and chat features. This may include your name, email address,
        phone number, vendor details, product listings, uploaded images, and
        messages sent through the app.
      </p>

      <h5 className="fw-bold mt-4">How Information Is Used</h5>
      <p>
        We use account data to create and secure accounts, publish listings,
        support buyer and vendor chat, send OTP and security messages, provide
        support, and operate the GoodOne service.
      </p>

      <h5 className="fw-bold mt-4">Account Deletion</h5>
      <p>
        Users can request or delete their account from the account deletion page.
        Deleting an account removes the account and related local marketplace
        data where possible.
      </p>

      <h5 className="fw-bold mt-4">Contact</h5>
      <p>
        For privacy questions, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <div className="alert alert-warning mt-4">
        App owner note: replace this placeholder policy and contact email with
        your real legal, privacy, and support details before publishing.
      </div>
    </main>
  );
}
