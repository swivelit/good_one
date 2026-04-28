import React, { useState } from "react";
import ProductCard from "../productCard";

const categories = [
  "All",
  "Electronics",
  "Mobiles",
  "Furniture",
  "Clothing",
  "Books",
  "Sports",
  "Home & Garden",
  "Vehicles",
  "Other",
];

export default function ProductList({ products }) {
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredProducts =
    selectedCategory === "All"
      ? products
      : products.filter((p) => p.category === selectedCategory);

  return (
    <div className="container">

      {/* Category Filter */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`btn ${
              selectedCategory === cat ? "btn-primary" : "btn-outline-primary"
            }`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="row">
        {filteredProducts.map((product) => (
          <div className="col-md-3 mb-4" key={product._id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  );
}