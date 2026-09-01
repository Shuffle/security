import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { fetchDocContentServer } from './docs.server';

export const getDocContent = createServerFn({ method: 'GET' })
  .inputValidator((data) => z.object({ slug: z.string(), folder: z.string().optional() }).parse(data))
  .handler(async ({ data }) => fetchDocContentServer(data.slug, data.folder));
