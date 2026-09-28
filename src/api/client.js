import axios from 'axios';
import { offlineFaceService } from '../db/offlineServices';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const offlineResponse = (config, data, status = 200) => ({
  data,
  status,
  statusText: 'OK (IndexedDB)',
  headers: {},
  config,
});

client.interceptors.request.use(async (config) => {
  const url = config.url || '';
  const method = config.method ? config.method.toLowerCase() : 'get';

  try {
    let result = null;

    if (url === '/api/faces/users' && method === 'get') {
      result = await offlineFaceService.getUsers();
    } else if (url.startsWith('/api/faces/users/') && method === 'delete') {
      const id = url.split('/').pop();
      result = await offlineFaceService.deleteUser(id);
    } else if (url === '/api/model-status' && method === 'get') {
      result = { loaded: true, mode: 'offline', database: 'IndexedDB' };
    }

    if (result !== null) {
      config.adapter = () => Promise.resolve(offlineResponse(config, result));
    }
  } catch (err) {
    console.error('IndexedDB Interceptor Error:', err);
    config.adapter = () => Promise.reject({
      response: { status: 400, data: { message: err.message, error: err.message } }
    });
  }

  return config;
});

export default client;
export { API_BASE_URL };
