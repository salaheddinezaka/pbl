/**
 * Decap preview for `pages`: full document in an iframe so body HTML and head
 * injections run scripts/styles instead of showing raw markup in the default preview.
 * Requires window.CMS_MANUAL_INIT = true and decap-cms.js loaded before this file.
 */
(function () {
  var CMS = window.CMS;
  var createClass = window.createClass;
  var h = window.h;
  if (!CMS || !createClass || !h) {
    console.error(
      "[decap-pages-preview] Missing CMS, createClass, or h — load decap-cms.js first."
    );
    return;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var PagesPreview = createClass({
    displayName: "PagesPreview",
    componentDidMount: function () {
      this.updateIframe();
    },
    componentDidUpdate: function () {
      this.updateIframe();
    },
    updateIframe: function () {
      var el = this._iframe;
      if (!el) return;
      var entry = this.props.entry;
      if (!entry || typeof entry.getIn !== "function") return;

      var title = entry.getIn(["data", "title"]);
      var headHtml = entry.getIn(["data", "headHtml"]);
      var htmlContent = entry.getIn(["data", "htmlContent"]);
      headHtml = headHtml == null ? "" : String(headHtml);
      htmlContent = htmlContent == null ? "" : String(htmlContent);

      el.srcdoc =
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><title>" +
        escapeHtml(title) +
        "</title>" +
        headHtml +
        "</head><body>" +
        htmlContent +
        "</body></html>";
    },
    render: function () {
      var self = this;
      return h("iframe", {
        ref: function (el) {
          self._iframe = el;
        },
        title: "Page preview",
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          minHeight: "100vh",
          display: "block",
          background: "#fff",
        },
        // Scripts in srcdoc need allow-scripts; allow-same-origin for relative URLs if any
        sandbox:
          "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads",
      });
    },
  });

  CMS.registerPreviewTemplate("pages", PagesPreview);

  var init = window.initCMS;
  if (typeof init === "function") {
    init();
  } else if (CMS && typeof CMS.init === "function") {
    CMS.init();
  } else {
    console.error("[decap-pages-preview] Decap init() not found");
  }
})();
