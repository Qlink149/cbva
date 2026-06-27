import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

const axiosInstance = axios.create({ baseURL: BASE_URL, timeout: 15000 });

let isRefreshing = false;
let refreshQueue = [];

function processQueue(error, token = null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
}

function clearAuthAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  if (!window.location.pathname.startsWith('/home')) {
    window.location.href = '/home';
  }
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await axios.post(`${BASE_URL}/api/auth/refresh`, { refresh_token: refreshToken });
  const newToken = res.data.access_token;
  localStorage.setItem('access_token', newToken);
  if (res.data.refresh_token) {
    localStorage.setItem('refresh_token', res.data.refresh_token);
  }
  return newToken;
}

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

axiosInstance.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status !== 401 || originalRequest._retry) {
      if (err.response?.status === 401) clearAuthAndRedirect();
      return Promise.reject(err);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(axiosInstance(originalRequest));
          },
          reject,
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const newToken = await refreshAccessToken();
      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return axiosInstance(originalRequest);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      clearAuthAndRedirect();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export const apiGet = (path, params) => axiosInstance.get(path, { params });
export const apiPost = (path, body) => axiosInstance.post(path, body);
export const apiPut = (path, body) => axiosInstance.put(path, body);
export const apiPatch = (path, body) => axiosInstance.patch(path, body);
export const apiDelete = (path) => axiosInstance.delete(path);

export const apiLogout = () => apiPost('/api/auth/logout').catch(() => {});
