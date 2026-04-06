import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/** Decap list entries are usually strings; object shape is accepted for safety */
const allowedEmailsField = z
  .unknown()
  .optional()
  .transform((val): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "email" in item) {
          return String((item as { email?: unknown }).email ?? "");
        }
        return "";
      })
      .filter(Boolean);
  });

const pages = defineCollection({
  loader: glob({ base: "./src/content/pages", pattern: "**/*.yaml" }),
  schema: z
    .object({
      title: z.string(),
      urlPath: z.string(),
      htmlContent: z.string(),
      headHtml: z.string().optional(),
      isProtected: z.boolean().optional().default(false),
      allowedEmails: allowedEmailsField,
    })
    .superRefine((data, ctx) => {
      if (data.isProtected && data.allowedEmails.length === 0) {
        ctx.addIssue({
          code: "custom",
          message:
            "allowedEmails must contain at least one email when isProtected is true",
          path: ["allowedEmails"],
        });
      }
    }),
});

export const collections = { pages };
