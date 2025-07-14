import axios from 'axios';

const myAxiosInstance = axios.create();

myAxiosInstance.interceptors.request.use(config => {
  config.headers.setContentType('application/json');

  return config;
});

myAxiosInstance.interceptors.response.use(
  response => {
    return response;
  },
  error => Promise.reject(error),
);

export default myAxiosInstance;
