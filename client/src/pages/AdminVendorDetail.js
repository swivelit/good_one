import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { productAPI, vendorAPI } from '../api';
import { LISTING_DURATION_OPTIONS, durationLabel } from '../constants/listingDurations';

const PROFILE_FIELDS = [
  'businessName',
  'businessDescription',
  'businessCategory',
  'businessAddress',
  'website',
  'logo',
  'coverImage',
  'isApproved',
  'verificationStatus',
];

const PRODUCT_FIELDS = [
  'title',
  'description',
  'price',
  'originalPrice',
  'category',
  'condition',
  'location',
];

const CONDITION_OPTIONS = ['new', 'like-new', 'good', 'fair', 'poor'];

const toProductId = (product) => product._id || product.id;

const buildProfileForm = (vendor = {}) => ({
  businessName: vendor.businessName || '',
  businessDescription: vendor.businessDescription || '',
  businessCategory: vendor.businessCategory || '',
  businessAddress: vendor.businessAddress || '',
  website: vendor.website || '',
  logo: vendor.logo || '',
  coverImage: vendor.coverImage || '',
  isApproved: Boolean(vendor.isApproved),
  verificationStatus: vendor.verificationStatus || '',
});

const buildProductForm = (product = {}) => ({
  title: product.title || '',
  description: product.description || '',
  price: product.price ?? '',
  originalPrice: product.originalPrice ?? '',
  category: product.category || '',
  condition: product.condition || 'good',
  location: product.location || '',
});

const getProductStatus = (product) => {
  const expiresAt = product.expiresAt ? new Date(product.expiresAt) : null;
  const now = new Date();
  if (!product.isActive || !expiresAt || expiresAt <= now) {
    return { label: 'Expired', className: 'bg-danger' };
  }
  if (expiresAt.getTime() - now.getTime() <= 6 * 60 * 60 * 1000) {
    return { label: 'Due soon', className: 'bg-warning text-dark' };
  }
  return { label: 'Active', className: 'bg-success' };
};

