import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'access_token';

function attachInterceptors(client: AxiosInstance): AxiosInstance {
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  client.interceptors.response.use(
    (res) => res,
    (error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.replace('/login');
      }
      return Promise.reject(error);
    },
  );

  return client;
}

// Manage Gateway: auth, questions, tests, assignments
export const manageApi = attachInterceptors(
  axios.create({
    baseURL: import.meta.env.VITE_MANAGE_API_URL ?? '',
    headers: { 'Content-Type': 'application/json' },
  }),
);

// Analytics Gateway: reports, assignment-stats
export const analyticsApi = attachInterceptors(
  axios.create({
    baseURL: import.meta.env.VITE_ANALYTICS_API_URL ?? '',
    headers: { 'Content-Type': 'application/json' },
  }),
);

// Learning Gateway: courses, materials, upload
export const coursesApi = attachInterceptors(
  axios.create({
    baseURL: import.meta.env.VITE_COURSES_API_URL ?? '',
    headers: { 'Content-Type': 'application/json' },
  }),
);
