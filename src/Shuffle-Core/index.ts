/**
 * Shuffle-Core — standalone React surfaces extracted from the Shuffle
 * Security host app.
 *
 * Layout:
 *   views/        Page-level surfaces (FormInput, Usecases, UsecaseAlluvialDiagram)
 *   components/   Reusable building blocks (EditWorkflow, RecentWorkflow, stubs)
 *   api.ts        Standalone API helpers — KEEP IN SYNC with src/Shuffle-MCPs/api.ts
 *
 * No bundled side-effect CSS yet — see `shuffle-core.css` if you want the
 * shadcn-style token fallbacks when embedding outside the host app.
 */

import './shuffle-core.css';

export { default as Usecases } from './views/Usecases';
export { default } from './views/Usecases';
export { default as UsecaseAlluvialDiagram } from './views/UsecaseAlluvialDiagram';
export { default as FormInput } from './views/FormInput';

export { default as EditWorkflow } from './components/EditWorkflow';
export { default as RecentWorkflow } from './components/RecentWorkflow';

export { usePageMeta } from './usePageMeta';
export { toast, setToastImpl } from './toast';

export { API_CONFIG, getApiUrl, getAuthHeader, shuffleFetch, setRegionUrl, resetRegionUrl } from './api';
