import api from './client';

export const locationsApi = {
  list: (params) => api.get('/locations', { params }),
  get: (id) => api.get(`/locations/${id}`),
  create: (payload) => api.post('/locations', payload),
  update: (id, payload) => api.put(`/locations/${id}`, payload),
  remove: (id) => api.delete(`/locations/${id}`),
  findByCode: (code) => api.get(`/locations/code/${code}`),
  stocks: (id) => api.get(`/locations/${id}/stocks`),
};
