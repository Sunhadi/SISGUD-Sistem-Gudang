import api from './client';

export const inboundApi = {
  list: (params) => api.get('/inbound', { params }),
  get: (id) => api.get(`/inbound/${id}`),
  create: (payload) => api.post('/inbound', payload),
  update: (id, payload) => api.put(`/inbound/${id}`, payload),
  receive: (id, payload) => api.post(`/inbound/${id}/receive`, payload),
  qc: (id, payload) => api.post(`/inbound/${id}/qc`, payload),
  putaway: (id, payload) => api.post(`/inbound/${id}/putaway`, payload),
  cancel: (id) => api.post(`/inbound/${id}/cancel`),
  timeline: (id) => api.get(`/inbound/${id}/timeline`),
};
