(() => {
  // pdf.js globals are on window.pdfjsLib because pdf.min.js is loaded before this file
  if (!window.pdfjsLib) {
    console.error("pdf.min.js did not load.");
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="error">Viewer init error: pdf.min.js not found.</div>'
    );
    return;
  }

  // Worker path ABSOLUTE from public root
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

  const qs = new URLSearchParams(window.location.search);
  const fileParam = qs.get("file"); // URLSearchParams already decodes
  const viewer = document.getElementById("viewer");
  const fileNameEl = document.getElementById("fileName");
  const zoomPctEl = document.getElementById("zoomPct");
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");

  const addStatus = (msg, cls = "status") => {
    const div = document.createElement("div");
    div.className = cls;
    div.textContent = msg;
    viewer.appendChild(div);
  };

  if (!fileParam) {
    addStatus("Missing ?file parameter.", "error");
    return;
  }

  const decodedFile = fileParam; // already decoded by URLSearchParams
  try {
    const u = new URL(decodedFile, window.location.origin);
    fileNameEl.textContent = u.pathname.split("/").pop() || "PDF Preview";
  } catch {
    fileNameEl.textContent = "PDF Preview";
  }

  let pdfDoc = null;
  let zoom = 1;
  const setZoomPct = () =>
    (zoomPctEl.textContent = Math.round(zoom * 100) + "%");
  setZoomPct();

  zoomInBtn.addEventListener("click", () => {
    zoom = Math.min(zoom * 1.1, 5);
    renderAll();
    setZoomPct();
  });
  zoomOutBtn.addEventListener("click", () => {
    zoom = Math.max(zoom / 1.1, 0.1);
    renderAll();
    setZoomPct();
  });

  const clearViewer = () => (viewer.innerHTML = "");

  const renderPage = async (n) => {
    const page = await pdfDoc.getPage(n);
    const base = page.getViewport({ scale: 1 });

    // fit to width of scroll area
    const containerWidth = viewer.clientWidth - 24;
    const scale = Math.max(containerWidth / base.width, 0.1) * zoom;

    const vp = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const shell = document.createElement("div");
    shell.className = "page";
    shell.style.width = canvas.width + "px";
    shell.style.height = canvas.height + "px";
    shell.appendChild(canvas);
    viewer.appendChild(shell);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
  };

  const renderAll = async () => {
    clearViewer();
    try {
      for (let i = 1; i <= pdfDoc.numPages; i++) await renderPage(i);
    } catch (e) {
      clearViewer();
      addStatus("Failed to render PDF.", "error");
      console.error(e);
    }
  };

  const load = async () => {
    try {
      addStatus("Loading document…");
      // dev-friendly flags: don’t require streaming
      pdfDoc = await window.pdfjsLib.getDocument({
        url: decodedFile,
        disableAutoFetch: true,
        disableStream: true,
        withCredentials: false,
      }).promise;
      viewer.lastChild?.remove();
      await renderAll();
    } catch (e) {
      clearViewer();
      addStatus("Unable to load PDF.", "error");
      console.error("[viewer] getDocument failed:", e);
    }
  };

  load();
})();
