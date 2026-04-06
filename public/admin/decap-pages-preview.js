/**
 * Decap: custom URL path field + iframe preview for `pages`.
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

  /** Full shareable URL for the live site (same origin as this admin UI). */
  function publicPageUrl(origin, urlPath) {
    var p = String(urlPath == null ? "" : urlPath).trim();
    if (!p || p === "/") {
      return origin.replace(/\/+$/, "") + "/";
    }
    var seg = p.replace(/^\/+/, "").replace(/\/+$/, "");
    return origin.replace(/\/+$/, "") + "/" + seg;
  }

  var SiteUrlPathControl = createClass({
    displayName: "SiteUrlPathControl",
    getInitialState: function () {
      return { copied: false };
    },
    handleChange: function (e) {
      if (this.props.onChange) this.props.onChange(e.target.value);
    },
    handleCopy: function () {
      var url = publicPageUrl(window.location.origin, this.props.value);
      var self = this;
      function done() {
        self.setState({ copied: true });
        setTimeout(function () {
          self.setState({ copied: false });
        }, 2000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {
          window.prompt("Copy this URL:", url);
        });
      } else {
        window.prompt("Copy this URL:", url);
      }
    },
    render: function () {
      var self = this;
      var props = this.props;
      var value = props.value == null ? "" : String(props.value);
      var forID = props.forID;
      var url = publicPageUrl(window.location.origin, value);
      var copied = this.state.copied;

      var copyIcon = h(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "currentColor",
          "aria-hidden": "true",
        },
        h("path", {
          d: "M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z",
        })
      );

      return h(
        "div",
        { className: props.classNameWrapper },
        h("input", {
          type: "text",
          id: forID,
          className: "nc-textField",
          value: value,
          onChange: this.handleChange,
          onFocus: function () {
            if (props.setActiveStyle) props.setActiveStyle();
          },
          onBlur: function () {
            if (props.setInactiveStyle) props.setInactiveStyle();
          },
        }),
        h(
          "div",
          {
            style: {
              marginTop: "4px",
              display: "flex",
              alignItems: "flex-start",
              gap: "6px",
              minWidth: 0,
            },
          },
          h(
            "a",
            {
              href: url,
              target: "_blank",
              rel: "noopener noreferrer",
              style: {
                flex: "1",
                minWidth: 0,
                fontSize: "12px",
                lineHeight: "1.4",
                color: "#2d7ff9",
                textDecoration: "none",
                wordBreak: "break-all",
              },
            },
            url
          ),
          h(
            "button",
            {
              type: "button",
              onClick: function (e) {
                e.preventDefault();
                e.stopPropagation();
                self.handleCopy();
              },
              title: copied ? "Copied" : "Copy URL",
              "aria-label": "Copy full URL to clipboard",
              style: {
                flexShrink: "0",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "26px",
                height: "26px",
                padding: "0",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: copied ? "#1a7f37" : "#5c5c66",
                borderRadius: "3px",
              },
            },
            copyIcon
          )
        )
      );
    },
  });

  var SiteUrlPathPreview = createClass({
    displayName: "SiteUrlPathPreview",
    render: function () {
      var v = this.props.value;
      return h("span", {}, v == null ? "" : String(v));
    },
  });

  CMS.registerWidget("siteUrlPath", SiteUrlPathControl, SiteUrlPathPreview);

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
