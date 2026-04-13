const addressForm = document.getElementById("addressForm");
const addressInput = document.getElementById("addressInput");
const proxyFrame = document.getElementById("proxyFrame");
const welcome = document.getElementById("welcome");
const backBtn = document.getElementById("backBtn");
const forwardBtn = document.getElementById("forwardBtn");
const reloadBtn = document.getElementById("reloadBtn");
const homeBtn = document.getElementById("homeBtn");

function normalizeInput(rawValue) {
  const value = rawValue.trim();
  if (!value) return "";

  try {
    return new URL(value).toString();
  } catch (_ignored) {
    // Continue with URL inference.
  }

  try {
    const inferred = new URL(`https://${value}`);
    if (inferred.hostname.includes(".")) {
      return inferred.toString();
    }
  } catch (_ignored) {
    // Continue with search fallback.
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

function setFrameVisibility(showFrame) {
  proxyFrame.style.display = showFrame ? "block" : "none";
  welcome.style.display = showFrame ? "none" : "grid";
}

function navigateTo(rawInput) {
  if (!window.__uv$config) {
    showError("Proxy runtime has not loaded yet.");
    return;
  }

  const normalized = normalizeInput(rawInput);
  if (!normalized) {
    showError("Enter a URL or search query.");
    return;
  }

  clearError();
  setFrameVisibility(true);

  proxyFrame.src =
    window.__uv$config.prefix + window.__uv$config.encodeUrl(normalized);
  addressInput.value = normalized;

  const stateUrl = new URL(window.location.href);
  stateUrl.searchParams.set("q", normalized);
  window.history.replaceState({}, "", stateUrl);
}

function showError(message) {
  clearError();
  const error = document.createElement("p");
  error.className = "error";
  error.id = "addressError";
  error.textContent = message;
  addressForm.appendChild(error);
}

function clearError() {
  const prior = document.getElementById("addressError");
  if (prior) prior.remove();
}

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  navigateTo(addressInput.value);
});

backBtn.addEventListener("click", () => {
  try {
    proxyFrame.contentWindow.history.back();
  } catch (_ignored) {}
});

forwardBtn.addEventListener("click", () => {
  try {
    proxyFrame.contentWindow.history.forward();
  } catch (_ignored) {}
});

reloadBtn.addEventListener("click", () => {
  try {
    proxyFrame.contentWindow.location.reload();
  } catch (_ignored) {}
});

homeBtn.addEventListener("click", () => {
  setFrameVisibility(false);
  proxyFrame.src = "about:blank";
  const stateUrl = new URL(window.location.href);
  stateUrl.searchParams.delete("q");
  window.history.replaceState({}, "", stateUrl);
});

document.querySelectorAll(".link-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.getAttribute("data-target") || "";
    navigateTo(target);
  });
});

const initialQuery = new URLSearchParams(window.location.search).get("q");
if (initialQuery) {
  navigateTo(initialQuery);
}
