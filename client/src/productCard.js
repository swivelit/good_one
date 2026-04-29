import React from 'react';
import { Link } from 'react-router-dom';
import { getUploadUrl } from './config';

function getTimeLeft(expiresAt) {
  const now = new Date();
  const exp = new Date(expiresAt);
  const diff = exp - now;
  if (diff <= 0) return { text: 'Expired', cls: 'timer-urgent' };
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours < 2) return { text: `${hours}h ${minutes}m left`, cls: 'timer-urgent' };
  if (hours < 8) return { text: `${hours}h left`, cls: 'timer-warning' };
  return { text: `${hours}h left`, cls: 'timer-ok' };
}

const CONDITION_LABELS = { 'new':'New','like-new':'Like New','good':'Good','fair':'Fair','poor':'Poor' };
const CONDITION_COLORS = { 'new':'success','like-new':'info','good':'primary','fair':'warning','poor':'secondary' };
 const PLACEHOLDER = "/images/no-image.png";

export default function ProductCard({ product }) {

const timer = getTimeLeft(product.expiresAt);
  

const imgSrc = product?.images?.[0]
  ? getUploadUrl(product.images[0])
  : PLACEHOLDER;

  return (
    <div className="product-card card h-100">
      <Link to={`/products/${product._id}`} className="text-decoration-none">
        <div className="position-relative">
          <img src={imgSrc} className="card-img-top" alt={product.title}
            onError={e => { e.target.src = PLACEHOLDER; }} />
          <span className={`timer-badge position-absolute top-0 end-0 m-2 ${timer.cls}`}>
            <i className="bi bi-clock me-1"></i>{timer.text}
          </span>
          {product.condition && (
            <span className={`badge bg-${CONDITION_COLORS[product.condition]} position-absolute bottom-0 start-0 m-2`}>
              {CONDITION_LABELS[product.condition]}
            </span>
          )}
        </div>
        <div className="card-body">
          <span className="badge badge-category  text-dark mb-2">{product.category}</span>
          <h6 className="card-title fw-bold mb-1 text-dark" style={{
            overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'
          }}>{product.title}</h6>
          <p className="card-text text-muted small mb-2" style={{
            overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'
          }}>{product.description}</p>
          <div className="d-flex align-items-center justify-content-between">
            <div>
              <span className="fw-bold fs-5" style={{color:'#FF6B35'}}>₹{product.price?.toLocaleString()}</span>
              {product.originalPrice && product.originalPrice > product.price && (
                <small className="text-muted text-decoration-line-through ms-2">₹{product.originalPrice?.toLocaleString()}</small>
              )}
            </div>
            <small className="text-muted">
              <i className="bi bi-eye me-1"></i>{product.views || 0}
            </small>
          </div>
        </div>
      </Link>
      <div className="card-footer bg-transparent border-0 pt-0 pb-3 px-3">
        <div className="d-flex align-items-center gap-2">
          <div className="rounded-circle bg-warning d-flex align-items-center justify-content-center text-white fw-bold"
            style={{width:28,height:28,fontSize:'0.75rem'}}>
            {product.vendorUser?.name?.charAt(0)?.toUpperCase() || 'V'}
          </div>
          <small className="text-muted">{product.vendor?.businessName || product.vendorUser?.name}</small>
          {product.vendor?.rating > 0 && (
            <small className="text-warning ms-auto">
              <i className="bi bi-star-fill"></i> {product.vendor.rating.toFixed(1)}
            </small>
          )}
        </div>
      </div>
    </div>
  );
}
