import React from "react";
import { SUPPORT_EMAIL } from "../config";

export default function PrivacyPolicy() {
  return (
    <main className="container py-5" style={{ maxWidth: 860 }}>
      <h1 className="fw-bold mb-3">Privacy Policy</h1>
      <p className="text-muted">Last updated: June 19, 2026</p>

      <p>
        GoodOne collects the information needed to run local marketplace
        accounts, listings, vendor profiles, chat features, safety tools, and
        mobile ads. This policy explains the main types of data we collect and
        how we use them.
      </p>

      <h5 className="fw-bold mt-4">Information We Collect</h5>
      <p>
        Account information may include your name, email address, phone number,
        password credentials, OTP verification status, and account role. Vendor
        information may include business name, category, description, address,
        live verification photo, and other business profile details.
      </p>
      <p>
        Marketplace content may include product listings, prices, descriptions,
        uploaded images, photos, videos, chat messages, conversation metadata,
        reports, blocks, and related records needed to operate the service and
        respond to abuse or support requests.
      </p>

      <h5 className="fw-bold mt-4">How We Use Information</h5>
      <p>
        We use account data to create and secure accounts, publish listings,
        manage vendor profiles, support buyer and vendor chat, send OTP and
        security messages, show uploaded marketplace content, process reports
        and blocks, provide support, prevent fraud and abuse, and operate and
        improve GoodOne.
      </p>

      <h5 className="fw-bold mt-4">Ads And Google Mobile Ads SDK</h5>
      <p>
        The GoodOne mobile app uses AdMob through the Google Mobile Ads SDK.
        Google may collect or receive device identifiers, approximate location,
        ad interaction data, diagnostics, and other data described in Google's
        advertising and SDK policies to provide, measure, personalize, and limit
        ads. Debug builds use Google test ad units; release builds use GoodOne's
        production AdMob IDs.
      </p>

      <h5 className="fw-bold mt-4">Meta SDK And App Events</h5>
      <p>
        The GoodOne Android app uses the Meta SDK for app measurement,
        attribution, and campaign effectiveness. Meta may receive app
        interaction and activation information, device and app information,
        diagnostics, network information, and identifiers where enabled and
        legally permitted.
      </p>
      <p>
        Advertiser-ID collection is controlled by app configuration and
        applicable privacy choices.
      </p>

      <h5 className="fw-bold mt-4">Account Deletion</h5>
      <p>
        You can delete your account from the account deletion page when logged
        in, or request deletion by email. Account deletion removes your account,
        vendor profile, listings, uploads, chats, and related marketplace data
        where possible. Some records may be retained when required for security,
        legal compliance, dispute handling, fraud prevention, or service
        integrity.
      </p>

      <h5 className="fw-bold mt-4">Contact</h5>
      <p>
        For privacy questions, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
