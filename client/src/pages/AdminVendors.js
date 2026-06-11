import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vendorAPI } from '../api';
import { getUploadUrl } from '../config';
import toast from 'react-hot-toast';

export default function AdminVendors() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const { data } = await vendorAPI.getAllAdmin();
        if (!active) return;
        setVendors(Array.isArray(data.vendors) ? data.vendors : []);
      } catch (err) {
        if (!active) return;
        const message = err.response?.data?.message || 'Failed to load vendors';
        setError(message);
        toast.error(message);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '60vh' }}
      >
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-people me-2"></i>All Vendors
          </h3>
          <p className="text-muted mb-0 small">
            Admin view · {vendors.length} vendor{vendors.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center text-muted py-5">
          <i className="bi bi-shop display-5 d-block mb-2"></i>
          <p className="mb-0">No vendors found.</p>
        </div>
      ) : (
        <div className="row g-3">
          {vendors.map((vendor) => {
            const owner = vendor.user || {};
            const logo = getUploadUrl(vendor.logo || owner.avatar);
            return (
              <div className="col-12 col-md-6 col-lg-4" key={vendor._id || vendor.id}>
                <div className="card h-100 shadow-sm border-0" style={{ borderRadius: 12 }}>
                  <div className="card-body">
                    <div className="d-flex align-items-center gap-3 mb-3">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                        style={{
                          width: 48,
                          height: 48,
                          background: 'linear-gradient(135deg,#FF6B35,#e55a24)',
                          overflow: 'hidden',
                        }}
                      >
                        {logo ? (
                          <img
                            src={logo}
                            alt={vendor.businessName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          (vendor.businessName || owner.name || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <h6 className="fw-bold mb-0 text-truncate">
                          {vendor.businessName || 'Unnamed business'}
                        </h6>
                        <span className="text-muted small">
                          {vendor.businessCategory || 'No category'}
                        </span>
                      </div>
                    </div>

                    <ul className="list-unstyled small mb-0">
                      <li className="mb-1">
                        <i className="bi bi-person me-2 text-muted"></i>
                        <span className="fw-semibold">Owner:</span>{' '}
                        {owner.name || '—'}
                      </li>
                      <li className="mb-1">
                        <i className="bi bi-envelope me-2 text-muted"></i>
                        <span className="fw-semibold">Email:</span>{' '}
                        {owner.email || '—'}
                      </li>
                      <li className="mb-1">
                        <i className="bi bi-telephone me-2 text-muted"></i>
                        <span className="fw-semibold">Phone:</span>{' '}
                        {owner.phone || '—'}
                      </li>
                      {vendor.businessAddress && (
                        <li className="mb-1">
                          <i className="bi bi-geo-alt me-2 text-muted"></i>
                          <span className="fw-semibold">Address:</span>{' '}
                          {vendor.businessAddress}
                        </li>
                      )}
                      {vendor.website && (
                        <li className="mb-1">
                          <i className="bi bi-globe me-2 text-muted"></i>
                          <span className="fw-semibold">Website:</span>{' '}
                          {vendor.website}
                        </li>
                      )}
                      {vendor.businessDescription && (
                        <li className="mb-1 text-muted">
                          <i className="bi bi-card-text me-2"></i>
                          {vendor.businessDescription}
                        </li>
                      )}
                      <li className="mb-1">
                        <i className="bi bi-box-seam me-2 text-muted"></i>
                        <span className="fw-semibold">Products:</span>{' '}
                        {vendor.totalProducts ?? 0}
                      </li>
                      <li className="mb-1">
                        <i className="bi bi-patch-check me-2 text-muted"></i>
                        <span className="fw-semibold">Status:</span>{' '}
                        {vendor.verificationStatus || (vendor.isApproved ? 'approved' : 'pending')}
                      </li>
                    </ul>
                    <div className="d-flex gap-2 flex-wrap mt-3">
                      <Link
                        className="btn btn-sm btn-primary-custom"
                        to={`/admin/vendors/${vendor._id || vendor.id}`}
                      >
                        <i className="bi bi-sliders me-1"></i>Manage
                      </Link>
                      <Link
                        className="btn btn-sm btn-outline-secondary"
                        to={`/vendors/${vendor._id || vendor.id}`}
                      >
                        <i className="bi bi-box-arrow-up-right me-1"></i>View Public Profile
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
