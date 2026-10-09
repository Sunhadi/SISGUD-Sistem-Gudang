import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
});

// Sisipkan token di setiap request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalisasi error: lempar { message, errors }
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response) {
      const { data, status } = error.response;
      const err = new Error(data?.message || `Error ${status}`);
      err.status = status;
      err.errors = data?.errors || [];
      err.data = data;
      return Promise.reject(err);
    }
    return Promise.reject(error);
  }
);

export default api;

/** Panggil API dan kembalikan field `data` dari envelope { success, data, meta } */
export async function callApi(promise) {
  const res = await promise;
  return res.data;
}
