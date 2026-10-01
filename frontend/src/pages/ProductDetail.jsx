import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, formatPrice, onImgError } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import Rating from '../components/Rating.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [image, setImage] = useState(0);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/products/${id}`, { auth: false }).then(setProduct).catch((e) => setMsg(e.message));
  }, [id]);

  const addToCart = async (goToCart) => {
    if (!user) return navigate(`/login?next=/products/${id}`);
    setBusy(true);
    try {
      await add(product.id, 1);
      if (goToCart) navigate('/cart'); else setMsg('Added to cart ✓');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!product) return <div className="page center">{msg || 'Loading…'}</div>;
  const outOfStock = product.stock === 0;

  return (
    <div className="page card detail">
      <div className="gallery">
        <div className="thumbs">
          {product.images.map((src, i) => (
            <img key={src} src={src} alt="" className={i === image ? 'active' : ''} onMouseEnter={() => setImage(i)} onError={onImgError} />
          ))}
        </div>
        <div className="main-image">
          <img src={product.images[image]} alt={product.name} onError={onImgError} />
          <div className="actions">
            <button className="btn btn-cart" disabled={busy || outOfStock} onClick={() => addToCart(false)}>🛒 ADD TO CART</button>
            <button className="btn btn-buy" disabled={busy || outOfStock} onClick={() => addToCart(true)}>⚡ BUY NOW</button>
          </div>
        </div>
      </div>
      <div className="info">
        <p className="muted">{product.category} › {product.brand}</p>
        <h1>{product.name}</h1>
        <Rating value={product.rating} count={product.ratingCount} />
        <p className="special">Special price</p>
        <div className="price-row big">
          <strong>{formatPrice(product.price)}</strong>
          {product.mrp > product.price && <s>{formatPrice(product.mrp)}</s>}
          {product.discountPercent > 0 && <span className="off">{product.discountPercent}% off</span>}
        </div>
        <p className={outOfStock ? 'oos' : product.stock < 10 ? 'warn' : 'ok'}>
          {outOfStock ? 'Currently out of stock' : product.stock < 10 ? `Hurry, only ${product.stock} left!` : 'In stock'}
        </p>
        {msg && <p className="notice">{msg}</p>}
        <div className="offers">
          <h4>Available offers</h4>
          <p>🏷️ Bank Offer: 10% off on credit card transactions</p>
          <p>🏷️ Free delivery on orders above ₹500</p>
        </div>
        <h4>Highlights</h4>
        <ul>{product.highlights.map((h) => <li key={h}>{h}</li>)}</ul>
        <h4>Description</h4>
        <p>{product.description}</p>
      </div>
    </div>
  );
}
