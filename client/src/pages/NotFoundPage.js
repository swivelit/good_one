import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center" style={{minHeight:'60vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:'8rem',lineHeight:1}}>🔍</div>
      <h1 className="display-4 fw-bold mt-3" style={{color:'#FF6B35'}}>404</h1>
      <h4 className="text-muted">Page Not Found</h4>
      <p className="text-muted mb-4">The page you're looking for doesn't exist or has been removed.</p>
      <Link to="/" className="btn btn-primary-custom btn-lg px-5">
        <i className="bi bi-house me-2"></i>Back to Home
      </Link>
    </div>
  );
}
