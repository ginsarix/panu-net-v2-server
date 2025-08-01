import axios from 'axios';

const myAxiosInstance = axios.create();

myAxiosInstance.defaults.headers.common['Content-Type'] = 'application/json';

export default myAxiosInstance;
