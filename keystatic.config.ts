import { collection, config, fields } from "@keystatic/core";

export default config({
  storage: {
    kind: "local",
  },
  collections: {
    pages: collection({
      label: "Pages",
      path: "src/content/pages/*",
      format: { data: "yaml" },
      slugField: "title",
      schema: {
        title: fields.text({
          label: "Title",
          validation: { isRequired: true },
        }),
        urlPath: fields.text({
          label: "URL Path",
          description: "Example: clients/preview/twc/vsg-listicle",
          validation: { isRequired: true },
        }),
        htmlContent: fields.text({
          label: "HTML Content",
          description: "Paste full HTML body content including script tags if needed.",
          multiline: true,
          validation: { isRequired: true },
        }),
        headHtml: fields.text({
          label: "Head HTML (optional)",
          description:
            "Raw HTML for <head>: <link>, <script>, <meta>, <style>, etc.",
          multiline: true,
        }),
        isProtected: fields.checkbox({
          label: "Email Protected",
          defaultValue: false,
        }),
        allowedEmails: fields.array(
          fields.text({
            label: "Allowed Email",
            validation: { isRequired: true },
          }),
          {
            label: "Allowed Emails",
            itemLabel: (props) => props.value || "Allowed Email",
          }
        ),
      },
    }),
  },
});
