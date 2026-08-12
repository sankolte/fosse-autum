document.addEventListener("DOMContentLoaded", () => {
  // State variables
  let currentToken = localStorage.getItem("osdag_auth_token") || null;
  let currentUser = null;

  // DOM Elements
  const backendSelect = document.getElementById("backendSelect");
  const serverStatusBadge = document.getElementById("serverStatusBadge");

  // Auth Tabs & Forms
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");
  const loginFormContainer = document.getElementById("loginFormContainer");
  const registerFormContainer = document.getElementById("registerFormContainer");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const authCard = document.getElementById("authCard");
  const userProfileCard = document.getElementById("userProfileCard");

  // User Profile DOM
  const userNameEl = document.getElementById("userName");
  const userEmailEl = document.getElementById("userEmail");
  const userIdEl = document.getElementById("userId");
  const jwtPayloadEl = document.getElementById("jwtPayload");
  const logoutBtn = document.getElementById("logoutBtn");

  // Files DOM
  const filesListEl = document.getElementById("filesList");
  const refreshFilesBtn = document.getElementById("refreshFilesBtn");

  // IDOR Security Audit Panel
  const idorInput = document.getElementById("idorInput");
  const testIdorBtn = document.getElementById("testIdorBtn");
  const idorResultContainer = document.getElementById("idorResultContainer");
  const idorStatusCode = document.getElementById("idorStatusCode");
  const idorStatusBadge = document.getElementById("idorStatusBadge");
  const idorResponseBody = document.getElementById("idorResponseBody");

  // Quick Fill Buttons
  const fillAliceBtn = document.getElementById("fillAlice");
  const fillBobBtn = document.getElementById("fillBob");
  const fillCarolBtn = document.getElementById("fillCarol");

  // Notifications / Alert banner
  const alertContainer = document.getElementById("alertContainer");

  // --- Backend Selector Initialization ---
  backendSelect.value = CONFIG.getActiveBackendKey();
  backendSelect.addEventListener("change", (e) => {
    CONFIG.setActiveBackendKey(e.target.value);
    showAlert(`Switched backend to: ${CONFIG.BACKENDS[e.target.value].name}`, "info");
    checkServerHealth();
    if (currentToken) fetchUserProfile();
  });

  // Check Backend Server Health
  async function checkServerHealth() {
    try {
      const baseUrl = CONFIG.getBaseUrl().replace("/api", "");
      const res = await fetch(`${baseUrl}/`, { method: "GET" });
      if (res.ok) {
        serverStatusBadge.textContent = "Online";
        serverStatusBadge.className = "badge badge-success";
      } else {
        serverStatusBadge.textContent = "Error";
        serverStatusBadge.className = "badge badge-danger";
      }
    } catch (err) {
      serverStatusBadge.textContent = "Offline";
      serverStatusBadge.className = "badge badge-danger";
    }
  }

  // --- Helper Functions ---
  function showAlert(message, type = "info") {
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
      alertContainer.innerHTML = "";
    }, 4000);
  }

  function parseJwt(token) {
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  // --- Tab Switching ---
  loginTab.addEventListener("click", () => {
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
    loginFormContainer.style.display = "block";
    registerFormContainer.style.display = "none";
  });

  registerTab.addEventListener("click", () => {
    registerTab.classList.add("active");
    loginTab.classList.remove("active");
    registerFormContainer.style.display = "block";
    loginFormContainer.style.display = "none";
  });

  // --- Quick Fill Event Handlers ---
  fillAliceBtn.addEventListener("click", () => {
    document.getElementById("loginEmail").value = "alice@test.com";
    document.getElementById("loginPassword").value = "Password123!";
    showAlert("Filled Alice's test credentials", "info");
  });

  fillBobBtn.addEventListener("click", () => {
    document.getElementById("loginEmail").value = "bob@test.com";
    document.getElementById("loginPassword").value = "Password123!";
    showAlert("Filled Bob's test credentials", "info");
  });

  fillCarolBtn.addEventListener("click", () => {
    document.getElementById("loginEmail").value = "carol@test.com";
    document.getElementById("loginPassword").value = "Password123!";
    showAlert("Filled Carol's test credentials", "info");
  });

  // --- Auth Handlers ---
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    try {
      const res = await fetch(`${CONFIG.getBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 423) {
          showAlert(`⛔ 423 Account Locked: ${data.error}`, "danger");
        } else if (res.status === 429) {
          showAlert(`🚨 429 Rate Limit Exceeded: ${data.error}`, "warning");
        } else {
          showAlert(`Error (${res.status}): ${data.error || "Login failed"}`, "danger");
        }
        return;
      }

      currentToken = data.token;
      localStorage.setItem("osdag_auth_token", currentToken);
      showAlert(`Welcome back, ${data.user.name || data.user.email}!`, "success");
      updateUiForLoggedInState(data.user);
    } catch (err) {
      showAlert(`Network error: ${err.message}`, "danger");
    }
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName").value;
    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;

    try {
      const res = await fetch(`${CONFIG.getBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        showAlert(`Error (${res.status}): ${data.error || "Registration failed"}`, "danger");
        return;
      }

      if (data.token) {
        currentToken = data.token;
        localStorage.setItem("osdag_auth_token", currentToken);
        updateUiForLoggedInState(data.user);
      }
      showAlert("Registration successful!", "success");
    } catch (err) {
      showAlert(`Network error: ${err.message}`, "danger");
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      if (currentToken) {
        await fetch(`${CONFIG.getBaseUrl()}/auth/logout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      }
    } catch (err) {
      console.warn("Logout request failed or server offline", err);
    } finally {
      currentToken = null;
      currentUser = null;
      localStorage.removeItem("osdag_auth_token");
      updateUiForLoggedOutState();
      showAlert("Logged out successfully. Token revoked.", "info");
    }
  });

  // --- Profile & Files Fetchers ---
  async function fetchUserProfile() {
    if (!currentToken) return;

    try {
      const res = await fetch(`${CONFIG.getBaseUrl()}/user/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          showAlert("Session expired or token revoked. Please login again.", "warning");
          logoutBtn.click();
          return;
        }
        showAlert(`Failed to load profile: ${data.error}`, "danger");
        return;
      }

      updateUiForLoggedInState(data.user);
    } catch (err) {
      showAlert(`Failed to connect to backend: ${err.message}`, "danger");
    }
  }

  async function fetchUserFiles() {
    if (!currentToken) return;

    filesListEl.innerHTML = "<p class='text-muted'>Loading files...</p>";

    try {
      const res = await fetch(`${CONFIG.getBaseUrl()}/files`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const data = await res.json();

      if (!res.ok) {
        filesListEl.innerHTML = `<p class='text-danger'>Error: ${data.error}</p>`;
        return;
      }

      if (!data.files || data.files.length === 0) {
        filesListEl.innerHTML = "<p class='text-muted'>No files found for your account.</p>";
        return;
      }

      filesListEl.innerHTML = data.files
        .map(
          (file) => `
        <div class="file-item">
          <div>
            <strong>${file.filename}</strong>
            <br/>
            <small class="text-muted">ID: <code>${file.id}</code></small>
          </div>
          <button class="btn btn-sm btn-outline" onclick="downloadFile('${file.id}', '${file.filename}')">
            📥 Download
          </button>
        </div>
      `
        )
        .join("");
    } catch (err) {
      filesListEl.innerHTML = `<p class='text-danger'>Error loading files: ${err.message}</p>`;
    }
  }

  window.downloadFile = async function (fileId, filename) {
    try {
      const res = await fetch(`${CONFIG.getBaseUrl()}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!res.ok) {
        const errJson = await res.json();
        showAlert(`Download failed (${res.status}): ${errJson.error}`, "danger");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `file_${fileId}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showAlert(`Downloaded ${filename}`, "success");
    } catch (err) {
      showAlert(`Download error: ${err.message}`, "danger");
    }
  };

  // --- IDOR Security Audit Test Handler ---
  testIdorBtn.addEventListener("click", async () => {
    const targetFileId = idorInput.value.trim();
    if (!targetFileId) {
      showAlert("Please enter a target File UUID", "warning");
      return;
    }

    idorResultContainer.style.display = "block";
    idorStatusCode.textContent = "Sending...";
    idorStatusBadge.className = "badge badge-info";
    idorResponseBody.textContent = "Awaiting response...";

    try {
      const headers = currentToken ? { Authorization: `Bearer ${currentToken}` } : {};
      const res = await fetch(`${CONFIG.getBaseUrl()}/files/${targetFileId}`, { headers });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        data = { message: await res.text() };
      }

      idorStatusCode.textContent = `HTTP ${res.status} ${res.statusText}`;

      if (res.status === 200) {
        idorStatusBadge.textContent = "SUCCESS (200)";
        idorStatusBadge.className = "badge badge-success";
      } else if (res.status === 403) {
        idorStatusBadge.textContent = "BLOCKED (403 FORBIDDEN - IDOR PREVENTED)";
        idorStatusBadge.className = "badge badge-danger";
      } else if (res.status === 404) {
        idorStatusBadge.textContent = "NOT FOUND (404)";
        idorStatusBadge.className = "badge badge-warning";
      } else {
        idorStatusBadge.textContent = `STATUS ${res.status}`;
        idorStatusBadge.className = "badge badge-secondary";
      }

      idorResponseBody.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      idorStatusCode.textContent = "Network / CORS Error";
      idorStatusBadge.textContent = "FAILED";
      idorStatusBadge.className = "badge badge-danger";
      idorResponseBody.textContent = err.message;
    }
  });

  refreshFilesBtn.addEventListener("click", fetchUserFiles);

  // --- UI State Management ---
  function updateUiForLoggedInState(user) {
    currentUser = user;
    authCard.style.display = "none";
    userProfileCard.style.display = "block";

    userNameEl.textContent = user.name || "N/A";
    userEmailEl.textContent = user.email || "N/A";
    userIdEl.textContent = user.id || "N/A";

    const decodedJwt = parseJwt(currentToken);
    jwtPayloadEl.textContent = decodedJwt ? JSON.stringify(decodedJwt, null, 2) : "Opaque / Raw Token";

    fetchUserFiles();
  }

  function updateUiForLoggedOutState() {
    authCard.style.display = "block";
    userProfileCard.style.display = "none";
    filesListEl.innerHTML = "<p class='text-muted'>Please log in to view files.</p>";
    idorResultContainer.style.display = "none";
  }

  // --- Initial Page Load ---
  checkServerHealth();
  if (currentToken) {
    fetchUserProfile();
  } else {
    updateUiForLoggedOutState();
  }
});
