import api from './client';

export const outboundApi = {
  list: (params) => api.get('/outbound', { params }),
  get: (id) => api.get(`/outbound/${id}`),
  create: (payload) => api.post('/outbound', payload),
  update: (id, payload) => api.put(`/outbound/${id}`, payload),
  allocate: (id) => api.post(`/outbound/${id}/allocate`),
  pickingTasks: (id) => api.get(`/outbound/${id}/picking-tasks`),
  pick: (id, payload) => api.post(`/outbound/${id}/pick`, payload),
  pack: (id, payload) => api.post(`/outbound/${id}/pack`, payload),
  ship: (id) => api.post(`/outbound/${id}/ship`),
  cancel: (id) => api.post(`/outbound/${id}/cancel`),
  timeline: (id) => api.get(`/outbound/${id}/timeline`),
};
