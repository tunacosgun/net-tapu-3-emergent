// Toggle DEV_USE_DEMO to test against the remote demo server from Simulator
const DEV_USE_DEMO = true;

const DEMO_URL = 'https://nettapu-demo.tunasoft.tech';
const LOCAL_API = 'http://localhost:8080';
const LOCAL_WS = 'http://localhost:3001';

export const Config = {
  API_BASE_URL: __DEV__ ? (DEV_USE_DEMO ? DEMO_URL : LOCAL_API) : DEMO_URL,
  WS_URL: __DEV__ ? (DEV_USE_DEMO ? DEMO_URL : LOCAL_WS) : DEMO_URL,
  API_PREFIX: '/api/v1',
};
