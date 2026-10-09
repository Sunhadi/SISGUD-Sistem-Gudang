import api from './client';

export const itemsApi = {
  list: (params) => api.get('/items', { params }),
  get: (id) => api.get(`/items/${id}`),
  create: (payload) => api.post('/items', payload),
  update: (id, payload) => api.put(`/items/${id}`, payload),
  remove: (id) => api.delete(`/items/${id}`),
  findByBarcode: (code) => api.get(`/items/barcode/${code}`),
  import: (fileBase64) => api.post('/items/import', { file_base64: fileBase64 }),
  export: () => api.get('/items/export', { responseType: 'blob' }),
};
