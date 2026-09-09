import { z } from 'zod';

export const displaySettingsSchema = z.object({
  fontSize: z.number().min(10).max(160),
  lineHeight: z.number().min(1).max(3),
  columnWidth: z.number().min(30).max(100),
  align: z.enum(['left', 'center', 'right']),
  palette: z.enum(['dark', 'light', 'contrast', 'amber', 'green']),
  mirrorX: z.boolean(),
  mirrorY: z.boolean(),
  scrollSpeed: z.number().min(2).max(400),
  guideOffset: z.number().min(0).max(90),
  controlsHidden: z.boolean(),
  followSlides: z.boolean().default(true),
  source: z.enum(['notes', 'script']),
});

export const sessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  kind: z.enum(['pdf', 'image', 'video', 'audio', 'doc', 'slides', 'text', 'screen']),
  docHash: z.string(),
  pageCount: z.number().int().min(0),
  pageTitles: z.array(z.string()).default([]),
  currentIndex: z.number().int().min(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const noteSchema = z.object({
  key: z.string(),
  sessionId: z.string(),
  pageIndex: z.number().int().min(0),
  text: z.string(),
  rev: z.number().int().min(0),
  updatedAt: z.number(),
});

export const scriptSchema = z.object({
  sessionId: z.string(),
  text: z.string(),
  rev: z.number().int().min(0),
  updatedAt: z.number(),
});

/** Shape of an exported/imported .json backup. */
export const exportSchema = z.object({
  format: z.literal('promptdeck.session'),
  version: z.literal(1),
  exportedAt: z.number(),
  session: sessionSchema,
  script: scriptSchema.nullable(),
  notes: z.array(noteSchema),
  display: displaySettingsSchema.optional(),
});

export type SessionExport = z.infer<typeof exportSchema>;
