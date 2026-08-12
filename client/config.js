// Client configuration for toggling API base URL
const CONFIG = {
  DEFAULT_BACKEND: "custom",
  BACKENDS: {
    custom: {
      name: "Custom Express + Prisma (Port 5000)",
      url: "http://localhost:5000/api",
    },
    appwrite: {
      name: "Appwrite BaaS Wrapper (Port 5001)",
      url: "http://localhost:5001/api",
    },
  },
  getActiveBackendKey() {
    return localStorage.getItem("osdag_backend_key") || this.DEFAULT_BACKEND;
  },
  setActiveBackendKey(key) {
    if (this.BACKENDS[key]) {
      localStorage.setItem("osdag_backend_key", key);
    }
  },
  getBaseUrl() {
    const key = this.getActiveBackendKey();
    return this.BACKENDS[key] ? this.BACKENDS[key].url : this.BACKENDS.custom.url;
  },
};
