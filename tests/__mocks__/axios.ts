import axios from 'axios';

const mockAxios = jest.createMockFromModule<typeof axios>('axios');
mockAxios.create = jest.fn(() => mockAxios);

// biome-ignore lint/suspicious/noExplicitAny: preserve isAxiosError guard used by client
(mockAxios as any).isAxiosError = (axios as any).isAxiosError;
mockAxios.interceptors = {
  request: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
  response: { use: jest.fn(), eject: jest.fn(), clear: jest.fn() },
  // biome-ignore lint/suspicious/noExplicitAny: lightweight mock surface
} as any;

export default mockAxios;
