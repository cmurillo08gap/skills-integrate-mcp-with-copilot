document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userIconButton = document.getElementById("user-icon-btn");
  const userMenuPanel = document.getElementById("user-menu-panel");
  const authStatus = document.getElementById("auth-status");
  const loginButton = document.getElementById("login-btn");
  const logoutButton = document.getElementById("logout-btn");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const cancelLoginButton = document.getElementById("cancel-login-btn");
  const adminNotice = document.getElementById("admin-notice");
  const emailInput = document.getElementById("email");

  const AUTH_TOKEN_STORAGE_KEY = "adminAuthToken";
  let authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  let currentAdminUsername = null;
  let isAdmin = false;

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function setAdminMode(enabled, username) {
    isAdmin = enabled;
    currentAdminUsername = enabled ? username : null;

    authStatus.textContent = enabled
      ? `Logged in as ${username}`
      : "Viewing as student";
    loginButton.classList.toggle("hidden", enabled);
    logoutButton.classList.toggle("hidden", !enabled);
    adminNotice.classList.toggle("hidden", enabled);
    signupForm.querySelector("button[type='submit']").disabled = !enabled;
    emailInput.disabled = !enabled;
    activitySelect.disabled = !enabled;
  }

  async function getSession() {
    const headers = authToken
      ? { Authorization: `Bearer ${authToken}` }
      : undefined;

    const response = await fetch("/auth/session", { headers });
    return response.json();
  }

  async function initializeAuthState() {
    try {
      if (!authToken) {
        setAdminMode(false);
        return;
      }

      const session = await getSession();
      if (session.authenticated) {
        setAdminMode(true, session.username);
      } else {
        localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
        authToken = null;
        setAdminMode(false);
      }
    } catch (error) {
      localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      authToken = null;
      setAdminMode(false);
      console.error("Error checking session:", error);
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isAdmin
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isAdmin) {
      showMessage("Teacher login required", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!isAdmin) {
      showMessage("Teacher login required", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userIconButton.addEventListener("click", () => {
    userMenuPanel.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu =
      userMenuPanel.contains(event.target) || userIconButton.contains(event.target);
    if (!clickedInsideMenu) {
      userMenuPanel.classList.add("hidden");
    }
  });

  loginButton.addEventListener("click", () => {
    loginDialog.showModal();
    userMenuPanel.classList.add("hidden");
  });

  cancelLoginButton.addEventListener("click", () => {
    loginDialog.close();
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken);
      setAdminMode(true, result.username);
      loginForm.reset();
      loginDialog.close();
      showMessage("Logged in successfully", "success");
      fetchActivities();
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Login error:", error);
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error("Logout error:", error);
    }

    authToken = null;
    currentAdminUsername = null;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    setAdminMode(false);
    userMenuPanel.classList.add("hidden");
    showMessage("Logged out", "success");
    fetchActivities();
  });

  // Initialize app
  initializeAuthState().then(fetchActivities);
});