export default function AdminVendorDetail() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [profileForm, setProfileForm] = useState(buildProfileForm());
  const [productForms, setProductForms] = useState({});
  const [renewDurations, setRenewDurations] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingProductId, setSavingProductId] = useState(null);
  const [renewingProductId, setRenewingProductId] = useState(null);
  const [error, setError] = useState('');

  const loadVendor = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await vendorAPI.getAdminOne(id);
      const nextVendor = data.vendor || null;
      const nextProducts = Array.isArray(data.products)
        ? data.products
        : Array.isArray(nextVendor?.products)
          ? nextVendor.products
          : [];
      setVendor(nextVendor);
      setProducts(nextProducts);
      setProfileForm(buildProfileForm(nextVendor || {}));
      setProductForms(
        nextProducts.reduce((forms, product) => {
          forms[toProductId(product)] = buildProductForm(product);
          return forms;
        }, {})
      );
      setRenewDurations(
        nextProducts.reduce((durations, product) => {
          durations[toProductId(product)] = Number(product.durationHours) || 24;
          return durations;
        }, {})
      );
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to load vendor';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  const updateProfileField = (field, value) => {
    setProfileForm((current) => ({ ...current, [field]: value }));
  };

  const updateProductField = (productId, field, value) => {
    setProductForms((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] || {}),
        [field]: value,
      },
    }));
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    const payload = PROFILE_FIELDS.reduce((data, field) => {
      data[field] = profileForm[field];
      return data;
    }, {});

    try {
      setSavingProfile(true);
      await vendorAPI.updateAdminProfile(id, payload);
      toast.success('Vendor profile updated');
      await loadVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update vendor profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRenew = async (product) => {
    const productId = toProductId(product);
    const durationHours = Number(renewDurations[productId]) || 24;
    try {
      setRenewingProductId(productId);
      await productAPI.renew(productId, { durationHours });
      toast.success(`Product renewed for ${durationLabel(durationHours)}`);
      await loadVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to renew product');
    } finally {
      setRenewingProductId(null);
    }
  };

  const handleProductSave = async (product) => {
    const productId = toProductId(product);
    const form = productForms[productId] || {};
    const payload = PRODUCT_FIELDS.reduce((data, field) => {
      data[field] = form[field];
      return data;
    }, {});
    payload.price = payload.price === '' ? '' : Number(payload.price);
    payload.originalPrice =
      payload.originalPrice === '' ? '' : Number(payload.originalPrice);

    try {
      setSavingProductId(productId);
      await productAPI.update(productId, payload);
      toast.success('Product updated');
      await loadVendor();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update product');
    } finally {
      setSavingProductId(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="spinner-border text-warning" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          {error || 'Vendor not found'}
        </div>
        <Link to="/admin/vendors" className="btn btn-outline-secondary">
          Back to vendors
        </Link>
      </div>
    );
  }

  const owner = vendor.user || {};

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-4">
        <div>
          <Link to="/admin/vendors" className="btn btn-link px-0 text-decoration-none">
            <i className="bi bi-arrow-left me-1"></i>All vendors
          </Link>
          <h3 className="fw-bold mb-1">{vendor.businessName || 'Vendor profile'}</h3>
          <p className="text-muted small mb-0">
            Admin management · {products.length} listing{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link to={`/vendors/${vendor._id || vendor.id}`} className="btn btn-outline-secondary">
          <i className="bi bi-box-arrow-up-right me-1"></i>View Public Profile
        </Link>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
            <div className="card-body">
              <h5 className="fw-bold mb-3">Vendor Profile</h5>
              <form onSubmit={handleProfileSave}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-business-name">
                      Business name
                    </label>
                    <input
                      id="admin-business-name"
                      className="form-control"
                      value={profileForm.businessName}
                      onChange={(event) => updateProfileField('businessName', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-business-category">
                      Business category
                    </label>
                    <input
                      id="admin-business-category"
                      className="form-control"
                      value={profileForm.businessCategory}
                      onChange={(event) => updateProfileField('businessCategory', event.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold" htmlFor="admin-business-description">
                      Description
                    </label>
                    <textarea
                      id="admin-business-description"
                      className="form-control"
                      rows={3}
                      value={profileForm.businessDescription}
                      onChange={(event) => updateProfileField('businessDescription', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-business-address">
                      Address
                    </label>
                    <input
                      id="admin-business-address"
                      className="form-control"
                      value={profileForm.businessAddress}
                      onChange={(event) => updateProfileField('businessAddress', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-website">
                      Website
                    </label>
                    <input
                      id="admin-website"
                      className="form-control"
                      value={profileForm.website}
                      onChange={(event) => updateProfileField('website', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-logo">
                      Logo
                    </label>
                    <input
                      id="admin-logo"
                      className="form-control"
                      value={profileForm.logo}
                      onChange={(event) => updateProfileField('logo', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-cover-image">
                      Cover image
                    </label>
                    <input
                      id="admin-cover-image"
                      className="form-control"
                      value={profileForm.coverImage}
                      onChange={(event) => updateProfileField('coverImage', event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-is-approved">
                      Approval
                    </label>
                    <select
                      id="admin-is-approved"
                      className="form-select"
                      value={profileForm.isApproved ? 'true' : 'false'}
                      onChange={(event) => updateProfileField('isApproved', event.target.value === 'true')}
                    >
                      <option value="true">Approved</option>
                      <option value="false">Not approved</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold" htmlFor="admin-verification-status">
                      Verification status
                    </label>
                    <input
                      id="admin-verification-status"
                      className="form-control"
                      value={profileForm.verificationStatus}
                      onChange={(event) => updateProfileField('verificationStatus', event.target.value)}
                    />
                  </div>
                </div>
                <button className="btn btn-primary-custom mt-3" type="submit" disabled={savingProfile}>
                  {savingProfile ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="bi bi-check-circle me-2"></i>
                  )}
                  Save profile
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100" style={{ borderRadius: 12 }}>
            <div className="card-body">
              <h5 className="fw-bold mb-3">Owner Contact</h5>
              <ul className="list-unstyled small mb-0">
                <li className="mb-2">
                  <i className="bi bi-person me-2 text-muted"></i>
                  <span className="fw-semibold">Name:</span> {owner.name || '—'}
                </li>
                <li className="mb-2">
                  <i className="bi bi-envelope me-2 text-muted"></i>
                  <span className="fw-semibold">Email:</span> {owner.email || '—'}
                </li>
                <li className="mb-2">
                  <i className="bi bi-telephone me-2 text-muted"></i>
                  <span className="fw-semibold">Phone:</span> {owner.phone || '—'}
                </li>
                <li className="mb-2">
                  <i className="bi bi-calendar3 me-2 text-muted"></i>
                  <span className="fw-semibold">Joined:</span>{' '}
                  {owner.createdAt ? new Date(owner.createdAt).toLocaleDateString() : '—'}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: 12 }}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3">
            <h5 className="fw-bold mb-0">Listings</h5>
            <div className="d-flex gap-2 small flex-wrap">
              <span className="badge bg-success">Active</span>
              <span className="badge bg-warning text-dark">Due soon</span>
              <span className="badge bg-danger">Expired</span>
            </div>
          </div>

          {products.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-6 d-block mb-2"></i>
              No products found for this vendor.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 260 }}>Product</th>
                    <th style={{ minWidth: 220 }}>Pricing</th>
                    <th>Status</th>
                    <th style={{ minWidth: 210 }}>Renew</th>
                    <th style={{ minWidth: 180 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const productId = toProductId(product);
                    const form = productForms[productId] || buildProductForm(product);
                    const status = getProductStatus(product);

                    return (
                      <tr key={productId}>
                        <td>
                          <label className="form-label small fw-semibold" htmlFor={`product-title-${productId}`}>
                            Product title
                          </label>
                          <input
                            id={`product-title-${productId}`}
                            aria-label={`Product title for ${product.title}`}
                            className="form-control form-control-sm mb-2"
                            value={form.title}
                            onChange={(event) => updateProductField(productId, 'title', event.target.value)}
                          />
                          <label className="form-label small fw-semibold" htmlFor={`product-description-${productId}`}>
                            Description
                          </label>
                          <textarea
                            id={`product-description-${productId}`}
                            aria-label={`Product description for ${product.title}`}
                            className="form-control form-control-sm mb-2"
                            rows={2}
                            value={form.description}
                            onChange={(event) => updateProductField(productId, 'description', event.target.value)}
                          />
                          <div className="row g-2">
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold" htmlFor={`product-category-${productId}`}>
                                Category
                              </label>
                              <input
                                id={`product-category-${productId}`}
                                aria-label={`Product category for ${product.title}`}
                                className="form-control form-control-sm"
                                value={form.category}
                                onChange={(event) => updateProductField(productId, 'category', event.target.value)}
                              />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold" htmlFor={`product-condition-${productId}`}>
                                Condition
                              </label>
                              <select
                                id={`product-condition-${productId}`}
                                aria-label={`Product condition for ${product.title}`}
                                className="form-select form-select-sm"
                                value={form.condition}
                                onChange={(event) => updateProductField(productId, 'condition', event.target.value)}
                              >
                                {CONDITION_OPTIONS.map((condition) => (
                                  <option key={condition} value={condition}>
                                    {condition}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-4">
                              <label className="form-label small fw-semibold" htmlFor={`product-location-${productId}`}>
                                Location
                              </label>
                              <input
                                id={`product-location-${productId}`}
                                aria-label={`Product location for ${product.title}`}
                                className="form-control form-control-sm"
                                value={form.location}
                                onChange={(event) => updateProductField(productId, 'location', event.target.value)}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <label className="form-label small fw-semibold" htmlFor={`product-price-${productId}`}>
                            Price
                          </label>
                          <input
                            id={`product-price-${productId}`}
                            aria-label={`Product price for ${product.title}`}
                            className="form-control form-control-sm mb-2"
                            type="number"
                            min="0"
                            value={form.price}
                            onChange={(event) => updateProductField(productId, 'price', event.target.value)}
                          />
                          <label className="form-label small fw-semibold" htmlFor={`product-original-price-${productId}`}>
                            Original price
                          </label>
                          <input
                            id={`product-original-price-${productId}`}
                            aria-label={`Original price for ${product.title}`}
                            className="form-control form-control-sm"
                            type="number"
                            min="0"
                            value={form.originalPrice}
                            onChange={(event) => updateProductField(productId, 'originalPrice', event.target.value)}
                          />
                          <div className="small text-muted mt-2">
                            Views: {product.views || 0} · Renewed {product.renewalCount || 0} time
                            {(product.renewalCount || 0) === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${status.className}`}>{status.label}</span>
                          <div className="small text-muted mt-2">
                            Expires:{' '}
                            {product.expiresAt ? new Date(product.expiresAt).toLocaleString() : '—'}
                          </div>
                          <div className="small text-muted">
                            Duration: {durationLabel(product.durationHours)}
                          </div>
                        </td>
                        <td>
                          <label className="form-label small fw-semibold" htmlFor={`renew-duration-${productId}`}>
                            Renewal duration
                          </label>
                          <select
                            id={`renew-duration-${productId}`}
                            aria-label={`Renewal duration for ${product.title}`}
                            className="form-select form-select-sm mb-2"
                            value={renewDurations[productId] || 24}
                            onChange={(event) =>
                              setRenewDurations((current) => ({
                                ...current,
                                [productId]: Number(event.target.value),
                              }))
                            }
                          >
                            {LISTING_DURATION_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success w-100"
                            onClick={() => handleRenew(product)}
                            disabled={renewingProductId === productId}
                          >
                            {renewingProductId === productId ? (
                              <span className="spinner-border spinner-border-sm me-2"></span>
                            ) : (
                              <i className="bi bi-arrow-repeat me-1"></i>
                            )}
                            Renew
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary-custom w-100 mb-2"
                            onClick={() => handleProductSave(product)}
                            disabled={savingProductId === productId}
                          >
                            {savingProductId === productId ? (
                              <span className="spinner-border spinner-border-sm me-2"></span>
                            ) : (
                              <i className="bi bi-save me-1"></i>
                            )}
                            Save product
                          </button>
                          <Link
                            to={`/products/${productId}`}
                            className="btn btn-sm btn-outline-secondary w-100"
                          >
                            View listing
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
