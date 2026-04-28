import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { vendorAPI, chatAPI } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard from '../productCard';
import toast from 'react-hot-toast';

export default function VendorProfile() {
  const { id } = useParams();
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    vendorAPI.getOne(id)
      .then(({ data }) => { setVendor(data.vendor); setProducts(data.products); })
      .catch(() => toast.error('Vendor not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container py-5 text-center"><div className="spinner-border text-warning"></div></div>;
  if (!vendor) return <div className="container py-5 text-center"><h4>Vendor not found</h4></div>;

  return (
    <div className="container py-4 py-md-5">
      {/* Cover / Banner */}
      <div className="rounded-4 mb-4 d-flex align-items-end p-4"
        style={{background:'linear-gradient(135deg,#FF6B35,#2C3E50)',minHeight:160,position:'relative'}}>
        <div className="d-flex align-items-end gap-3 flex-wrap">
          <div className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold shadow"
            style={{width:80,height:80,background:'#fff',fontSize:'2rem',color:'#FF6B35',border:'4px solid #FF6B35'}}>
            {vendor.businessName?.charAt(0)}
          </div>
          <div className="text-white">
            <h3 className="fw-bold mb-1">{vendor.businessName}</h3>
            <div className="d-flex flex-wrap gap-3 opacity-90 small">
              {vendor.businessCategory && <span><i className="bi bi-tag me-1"></i>{vendor.businessCategory}</span>}
              {vendor.businessAddress && <span><i className="bi bi-geo-alt me-1"></i>{vendor.businessAddress}</span>}
              {vendor.user?.createdAt && <span><i className="bi bi-calendar3 me-1"></i>Since {new Date(vendor.user.createdAt).getFullYear()}</span>}
            </div>
          </div>
          <div className="ms-auto d-flex gap-2 flex-wrap">
            {vendor.rating > 0 && (
              <div className="bg-white rounded-3 px-3 py-2 text-center">
                <div className="fw-bold fs-5" style={{color:'#FF6B35'}}>{vendor.rating.toFixed(1)}</div>
                <div className="text-warning small">{'★'.repeat(Math.round(vendor.rating))}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="row g-3 mb-4">
        {[
          { label: 'Active Products', value: products.length, icon: 'bi-grid-fill', color: '#FF6B35' },
          { label: 'Total Reviews', value: vendor.totalReviews || 0, icon: 'bi-star-fill', color: '#f59e0b' },
          { label: 'Verified', value: vendor.verificationStatus === 'verified' ? '✓ Yes' : 'Pending', icon: 'bi-shield-check', color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="col-4">
            <div className="text-center p-3 rounded-3 bg-white shadow-sm">
              <i className={`bi ${s.icon} fs-4 d-block mb-1`} style={{color:s.color}}></i>
              <div className="fw-bold">{s.value}</div>
              <small className="text-muted">{s.label}</small>
            </div>
          </div>
        ))}
      </div>

      {/* About */}
      {vendor.businessDescription && (
        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body p-4">
            <h6 className="fw-bold mb-2">About</h6>
            <p className="text-muted mb-0 lh-lg">{vendor.businessDescription}</p>
          </div>
        </div>
      )}

      {/* Products */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Active Listings ({products.length})</h5>
      </div>
      {products.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-inbox display-1 text-muted"></i>
          <h5 className="mt-3 text-muted">No active listings</h5>
        </div>
      ) : (
        <div className="row g-3 g-md-4">
          {products.map(p => (
            <div key={p._id} className="col-6 col-md-4 col-lg-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
