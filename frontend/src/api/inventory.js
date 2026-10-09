import api from './client';

export const inventoryApi = {
  stocks: (params) => api.get('/inventory/stocks', { params }),
  summary: (params) => api.get('/inventory/stocks/summary', { params }),
  movements: (params) => api.get('/inventory/movements', { params }),
  stockCard: (itemId) => api.get(`/inventory/stock-card/${itemId}`),
  transfer: (payload) => api.post('/inventory/transfer', payload),
  adjustment: (payload) => api.post('/inventory/adjustment', payload),
  lowStock: () => api.get('/inventory/low-stock'),
  expiring: (days = 30) => api.get('/inventory/expiring', { params: { days } }),
};
