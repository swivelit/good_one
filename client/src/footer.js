import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-dark text-white pt-5 pb-3">
      <div className="container">
        <div className="row g-4">
          <div className="col-lg-4 col-md-6">
            <h5 className="fw-800 mb-3" style={{color:'#FF6B35'}}>
              <i className="bi bi-shop-window me-2"></i>GoodOne
            </h5>
            <p className="small">
              The simplest way to buy and sell locally. Connect directly with verified vendors, negotiate prices, and arrange meet-ups safely.
            </p>
            <div className="d-flex gap-3 mt-3">
              {['facebook','twitter','instagram','linkedin'].map(s => (
                <a key={s} href="/#" className=" fs-5"><i className={`bi bi-${s}`}></i></a>
              ))}
            </div>
          </div>
          <div className="col-lg-2 col-md-6 col-6">
            <h6 className="fw-bold mb-3">Platform</h6>
            <ul className="list-unstyled small">
              <li className="mb-2"><Link to="/" className=" text-decoration-none">Browse Products</Link></li>
              <li className="mb-2"><Link to="/register/vendor" className="text-decoration-none">Become a Vendor</Link></li>
              <li className="mb-2"><Link to="/register/customer" className=" text-decoration-none">Sign Up Free</Link></li>
            </ul>
          </div>
          <div className="col-lg-2 col-md-6 col-6">
            <h6 className="fw-bold mb-3">Support</h6>
            <ul className="list-unstyled small">
              <li className="mb-2"><a href="/#" className=" text-decoration-none">Help Center</a></li>
              <li className="mb-2"><a href="/#" className="text-decoration-none">Safety Tips</a></li>
              <li className="mb-2"><a href="mailto:support@example.com" className=" text-decoration-none">Contact Support</a></li>
              <li className="mb-2"><Link to="/privacy" className=" text-decoration-none">Privacy Policy</Link></li>
              <li className="mb-2"><Link to="/account-deletion" className=" text-decoration-none">Delete Account</Link></li>
            </ul>
          </div>
          <div className="col-lg-4 col-md-6">
            <h6 className="fw-bold mb-3">How It Works</h6>
            <div className="d-flex gap-2 mb-2 small ">
              <i className="bi bi-1-circle-fill text-warning mt-1"></i>
              <span>Browse products from verified vendors</span>
            </div>
            <div className="d-flex gap-2 mb-2 small ">
              <i className="bi bi-2-circle-fill text-warning mt-1"></i>
              <span>Chat directly & negotiate price</span>
            </div>
            <div className="d-flex gap-2 mb-2 small ">
              <i className="bi bi-3-circle-fill text-warning mt-1"></i>
              <span>Meet up & complete transaction safely</span>
            </div>
          </div>
        </div>
        <hr className="border-secondary mt-4" />
        <div className="d-flex flex-wrap justify-content-between align-items-center">
          <small className="">© 2024 GoodOne Marketplace. All rights reserved.</small>
          <small className="">Made with <i className="bi bi-heart-fill text-danger"></i> for local communities</small>
        </div>
      </div>
    </footer>
  );
}
