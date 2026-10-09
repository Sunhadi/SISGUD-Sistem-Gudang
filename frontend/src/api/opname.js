import api from './client';

export const opnameApi = {
  list: (params) => api.get('/opname', { params }),
  get: (id) => api.get(`/opname/${id}`),
  create: (payload) => api.post('/opname', payload),
  addItems: (id, payload) => api.post(`/opname/${id}/items`, payload),
  count: (id, payload) => api.post(`/opname/${id}/count`, payload),
  submit: (id) => api.post(`/opname/${id}/submit`),
  approve: (id) => api.post(`/opname/${id}/approve`),
  cancel: (id) => api.post(`/opname/${id}/cancel`),
};
