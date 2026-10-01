import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const EMPTY = { items: [], summary: { count: 0, mrp: 0, discount: 0, total: 0 } };
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);

  const load = useCallback(async () => {
    if (!user) return setCart(EMPTY);
    try { setCart(await api('/cart')); } catch { setCart(EMPTY); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const value = {
    cart,
    reload: load,
    add: async (productId, quantity = 1) => setCart(await api('/cart/items', { method: 'POST', body: { productId, quantity } })),
    update: async (productId, quantity) =>
      setCart(await api(`/cart/items/${productId}`, { method: 'PATCH', body: { quantity } })),
    remove: async (productId) => setCart(await api(`/cart/items/${productId}`, { method: 'DELETE' })),
    clear: () => setCart(EMPTY),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
