import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      navigate(params.get('next') || '/');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const input = (name, label, type = 'text', props = {}) => (
    <label className="field"><span>{label}</span>
      <input type={type} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} {...props} />
    </label>
  );

  return (
    <div className="page auth card">
      <div className="auth-side">
        <h2>Looks like you're new here!</h2>
        <p>Sign up with your email to get started</p>
      </div>
      <form onSubmit={submit} className="auth-form">
        {input('name', 'Full name', 'text', { required: true })}
        {input('email', 'Email', 'email', { required: true })}
        {input('phone', 'Mobile number (optional)', 'tel', { pattern: '[0-9]{10}' })}
        {input('password', 'Password (min 6 chars)', 'password', { required: true, minLength: 6 })}
        {error && <p className="error">{error}</p>}
        <button className="btn btn-buy full" disabled={busy}>{busy ? 'Creating account…' : 'Continue'}</button>
        <Link to="/login" className="switch">Existing user? Log in</Link>
      </form>
    </div>
  );
}
