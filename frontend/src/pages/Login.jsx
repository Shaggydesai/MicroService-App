import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate(params.get('next') || '/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="page auth card">
      <div className="auth-side">
        <h2>Login</h2>
        <p>Get access to your Orders, Wishlist and Recommendations</p>
      </div>
      <form onSubmit={submit} className="auth-form">
        <label className="field"><span>Email</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field"><span>Password</span>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-buy full" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        <Link to={`/register${params.get('next') ? `?next=${params.get('next')}` : ''}`} className="switch">
          New to ShopVerse? Create an account
        </Link>
      </form>
    </div>
  );
}
