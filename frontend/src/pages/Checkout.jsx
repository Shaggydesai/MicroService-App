import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PriceSummary from '../components/PriceSummary.jsx';

const EMPTY_ADDRESS = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };
const METHODS = [
  ['UPI', 'UPI'],
  ['CARD', 'Credit / Debit Card'],
  ['NETBANKING', 'Net Banking'],
  ['COD', 'Cash on Delivery'],
];

export default function Checkout() {
  const { user, setUser } = useAuth();
  const { cart, clear } = useCart();
  const navigate = useNavigate();
  const saved = user.addresses || [];
  const [addressId, setAddressId] = useState(saved.find((a) => a.isDefault)?._id || saved[0]?._id || 'new');
  const [address, setAddress] = useState({ ...EMPTY_ADDRESS, fullName: user.name, phone: user.phone || '' });
  const [method, setMethod] = useState('UPI');
  const [details, setDetails] = useState({ upiId: '', cardNumber: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (cart.items.length === 0 && !busy) return <Navigate to="/cart" replace />;

  const placeOrder = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      let shippingAddress = saved.find((a) => a._id === addressId);
      if (addressId === 'new') {
        shippingAddress = address;
        setUser(await api('/users/me/addresses', { method: 'POST', body: address }));
      }
      const order = await api('/orders', {
        method: 'POST',
        body: { shippingAddress, paymentMethod: method, paymentDetails: details },
      });
      clear();
      navigate(`/orders/${order.orderNumber}?placed=1`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const field = (name, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input required={name !== 'line2'} value={address[name]}
        onChange={(e) => setAddress({ ...address, [name]: e.target.value })} {...props} />
    </label>
  );

  return (
    <form className="page two-col" onSubmit={placeOrder}>
      <section>
        <div className="card step">
          <h3 className="step-title"><span>1</span> DELIVERY ADDRESS</h3>
          {saved.map((a) => (
            <label key={a._id} className="address-option">
              <input type="radio" name="address" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
              <div>
                <b>{a.fullName}</b> <span className="tag">{a.label}</span> <b>{a.phone}</b>
                <p>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — <b>{a.pincode}</b></p>
              </div>
            </label>
          ))}
          <label className="address-option">
            <input type="radio" name="address" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
            <b>+ Add a new address</b>
          </label>
          {addressId === 'new' && (
            <div className="address-form">
              {field('fullName', 'Name')}
              {field('phone', '10-digit mobile number', { pattern: '[0-9]{10}' })}
              {field('pincode', 'Pincode', { pattern: '[0-9]{6}' })}
              {field('city', 'City/District/Town')}
              {field('line1', 'Address (Area and Street)')}
              {field('line2', 'Landmark (Optional)')}
              {field('state', 'State')}
            </div>
          )}
        </div>
        <div className="card step">
          <h3 className="step-title"><span>2</span> PAYMENT OPTIONS</h3>
          {METHODS.map(([key, label]) => (
            <label key={key} className="address-option">
              <input type="radio" name="method" checked={method === key} onChange={() => setMethod(key)} />
              <div>
                <b>{label}</b>
                {method === 'UPI' && key === 'UPI' && (
                  <input className="inline-input" placeholder="yourname@upi" required value={details.upiId}
                    onChange={(e) => setDetails({ ...details, upiId: e.target.value })} />
                )}
                {method === 'CARD' && key === 'CARD' && (
                  <input className="inline-input" placeholder="Card number" required value={details.cardNumber}
                    onChange={(e) => setDetails({ ...details, cardNumber: e.target.value })} />
                )}
              </div>
            </label>
          ))}
          {error && <p className="error">{error}</p>}
          <div className="place-order">
            <button className="btn btn-buy" disabled={busy}>{busy ? 'PLACING ORDER…' : 'CONFIRM ORDER'}</button>
          </div>
        </div>
      </section>
      <PriceSummary summary={cart.summary} />
    </form>
  );
}
