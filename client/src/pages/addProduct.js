import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { productAPI } from '../api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Electronics','Mobiles','Furniture','Clothing','Books','Sports','Home & Garden','Vehicles','Food','Other'];
const CONDITIONS = [
  { value: 'new', label: 'Brand New', desc: 'Never used, original packaging' },
  { value: 'like-new', label: 'Like New', desc: 'Used once or twice, perfect condition' },
  { value: 'good', label: 'Good', desc: 'Minor signs of use, fully functional' },
  { value: 'fair', label: 'Fair', desc: 'Visible wear, works perfectly' },
  { value: 'poor', label: 'Poor', desc: 'Heavily used but functional' },
];

export default function AddProduct() {
  const [form, setForm] = useState({
    title: '', description: '', price: '', originalPrice: '',
    category: 'Electronics', condition: 'good', location: '', tags: '',
  });
  const [images, setImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const navigate = useNavigate();

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + images.length > 5) return toast.error('Max 5 images allowed');
    setImages(prev => [...prev, ...files]);
    const urls = files.map(f => URL.createObjectURL(f));
    setPreviews(prev => [...prev, ...urls]);
  };

  const removeImage = (i) => {
    setImages(prev => prev.filter((_, idx) => idx !== i));
    setPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.price) return toast.error('Please fill all required fields');
    try {
      setLoading(true);
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      images.forEach(img => fd.append('images', img));
      await productAPI.create(fd);
      toast.success('Product listed successfully! Active for 24 hours.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container py-4 py-md-5">
      <div className="d-flex align-items-center gap-3 mb-4">
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">← Back</Link>
        <h4 className="fw-bold mb-0">Add New Product Listing</h4>
      </div>

      <div className="alert alert-info d-flex gap-2 mb-4 py-2">
        <i className="bi bi-info-circle-fill mt-1"></i>
        <span>Your listing will be active for <strong>24 hours</strong>. You can renew it from your dashboard to keep it visible.</span>
      </div>

      <div className="row g-4">
        <div className="col-lg-8">
          <form onSubmit={handleSubmit}>
            {/* Images */}
            <div className="card border-0 shadow-sm mb-4" style={{borderRadius:14}}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3"><i className="bi bi-images me-2" style={{color:'#FF6B35'}}></i>Product Images <small className="text-muted fw-normal">(up to 5)</small></h6>
                <div className="d-flex flex-wrap gap-2 mb-3">
                  {previews.map((url, i) => (
                    <div key={i} className="position-relative" style={{width:90,height:90}}>
                      <img src={url} alt="" className="rounded-3 w-100 h-100" style={{objectFit:'cover'}} />
                      <button type="button" className="btn btn-sm btn-danger position-absolute top-0 end-0 p-0 d-flex align-items-center justify-content-center"
                        style={{width:22,height:22,borderRadius:'50%',margin:2}} onClick={() => removeImage(i)}>
                        <i className="bi bi-x" style={{fontSize:'0.75rem'}}></i>
                      </button>
                    </div>
                  ))}
                  {previews.length < 5 && (
                    <button type="button" className="border-2 border-dashed rounded-3 d-flex flex-column align-items-center justify-content-center text-muted"
                      style={{width:90,height:90,border:'2px dashed #dee2e6',background:'#fafafa',cursor:'pointer'}}
                      onClick={() => fileRef.current.click()}>
                      <i className="bi bi-plus-lg fs-4"></i>
                      <small style={{fontSize:'0.65rem'}}>Add Photo</small>
                    </button>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" multiple className="d-none" onChange={handleImageChange} />
              </div>
            </div>

            {/* Basic Info */}
            <div className="card border-0 shadow-sm mb-4" style={{borderRadius:14}}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3"><i className="bi bi-info-circle me-2" style={{color:'#FF6B35'}}></i>Product Details</h6>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Product Title *</label>
                  <input type="text" className="form-control" placeholder="e.g. iPhone 14 Pro Max 256GB Space Black" value={form.title} onChange={e => setForm({...form,title:e.target.value})} required />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Description *</label>
                  <textarea className="form-control" rows={4} placeholder="Describe the product condition, features, reason for selling..." value={form.description} onChange={e => setForm({...form,description:e.target.value})} required></textarea>
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Category *</label>
                    <select className="form-select" value={form.category} onChange={e => setForm({...form,category:e.target.value})}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Location</label>
                    <input type="text" className="form-control" placeholder="City, Area" value={form.location} onChange={e => setForm({...form,location:e.target.value})} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Selling Price (₹) *</label>
                    <div className="input-group">
                      <span className="input-group-text">₹</span>
                      <input type="number" className="form-control" placeholder="0" value={form.price} onChange={e => setForm({...form,price:e.target.value})} required min="0" />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Original Price (₹) <span className="text-muted fw-normal">Optional</span></label>
                    <div className="input-group">
                      <span className="input-group-text">₹</span>
                      <input type="number" className="form-control" placeholder="0" value={form.originalPrice} onChange={e => setForm({...form,originalPrice:e.target.value})} min="0" />
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold">Tags <span className="text-muted fw-normal">(comma separated)</span></label>
                    <input type="text" className="form-control" placeholder="e.g. iphone, apple, smartphone" value={form.tags} onChange={e => setForm({...form,tags:e.target.value})} />
                  </div>
                </div>
              </div>
            </div>

            {/* Condition */}
            <div className="card border-0 shadow-sm mb-4" style={{borderRadius:14}}>
              <div className="card-body p-4">
                <h6 className="fw-bold mb-3"><i className="bi bi-stars me-2" style={{color:'#FF6B35'}}></i>Product Condition</h6>
                <div className="row g-2">
                  {CONDITIONS.map(c => (
                    <div key={c.value} className="col-6 col-md-4">
                      <div
                        className="p-3 rounded-3 cursor-pointer border-2"
                        style={{
                          cursor:'pointer',
                          border: `2px solid ${form.condition === c.value ? '#FF6B35' : '#dee2e6'}`,
                          background: form.condition === c.value ? '#fff5f0' : '#fafafa',
                        }}
                        onClick={() => setForm({...form,condition:c.value})}
                      >
                        {form.condition === c.value && <i className="bi bi-check-circle-fill me-1" style={{color:'#FF6B35'}}></i>}
                        <div className="fw-semibold small">{c.label}</div>
                        <div className="text-muted" style={{fontSize:'0.72rem'}}>{c.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button type="submit" className="btn btn-primary-custom btn-lg w-100" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Publishing...</> : <><i className="bi bi-cloud-upload me-2"></i>Publish Listing (24 Hours)</>}
            </button>
          </form>
        </div>

        {/* Preview Sidebar */}
        <div className="col-lg-4">
          <div className="sticky-top" style={{top:80}}>
            <div className="card border-0 shadow-sm" style={{borderRadius:14}}>
              <div className="card-body p-3">
                <h6 className="fw-bold mb-3">Listing Preview</h6>
                {previews[0] && <img src={previews[0]} alt="" className="w-100 rounded-3 mb-3" style={{height:180,objectFit:'cover'}} />}
                <div className="badge badge-category mb-2 text-primary">{form.category}</div>
                <h6 className="fw-bold">{form.title || 'Product Title'}</h6>
                <div className="fw-bold fs-5 mb-2" style={{color:'#FF6B35'}}>
                  {form.price ? `₹${parseInt(form.price).toLocaleString()}` : '₹0'}
                </div>
                <p className="text-muted small mb-0 lh-base">{form.description || 'Product description will appear here...'}</p>
              </div>
            </div>
            <div className="alert alert-warning mt-3 small">
              <i className="bi bi-clock me-2"></i>
              <strong>24-Hour Rule:</strong> Your listing expires in 24 hours. Renew it from dashboard to keep it active.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
