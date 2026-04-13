const swAllowedHostnames = ["localhost", "127.0.0.1"];

async function registerSW() {
  if (
    location.protocol !== "https:" &&
    !swAllowedHostnames.includes(location.hostname)
  ) {
    throw new Error("Service workers require HTTPS outside localhost.");
  }

  if (!navigator.serviceWorker) {
    throw new Error("This browser does not support service workers.");
  }

  await navigator.serviceWorker.register("/sw.js", {
    scope: window.__uv$config.prefix,
  });
}

window.addEventListener("load", () => {
  registerSW().catch((error) => {
    console.error("Service worker registration failed:", error);
  });
});
