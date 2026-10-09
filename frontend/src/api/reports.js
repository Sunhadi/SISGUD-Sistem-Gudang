import api from './client';

export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  throughput: (days = 14) => api.get('/dashboard/throughput', { params: { days } }),
  utilization: () => api.get('/dashboard/utilization'),
  overdue: () => api.get('/dashboard/overdue'),
};

export const reportsApi = {
  stockAging: () => api.get('/reports/stock-aging'),
  dailyActivity: (params) => api.get('/reports/daily-activity', { params }),
  opnameAccuracy: () => api.get('/reports/opname-accuracy'),
  movements: (params) => api.get('/reports/movements', { params }),
  export: (name, params = {}) =>
    api.get(`/reports/${name}/export`, { params, responseType: 'blob' }),
};
