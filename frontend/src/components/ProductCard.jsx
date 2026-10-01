import { Link } from 'react-router-dom';
import { formatPrice, onImgError } from '../api.js';
import Rating from './Rating.jsx';

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="card product-card">
      <div className="img-wrap">
        <img src={product.images?.[0]} alt={product.name} loading="lazy" onError={onImgError} />
      </div>
      <div className="product-info">
        <p className="brand">{product.brand}</p>
        <h3 title={product.name}>{product.name}</h3>
        <Rating value={product.rating} count={product.ratingCount} />
        <div className="price-row">
          <strong>{formatPrice(product.price)}</strong>
          {product.mrp > product.price && <s>{formatPrice(product.mrp)}</s>}
          {product.discountPercent > 0 && <span className="off">{product.discountPercent}% off</span>}
        </div>
        {product.stock === 0 && <p className="oos">Out of stock</p>}
      </div>
    </Link>
  );
}
