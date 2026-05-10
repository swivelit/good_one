import React from "react";
import { SUPPORT_EMAIL } from "../config";

export default function TermsOfUse() {
  return (
    <main className="container py-5" style={{ maxWidth: 860 }}>
      <h1 className="fw-bold mb-3">Terms of Use</h1>
      <p className="text-muted">Last updated: May 10, 2026</p>

      <p>
        GoodOne is a local marketplace for buyers and registered vendors. By
        using GoodOne, you agree to use the service lawfully, honestly, and in a
        way that protects other users and the marketplace.
      </p>

      <h5 className="fw-bold mt-4">Marketplace Rules</h5>
      <p>
        You may not list, request, promote, or sell illegal goods, restricted
        goods, stolen items, counterfeit items, regulated products, or anything
        that requires permissions you do not have. Listings must be accurate,
        current, and not misleading.
      </p>
      <p>
        You may not use GoodOne for scams, spam, impersonation, phishing,
        payment fraud, harassment, hateful content, threats, abuse, unsafe
        content, sexual exploitation, or any activity that harms users or the
        marketplace.
      </p>

      <h5 className="fw-bold mt-4">Listings, Chats, And Uploads</h5>
      <p>
        You are responsible for the product listings, business details, photos,
        videos, messages, and other content you submit. Do not upload content
        that violates another person's rights, exposes private information
        without permission, or misrepresents a product, price, vendor, or offer.
      </p>

      <h5 className="fw-bold mt-4">Reports And Blocks</h5>
      <p>
        Users can report listings or conversations and block users where those
        tools are available. GoodOne may review reports, limit features, remove
        content, suspend accounts, or delete accounts that violate these terms
        or create safety, legal, or marketplace integrity risks.
      </p>

      <h5 className="fw-bold mt-4">Contact</h5>
      <p>
        For questions about these terms, contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>
    </main>
  );
}
