import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  TextField,
  Autocomplete,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  CircularProgress,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  FormControlLabel,
  MenuItem,
  Select,
  FormControl,
  ListSubheader,
} from '@mui/material';
import {
  Plus,
  Search,
  Rocket,
  RefreshCw,
  Settings,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Check,
  X,
  ExternalLink,
  UserPlus,
} from 'lucide-react';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';
import { defaultCollapsed } from '@/lib/jsonView';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme as useAppTheme } from '@/context/ThemeContext';
import { toast } from '@/lib/toast';
import { useLocation, useNavigate } from '@/lib/router-compat';
import { DATASTORE_CATEGORIES, RBACConfig } from '@/Shuffle-MCPs/datastore';
import { CategoryAutomationsDialog } from '@/Shuffle-Core/components/CategoryAutomationsDialog';
import { ShareAccessModal } from '@/components/common/ShareAccessModal';
import { useSubOrgs } from '@/hooks/useSubOrgs';

export interface DatastoreItemRecord {
  key: string;
  value: any;
  category: string;
  created_at?: number;
  edited_at?: number;
  suborg_distribution?: string[];
  public_authorization?: string;
  rbac?: RBACConfig;
}

export interface DatastoreCategoriesProps {
  embedded?: boolean;
  initialCategory?: string;
  categoryLocked?: boolean;
  hideHeaderControls?: boolean;
  hideCategorySelector?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  sampleItems?: DatastoreItemRecord[];
  defaultNewItemTemplate?: { key: string; value: any };
}

export const getDefaultSampleItems = (cat: string): DatastoreItemRecord[] => {
  const now = Math.floor(Date.now() / 1000);
  if (cat && cat.includes('incident')) {
    return [
      {
        key: 'inc_2026_0942',
        category: 'shuffle-security_incidents',
        created_at: now - 3600,
        edited_at: now - 1800,
        value: {
          class_uid: 2005,
          class_name: 'Incident Finding',
          category_uid: 2,
          activity_id: 1,
          severity_id: 4,
          severity: 'High',
          status_id: 2,
          status: 'In Progress',
          finding_info: {
            title: 'Phishing detection with credential harvester URL',
            desc: 'Inbound email flagged with credential harvesting link and forwarded to SOC triage queue.',
            created_time: now - 3600,
          },
          observables: [
            { name: 'url.domain', type: 'domain', value: 'login-verify-account-update.xyz' },
            { name: 'email.sender', type: 'email', value: 'security-alert@external-notice.com' },
            { name: 'device.ip', type: 'ip', value: '198.51.100.42' },
          ],
          enrichments: [
            { name: 'virustotal', value: '14/72 engines flagged as malicious' },
          ],
        },
      },
      {
        key: 'inc_2026_0941',
        category: 'shuffle-security_incidents',
        created_at: now - 7200,
        edited_at: now - 6500,
        value: {
          class_uid: 2005,
          class_name: 'Incident Finding',
          category_uid: 2,
          activity_id: 1,
          severity_id: 3,
          severity: 'Medium',
          status_id: 1,
          status: 'New',
          finding_info: {
            title: 'Suspicious base64 PowerShell invocation',
            desc: 'Sysmon Event ID 1 detected encoded script execution on dev-server-04.',
            created_time: now - 7200,
          },
          observables: [
            { name: 'process.cmd_line', type: 'command_line', value: 'powershell.exe -NonI -W Hidden -Enc SQBFAFgA...' },
            { name: 'device.hostname', type: 'hostname', value: 'dev-server-04' },
          ],
        },
      },
    ];
  }
  if (cat && cat.includes('vuln')) {
    return [
      {
        key: 'CVE-2024-3094',
        category: 'shuffle-security_vulns',
        created_at: now - 86400,
        edited_at: now - 43200,
        value: {
          id: 'CVE-2024-3094',
          title: 'XZ Utils Backdoor (liblzma)',
          severity: 'critical',
          score: 10.0,
          category: 'software_cve',
          status: 'open',
          affected_package: 'xz-utils 5.6.0',
        },
      },
    ];
  }
  return [
    {
      key: 'config_default_rules',
      category: cat || 'default',
      created_at: now - 3600,
      value: {
        auto_enrichment: true,
        max_batch_size: 50,
        notify_channel: 'security-alerts',
      },
    },
  ];
};

export interface DatastoreValueCellProps {
  item: DatastoreItemRecord;
  isDark?: boolean;
  selectedCategory?: string;
  maxHeight?: number;
  onInspect?: () => void;
}

export const DatastoreValueCell: React.FC<DatastoreValueCellProps> = ({
  item,
  isDark = true,
  selectedCategory,
  onInspect,
}) => {
  if (selectedCategory === 'protected') {
    return (
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'monospace',
          color: 'hsl(var(--muted-foreground))',
          letterSpacing: '0.15em',
          fontSize: '0.8rem',
        }}
      >
        ****************
      </Typography>
    );
  }

  let parsedJson: any = null;
  if (typeof item.value === 'object' && item.value !== null) {
    parsedJson = item.value;
  } else if (typeof item.value === 'string') {
    const trimmed = item.value.trim();
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        parsedJson = JSON.parse(trimmed);
      } catch {
        parsedJson = null;
      }
    }
  }

  return (
    <Box
      sx={{
        maxHeight: 115,
        overflowY: 'auto',
        overflowX: 'hidden',
        fontSize: '0.78rem',
        fontFamily: 'monospace',
        lineHeight: 1.4,
        wordBreak: 'break-word',
        cursor: onInspect ? 'pointer' : 'default',
        '&::-webkit-scrollbar': { width: 4, height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'hsl(var(--border))', borderRadius: 2 },
      }}
    >
      {parsedJson !== null ? (
        <Box sx={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <JsonView
            src={parsedJson}
            dark={isDark}
            theme="default"
            collapseStringsAfterLength={50}
            collapsed={1}
            enableClipboard={false}
            style={{ fontSize: '0.75rem', lineHeight: 1.35 }}
          />
        </Box>
      ) : (
        <Typography
          variant="body2"
          onClick={onInspect}
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.78rem',
            color: 'hsl(var(--muted-foreground))',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.4,
            '&:hover': onInspect ? { color: 'hsl(var(--foreground))' } : undefined,
          }}
        >
          {String(item.value ?? '')}
        </Typography>
      )}
    </Box>
  );
};

export const getCategoryGroup = (cat: string): string => {
  if (!cat || cat === 'default' || cat === 'protected' || cat === 'all') {
    return 'General';
  }
  if (cat.startsWith('shuffle-security_')) {
    return 'Shuffle Security';
  }
  if (cat.includes('_')) {
    const prefix = cat.split('_')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'Custom';
};

export const getCategoryDisplayLabel = (cat: string): string => {
  if (cat === 'default') return 'Default (All)';
  if (cat === 'protected') return 'Protected (Credentials & Secrets)';
  if (cat === 'all') return 'All Categories';
  if (cat.startsWith('shuffle-security_')) {
    const suffix = cat.replace('shuffle-security_', '');
    return suffix.charAt(0).toUpperCase() + suffix.slice(1);
  }
  if (cat.includes('_')) {
    const parts = cat.split('_');
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }
  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

const DEFAULT_CATEGORIES: string[] = [
  'default',
  'protected',
  DATASTORE_CATEGORIES.ASSETS,
  DATASTORE_CATEGORIES.INCIDENTS,
  DATASTORE_CATEGORIES.VULNERABILITIES,
  DATASTORE_CATEGORIES.INFRASTRUCTURE,
  DATASTORE_CATEGORIES.PACKAGES,
  DATASTORE_CATEGORIES.SOFTWARE,
];

const DatastoreCategories: React.FC<DatastoreCategoriesProps> = ({
  embedded = false,
  initialCategory,
  categoryLocked = false,
  hideHeaderControls = false,
  hideCategorySelector = false,
  readOnly = false,
  compact = false,
  sampleItems,
  defaultNewItemTemplate,
}) => {
  const { userInfo } = useAuth();
  const orgId = userInfo?.active_org?.id;
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';

  const location = useLocation();
  const navigate = useNavigate();

  // Categories list
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (initialCategory) return initialCategory;
    const searchParams = new URLSearchParams(location.search);
    const cat = searchParams.get('category');
    return cat || 'default';
  });

  // Category Autocomplete text input state
  const [categoryInputValue, setCategoryInputValue] = useState<string>(selectedCategory);

  // Sync categoryInputValue when selectedCategory changes
  useEffect(() => {
    setCategoryInputValue(selectedCategory);
  }, [selectedCategory]);

  // Data & loading state
  const [items, setItems] = useState<DatastoreItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState<number>(0);
  const [cursors, setCursors] = useState<{ [page: number]: string }>({ 0: '' });

  // Key search filter
  const [keySearch, setKeySearch] = useState<string>(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('key') || searchParams.get('search') || '';
  });
  const [activeSearchTerm, setActiveSearchTerm] = useState<string>(keySearch);

  // Selected keys for bulk deletion
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Copied indicator for keys
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modals state
  const [inspectDialogOpen, setInspectDialogOpen] = useState<boolean>(false);
  const [inspectItem, setInspectItem] = useState<DatastoreItemRecord | null>(null);

  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<DatastoreItemRecord | null>(null);
  const [formKey, setFormKey] = useState<string>('');
  const [formValue, setFormValue] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [isJsonValid, setIsJsonValid] = useState<boolean>(true);
  const [savingItem, setSavingItem] = useState<boolean>(false);

  // Delete modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Category Settings Dialog
  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [categoryTimeout, setCategoryTimeout] = useState<number>(0);
  const [isCategoryPublic, setIsCategoryPublic] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Category Automations Dialog & Config
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState<boolean>(false);
  const [categoryConfig, setCategoryConfig] = useState<any>(null);

  // Share & Permissions modal
  const [sharingItem, setSharingItem] = useState<DatastoreItemRecord | null>(null);

  // Add Category Dialog
  const [createCategoryDialogOpen, setCreateCategoryDialogOpen] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');

  // Grouped & sorted categories for dropdown
  const sortedCategories = useMemo(() => {
    const groupOrder: Record<string, number> = {
      General: 1,
      'Shuffle Security': 2,
      Custom: 99,
    };

    return [...categories].sort((a, b) => {
      const groupA = getCategoryGroup(a);
      const groupB = getCategoryGroup(b);
      const orderA = groupOrder[groupA] ?? 50;
      const orderB = groupOrder[groupB] ?? 50;
      if (orderA !== orderB) return orderA - orderB;
      if (groupA !== groupB) return groupA.localeCompare(groupB);
      return a.localeCompare(b);
    });
  }, [categories]);

  // Suborg distribution
  const { subOrgs } = useSubOrgs(orgId || '');

  // Sync initialCategory when it changes externally
  useEffect(() => {
    if (initialCategory && initialCategory !== selectedCategory) {
      setSelectedCategory(initialCategory);
      setPage(0);
      setCursors({ 0: '' });
      setSelectedKeys([]);
    }
  }, [initialCategory]);

  // Sync with URL query parameters
  const updateUrlParams = useCallback(
    (newCategory: string, newSearch: string) => {
      if (categoryLocked) return;
      const searchParams = new URLSearchParams(location.search);
      if (newCategory) searchParams.set('category', newCategory);
      else searchParams.delete('category');

      if (newSearch) searchParams.set('key', newSearch);
      else searchParams.delete('key');

      const queryString = searchParams.toString();
      const targetPath = location.pathname.startsWith('/admin') ? location.pathname : '/admin/datastore';
      navigate(`${targetPath}${queryString ? `?${queryString}` : ''}`, { replace: true });
    },
    [location.pathname, location.search, navigate, categoryLocked]
  );

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    if (!orgId) return;
    try {
      const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/get_categories`), {
        headers: { Accept: 'application/json', ...getAuthHeader(orgId) },
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const list: string[] = Array.isArray(data) ? data : data.categories || [];
        setCategories((prev) => Array.from(new Set([...DEFAULT_CATEGORIES, ...list])));
      }
    } catch {
      // Fallback to defaults
    }
  }, [orgId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Fetch cache items
  const fetchCache = useCallback(
    async (
      cat: string,
      pageIndex: number,
      amount: number,
      searchTerm: string,
      cursorMap: { [page: number]: string }
    ) => {
      setLoading(true);

      // Unauthenticated or sample-mode fallback
      if (!orgId) {
        let sampleList = sampleItems || getDefaultSampleItems(cat);
        if (searchTerm) {
          const lower = searchTerm.toLowerCase();
          sampleList = sampleList.filter(
            (i) =>
              i.key.toLowerCase().includes(lower) ||
              (typeof i.value === 'string' && i.value.toLowerCase().includes(lower))
          );
        }
        setItems(sampleList);
        setTotalAmount(sampleList.length);
        setLoading(false);
        return;
      }

      try {
        const fetchKeys = async (categoryParam: string) => {
          const queryParams = new URLSearchParams();
          if (categoryParam) queryParams.set('category', categoryParam);
          queryParams.set('top', String(amount));
          if (searchTerm) queryParams.set('search', searchTerm);
          const cursor = cursorMap[pageIndex];
          if (cursor) queryParams.set('cursor', cursor);

          return fetch(getApiUrl(`/api/v1/orgs/${orgId}/list_cache?${queryParams.toString()}`), {
            headers: { Accept: 'application/json', ...getAuthHeader(orgId) },
            credentials: 'include',
          });
        };

        const effectiveCat = cat === 'all' ? '' : (cat || 'default');
        let response = await fetchKeys(effectiveCat);

        if (!response.ok && response.status === 404) {
          const queryParams = new URLSearchParams();
          queryParams.set('page', String(pageIndex));
          queryParams.set('amount', String(amount));
          if (searchTerm) queryParams.set('search', searchTerm);
          response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/cache/${effectiveCat}?${queryParams.toString()}`), {
            headers: { Accept: 'application/json', ...getAuthHeader(orgId) },
            credentials: 'include',
          });
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch datastore entries: ${response.status} ${response.statusText}`);
        }

        let data = await response.json();
        let loadedItems: DatastoreItemRecord[] = [];
        let totalCount = 0;
        let nextCursor = '';

        const extractItems = (d: any): DatastoreItemRecord[] => {
          if (Array.isArray(d)) return d;
          if (d && typeof d === 'object') {
            if (Array.isArray(d.keys)) return d.keys;
            if (Array.isArray(d.data)) return d.data;
            if (Array.isArray(d.items)) return d.items;
            if (Array.isArray(d.cache)) return d.cache;
          }
          return [];
        };

        loadedItems = extractItems(data);
        totalCount = (data && (data.total_amount ?? data.total ?? data.count)) ?? loadedItems.length;
        nextCursor = (data && (data.cursor ?? data.next_cursor)) || '';

        // "For the "default" category: if there are no keys, show all keys."
        if (cat === 'default' && loadedItems.length === 0 && !searchTerm && pageIndex === 0) {
          try {
            const allResponse = await fetchKeys('');
            if (allResponse.ok) {
              const allData = await allResponse.json();
              const allItems = extractItems(allData);
              if (allItems.length > 0) {
                loadedItems = allItems;
                totalCount = (allData && (allData.total_amount ?? allData.total ?? allData.count)) ?? allItems.length;
                nextCursor = (allData && (allData.cursor ?? allData.next_cursor)) || '';
                data = allData;
              }
            }
          } catch {
            // fallback gracefully
          }
        }

        if (data?.category_config) {
          setCategoryConfig(data.category_config);
        }
        if (Array.isArray(data?.categories)) {
          setCategories((prev) => Array.from(new Set([...prev, ...data.categories])));
        }

        setItems(loadedItems);
        setTotalAmount(totalCount);

        if (nextCursor) {
          setCursors((prev) => ({ ...prev, [pageIndex + 1]: nextCursor }));
        }
      } catch (err) {
        console.error('[Datastore] fetchCache error:', err);
        const sampleList = sampleItems || getDefaultSampleItems(cat);
        setItems(sampleList);
        setTotalAmount(sampleList.length);
      } finally {
        setLoading(false);
      }
    },
    [orgId, sampleItems]
  );

  useEffect(() => {
    fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
  }, [selectedCategory, page, pageSize, activeSearchTerm, fetchCache]);

  // Handle category change & creation
  const handleCategoryChange = (newCat: string) => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
    }
    setSelectedCategory(trimmed);
    setCategoryInputValue(trimmed);
    setPage(0);
    setCursors({ 0: '' });
    setSelectedKeys([]);
    updateUrlParams(trimmed, activeSearchTerm);
  };

  // Search submission
  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveSearchTerm(keySearch);
    setPage(0);
    setCursors({ 0: '' });
    setSelectedKeys([]);
    updateUrlParams(selectedCategory, keySearch);
  };

  // Clear search
  const handleClearSearch = () => {
    setKeySearch('');
    setActiveSearchTerm('');
    setPage(0);
    setCursors({ 0: '' });
    setSelectedKeys([]);
    updateUrlParams(selectedCategory, '');
  };

  // Copy helper
  const handleCopyText = (text: string, label: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 1500);
      toast.success(`Copied ${label} to clipboard`);
    }
  };

  // Open Inspect Dialog
  const handleOpenInspect = (item: DatastoreItemRecord) => {
    setInspectItem(item);
    setInspectDialogOpen(true);
  };

  // Open Add Dialog
  const handleOpenAddDialog = () => {
    setFormKey(defaultNewItemTemplate?.key || '');
    setFormCategory(selectedCategory);
    setFormValue(
      defaultNewItemTemplate?.value
        ? (typeof defaultNewItemTemplate.value === 'object'
            ? JSON.stringify(defaultNewItemTemplate.value, null, 2)
            : String(defaultNewItemTemplate.value))
        : '{\n  \n}'
    );
    setIsJsonValid(true);
    setAddDialogOpen(true);
  };

  // Open Edit Dialog
  const handleOpenEditDialog = (item: DatastoreItemRecord) => {
    setActiveItem(item);
    setFormKey(item.key);
    setFormCategory(item.category || selectedCategory);

    let valString = '';
    if (typeof item.value === 'object' && item.value !== null) {
      valString = JSON.stringify(item.value, null, 2);
    } else if (typeof item.value === 'string') {
      try {
        const parsed = JSON.parse(item.value);
        valString = JSON.stringify(parsed, null, 2);
      } catch {
        valString = item.value;
      }
    } else {
      valString = String(item.value ?? '');
    }

    setFormValue(valString);
    setIsJsonValid(true);
    setEditDialogOpen(true);
  };

  // The backend requires "value" to be a string. Objects/arrays are serialized.
  const toStringValue = (val: unknown): string =>
    typeof val === 'string' ? val : val == null ? '' : JSON.stringify(val);

  // Value change validator
  const handleValueChange = (val: string) => {
    setFormValue(val);
    try {
      JSON.parse(val);
      setIsJsonValid(true);
    } catch {
      setIsJsonValid(false);
    }
  };

  // Format JSON helper
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formValue);
      setFormValue(JSON.stringify(parsed, null, 2));
      setIsJsonValid(true);
    } catch {
      toast.warn('Value is not valid JSON; formatting skipped.');
    }
  };

  // Save Add Item
  const handleSaveAdd = async () => {
    const trimmedKey = formKey.trim();
    if (!trimmedKey) {
      toast.error('Key name is required.');
      return;
    }

    let finalValue: any = formValue;
    try {
      finalValue = JSON.parse(formValue);
    } catch {
      // Keep as string
    }

    if (!orgId) {
      const newItem: DatastoreItemRecord = {
        key: trimmedKey,
        value: finalValue,
        category: formCategory || selectedCategory,
        created_at: Math.floor(Date.now() / 1000),
        edited_at: Math.floor(Date.now() / 1000),
      };
      setItems((prev) => [newItem, ...prev.filter((i) => i.key !== trimmedKey)]);
      setTotalAmount((prev) => prev + 1);
      toast.success(`Entry "${trimmedKey}" saved`);
      setAddDialogOpen(false);
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        org_id: orgId,
        key: trimmedKey,
        value: finalValue,
        category: formCategory || selectedCategory,
      };

      const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/set_cache`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeader(orgId),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to save entry: ${response.status}`);
      }

      toast.success(`Entry "${trimmedKey}" saved successfully`);
      setAddDialogOpen(false);
      fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
    } catch (err) {
      console.error('[Datastore] save entry error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSavingItem(false);
    }
  };

  // Save Edit Item
  const handleSaveEdit = async () => {
    if (!activeItem) return;

    let finalValue: any = formValue;
    try {
      finalValue = JSON.parse(formValue);
    } catch {
      // Keep as string
    }

    if (!orgId) {
      setItems((prev) =>
        prev.map((i) =>
          i.key === activeItem.key
            ? {
                ...i,
                value: finalValue,
                category: formCategory || activeItem.category || selectedCategory,
                edited_at: Math.floor(Date.now() / 1000),
              }
            : i
        )
      );
      toast.success(`Entry "${activeItem.key}" updated`);
      setEditDialogOpen(false);
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
        org_id: orgId,
        key: activeItem.key,
        value: finalValue,
        category: formCategory || activeItem.category || selectedCategory,
        suborg_distribution: activeItem.suborg_distribution,
      };

      const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/set_cache`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeader(orgId),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to update entry: ${response.status}`);
      }

      toast.success(`Entry "${activeItem.key}" updated successfully`);
      setEditDialogOpen(false);
      fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
    } catch (err) {
      console.error('[Datastore] update entry error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update entry');
    } finally {
      setSavingItem(false);
    }
  };

  // Delete initiation
  const handleInitiateDelete = (keys: string[]) => {
    setDeleteTargets(keys);
    setDeleteConfirmOpen(true);
  };

  // Delete confirm execution
  const handleConfirmDelete = async () => {
    if (deleteTargets.length === 0) return;

    if (!orgId) {
      setItems((prev) => prev.filter((i) => !deleteTargets.includes(i.key)));
      setTotalAmount((prev) => Math.max(0, prev - deleteTargets.length));
      toast.success(`Deleted ${deleteTargets.length} key${deleteTargets.length > 1 ? 's' : ''}`);
      setDeleteConfirmOpen(false);
      setSelectedKeys([]);
      setDeleteTargets([]);
      return;
    }

    setDeleting(true);
    try {
      for (const targetKey of deleteTargets) {
        const targetItem = items.find((i) => i.key === targetKey);
        const itemCategory = targetItem?.category || (selectedCategory === 'default' ? '' : selectedCategory);

        const payload = {
          org_id: orgId,
          key: targetKey,
          category: itemCategory,
        };

        const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/delete_cache`), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...getAuthHeader(orgId),
          },
          credentials: 'include',
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let reason = `Status ${response.status}`;
          try {
            const errData = await response.json();
            if (errData?.reason) reason = errData.reason;
          } catch {
            // ignore
          }
          throw new Error(reason);
        }
      }

      toast.success(`Deleted ${deleteTargets.length} key${deleteTargets.length > 1 ? 's' : ''}`);
      setDeleteConfirmOpen(false);
      setSelectedKeys([]);
      setDeleteTargets([]);
      fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
    } catch (err: any) {
      console.error('[Datastore] delete error:', err);
      toast.error(err?.message || 'Failed to delete entries');
    } finally {
      setDeleting(false);
    }
  };

  // Save Item RBAC
  const handleSaveItemRBAC = async (rbac: RBACConfig | null) => {
    if (!sharingItem) return;
    const targetCategory = sharingItem.category || (selectedCategory === 'default' ? '' : selectedCategory);
    const payload = {
      org_id: orgId,
      key: sharingItem.key,
      value: sharingItem.value,
      category: targetCategory,
      rbac: rbac || undefined,
    };

    const response = await fetch(getApiUrl(`/api/v1/orgs/${orgId}/set_cache`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...getAuthHeader(orgId),
      },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.reason || `Failed to update access: ${response.status}`);
    }

    toast.success(`Access updated for "${sharingItem.key}"`);
    fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
  };

  // Row selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedKeys(items.map((i) => i.key));
    } else {
      setSelectedKeys([]);
    }
  };

  const handleSelectRow = (key: string, checked: boolean) => {
    if (checked) {
      setSelectedKeys((prev) => [...prev, key]);
    } else {
      setSelectedKeys((prev) => prev.filter((k) => k !== key));
    }
  };

  // Pagination navigation
  const totalPages = Math.max(1, Math.ceil(totalAmount / pageSize));
  const hasNextPage = page + 1 < totalPages && !!cursors[page];
  const hasPrevPage = page > 0;

  const handleNextPage = () => {
    if (hasNextPage) setPage((prev) => prev + 1);
  };

  const handlePrevPage = () => {
    if (hasPrevPage) setPage((prev) => prev - 1);
  };

  // Timestamp formatting
  const formatTs = (ts?: number) => {
    if (!ts) return '-';
    try {
      const ms = ts > 1e11 ? ts : ts * 1000;
      return new Date(ms).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  return (
    <Box sx={{ width: '100%', p: embedded ? 0 : { xs: 1.5, md: 2.5 } }}>
      {/* Header controls bar */}
      {!hideHeaderControls && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Top-Left Order: <Add Key> <Category Autocomplete + Plus + textfield> <Simple search> */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {/* 1. Add Key button */}
            {!readOnly && (
              <Button
                variant="contained"
                size="small"
                startIcon={<Plus size={16} />}
                onClick={handleOpenAddDialog}
                sx={{
                  textTransform: 'none',
                  height: 36,
                  px: 2,
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  whiteSpace: 'nowrap',
                  boxShadow: 'none',
                  '&:hover': { boxShadow: 'none' },
                }}
              >
                Add Key
              </Button>
            )}

            {/* 2. Category Autocomplete + Plus button */}
            {!categoryLocked && !hideCategorySelector && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={sortedCategories}
                  groupBy={(option) => getCategoryGroup(option)}
                  getOptionLabel={(option) => (typeof option === 'string' ? option : '')}
                  value={selectedCategory}
                  onChange={(_, newValue) => {
                    if (typeof newValue === 'string' && newValue.trim()) {
                      handleCategoryChange(newValue.trim());
                    }
                  }}
                  inputValue={categoryInputValue}
                  onInputChange={(_, newInputValue) => {
                    setCategoryInputValue(newInputValue);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && categoryInputValue.trim()) {
                      e.preventDefault();
                      handleCategoryChange(categoryInputValue.trim());
                    }
                  }}
                  sx={{ minWidth: 200, maxWidth: 280 }}
                  renderGroup={(params) => (
                    <li key={params.key}>
                      <ListSubheader
                        sx={{
                          bgcolor: 'hsl(var(--muted))',
                          color: 'hsl(var(--muted-foreground))',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          lineHeight: '26px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {params.group}
                      </ListSubheader>
                      <ul style={{ padding: 0 }}>{params.children}</ul>
                    </li>
                  )}
                  renderOption={(props, option, { selected }) => {
                    const { key, ...restProps } = props;
                    const label = getCategoryDisplayLabel(option);
                    return (
                      <Box
                        component="li"
                        key={key || option}
                        {...restProps}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          py: 0.6,
                          px: 1.5,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'hsl(var(--muted) / 0.5)' },
                          bgcolor: selected ? 'hsl(var(--primary) / 0.1) !important' : undefined,
                        }}
                      >
                        <Typography sx={{ fontWeight: selected ? 600 : 500, fontSize: '0.84rem' }}>
                          {label}
                        </Typography>
                        {label !== option && (
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'hsl(var(--muted-foreground))',
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                            }}
                          >
                            {option}
                          </Typography>
                        )}
                      </Box>
                    );
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Category..."
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        sx: {
                          height: 36,
                          fontSize: '0.84rem',
                          bgcolor: 'hsl(var(--card))',
                        },
                      }}
                    />
                  )}
                />
                <Tooltip title="Add New Category">
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setNewCategoryName(categoryInputValue.trim());
                      setCreateCategoryDialogOpen(true);
                    }}
                    sx={{
                      minWidth: 36,
                      width: 36,
                      height: 36,
                      p: 0,
                      borderColor: 'hsl(var(--border))',
                      color: 'hsl(var(--foreground))',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'hsl(var(--muted))',
                        borderColor: 'hsl(var(--primary))',
                      },
                    }}
                  >
                    <Plus size={16} />
                  </Button>
                </Tooltip>
              </Box>
            )}

            {/* 3. Simple search */}
            <Box
              component="form"
              onSubmit={handleSearchSubmit}
              sx={{ display: 'flex', alignItems: 'center', minWidth: 180, maxWidth: 300, flex: { xs: 1, sm: '0 1 240px' } }}
            >
              <TextField
                size="small"
                fullWidth
                placeholder="Search keys..."
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ color: 'hsl(var(--muted-foreground))', pl: 0.5 }}>
                      <Search size={15} />
                    </InputAdornment>
                  ),
                  endAdornment: keySearch ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={handleClearSearch} sx={{ p: 0.25 }}>
                        <X size={14} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                  sx: { height: 36, fontSize: '0.84rem', bgcolor: 'hsl(var(--card))' },
                }}
              />
            </Box>
          </Box>

          {/* Top-Right: Rocket button for "Automate", Settings, & Refresh icon */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!categoryLocked && !compact && (
              <ButtonGroup variant="outlined" size="small" sx={{ height: 36 }}>
                <Tooltip
                  title={
                    !selectedCategory || selectedCategory === 'default' || selectedCategory === 'all'
                      ? 'Automations are disabled for Default category'
                      : `Configure automations for ${selectedCategory}`
                  }
                >
                  <span>
                    <Button
                      startIcon={<Rocket size={15} />}
                      disabled={!selectedCategory || selectedCategory === 'default' || selectedCategory === 'all'}
                      onClick={() => setAutomationsDialogOpen(true)}
                      sx={{
                        textTransform: 'none',
                        fontSize: '0.8rem',
                        fontWeight: 500,
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        whiteSpace: 'nowrap',
                        px: 1.5,
                        '&:hover': {
                          borderColor: 'hsl(var(--primary))',
                          bgcolor: 'hsl(var(--primary) / 0.08)',
                        },
                      }}
                    >
                      Automate
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  title={
                    !selectedCategory || selectedCategory === 'default' || selectedCategory === 'all'
                      ? 'Settings are disabled for Default category'
                      : `Settings for "${selectedCategory}"`
                  }
                >
                  <span>
                    <Button
                      disabled={!selectedCategory || selectedCategory === 'default' || selectedCategory === 'all'}
                      onClick={() => setSettingsDialogOpen(true)}
                      sx={{
                        px: 1,
                        minWidth: 'auto',
                        borderColor: 'hsl(var(--border))',
                        color: 'hsl(var(--muted-foreground))',
                        '&:hover': {
                          borderColor: 'hsl(var(--primary))',
                          color: 'hsl(var(--foreground))',
                          bgcolor: 'hsl(var(--primary) / 0.08)',
                        },
                      }}
                    >
                      <Settings size={15} />
                    </Button>
                  </span>
                </Tooltip>
              </ButtonGroup>
            )}

            <Tooltip title="Refresh Datastore">
              <IconButton
                size="small"
                onClick={() => fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors)}
                disabled={loading}
                sx={{
                  height: 36,
                  width: 36,
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 1.5,
                  color: 'hsl(var(--foreground))',
                  bgcolor: 'hsl(var(--card))',
                  '&:hover': {
                    bgcolor: 'hsl(var(--muted))',
                  },
                }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Bulk actions banner */}
      {selectedKeys.length > 0 && !readOnly && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 1.5,
            px: 2,
            py: 1,
            borderRadius: 1.5,
            bgcolor: 'hsl(var(--destructive) / 0.1)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--destructive))', fontSize: '0.82rem' }}>
            {selectedKeys.length} key{selectedKeys.length > 1 ? 's' : ''} selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              size="small"
              startIcon={<Trash2 size={14} />}
              onClick={() => handleInitiateDelete(selectedKeys)}
              sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1.5 }}
            >
              Delete Selected
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedKeys([])}
              sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25 }}
            >
              Deselect All
            </Button>
          </Box>
        </Box>
      )}

      {/* Datastore table */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          overflowX: 'auto',
          mb: 1.5,
        }}
      >
        <Table size="small">
          <TableHead sx={{ bgcolor: 'hsl(var(--muted) / 0.4)' }}>
            <TableRow>
              {!readOnly && (
                <TableCell padding="checkbox" sx={{ width: 40, py: 1 }}>
                  <Checkbox
                    size="small"
                    indeterminate={selectedKeys.length > 0 && selectedKeys.length < items.length}
                    checked={items.length > 0 && selectedKeys.length === items.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
              )}
              <TableCell sx={{ fontWeight: 600, width: 240, py: 1, fontSize: '0.8rem' }}>Key</TableCell>
              <TableCell sx={{ fontWeight: 600, py: 1, fontSize: '0.8rem' }}>Value Preview</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 140, py: 1, fontSize: '0.8rem' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 130, py: 1, fontSize: '0.8rem' }}>Updated</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: 150, py: 1, fontSize: '0.8rem' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 5 : 6} sx={{ textAlign: 'center', py: 5 }}>
                  <CircularProgress size={24} sx={{ mb: 1 }} />
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.82rem' }}>
                    Loading datastore items...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 5 : 6} sx={{ textAlign: 'center', py: 5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.85rem' }}>
                    No entries found
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {activeSearchTerm
                      ? `No keys matched "${activeSearchTerm}".`
                      : `Category "${selectedCategory}" has no items yet.`}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isSelected = selectedKeys.includes(item.key);
                const isItemCopied = copiedKey === item.key;
                return (
                  <TableRow
                    key={item.key}
                    hover
                    selected={isSelected}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                      height: 42,
                    }}
                  >
                    {!readOnly && (
                      <TableCell padding="checkbox" sx={{ py: 0.5 }}>
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(item.key, e.target.checked)}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ py: 0.5, maxWidth: 240 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Typography
                          variant="body2"
                          onClick={() => handleOpenInspect(item)}
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            fontSize: '0.83rem',
                            color: 'hsl(var(--foreground))',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                          title={item.key}
                        >
                          {item.key}
                        </Typography>
                        <Tooltip title={isItemCopied ? 'Copied!' : 'Copy Key'}>
                          <IconButton
                            size="small"
                            onClick={() => handleCopyText(item.key, 'Key')}
                            sx={{ p: 0.25, color: isItemCopied ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}
                          >
                            {isItemCopied ? <Check size={13} /> : <Copy size={13} />}
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>
                      <DatastoreValueCell
                        item={item}
                        isDark={isDark}
                        selectedCategory={selectedCategory}
                        onInspect={() => handleOpenInspect(item)}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                      <Chip
                        label={item.category || selectedCategory}
                        size="small"
                        variant="outlined"
                        sx={{
                          height: 22,
                          fontSize: '0.72rem',
                          fontFamily: 'monospace',
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--muted-foreground))',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                      <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem' }}>
                        {formatTs(item.edited_at || item.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ py: 0.5, whiteSpace: 'nowrap' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.75 }}>
                        <ButtonGroup size="small" variant="outlined" sx={{ height: 28 }}>
                          <Tooltip title="View JSON">
                            <Button
                              onClick={() => handleOpenInspect(item)}
                              sx={{
                                px: 1,
                                minWidth: 'auto',
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                borderColor: 'hsl(var(--border))',
                                color: 'hsl(var(--foreground))',
                                '&:hover': { borderColor: 'hsl(var(--primary))' },
                              }}
                            >
                              <Eye size={13} style={{ marginRight: 4 }} /> View
                            </Button>
                          </Tooltip>
                          {!readOnly && (
                            <Tooltip title="Edit Entry">
                              <Button
                                onClick={() => handleOpenEditDialog(item)}
                                sx={{
                                  px: 1,
                                  minWidth: 'auto',
                                  textTransform: 'none',
                                  fontSize: '0.75rem',
                                  borderColor: 'hsl(var(--border))',
                                  color: 'hsl(var(--muted-foreground))',
                                  '&:hover': { color: 'hsl(var(--foreground))', borderColor: 'hsl(var(--primary))' },
                                }}
                              >
                                <Pencil size={13} style={{ marginRight: 4 }} /> Edit
                              </Button>
                            </Tooltip>
                          )}
                        </ButtonGroup>

                        {!readOnly && (
                          <Tooltip title="Delete Entry">
                            <IconButton
                              size="small"
                              onClick={() => handleInitiateDelete([item.key])}
                              sx={{
                                width: 28,
                                height: 28,
                                p: 0.5,
                                color: 'hsl(var(--destructive))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: 1,
                                '&:hover': {
                                  bgcolor: 'hsl(var(--destructive) / 0.1)',
                                  borderColor: 'hsl(var(--destructive))',
                                },
                              }}
                            >
                              <Trash2 size={13} />
                            </IconButton>
                          </Tooltip>
                        )}

                        <Tooltip title="Share & Permissions">
                          <IconButton
                            size="small"
                            onClick={() => setSharingItem(item)}
                            sx={{
                              width: 28,
                              height: 28,
                              p: 0.5,
                              color: item.rbac ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 1,
                              '&:hover': {
                                color: 'hsl(var(--foreground))',
                                borderColor: 'hsl(var(--primary))',
                                bgcolor: 'hsl(var(--muted) / 0.1)',
                              },
                            }}
                          >
                            <UserPlus size={13} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination footer */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
          px: 1,
          py: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
          Showing {items.length > 0 ? page * pageSize + 1 : 0} - {Math.min((page + 1) * pageSize, totalAmount)} of {totalAmount} keys
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FormControl size="small">
            <Select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
                setCursors({ 0: '' });
              }}
              sx={{ height: 32, fontSize: '0.78rem' }}
            >
              <MenuItem value={25}>25 / page</MenuItem>
              <MenuItem value={50}>50 / page</MenuItem>
              <MenuItem value={100}>100 / page</MenuItem>
            </Select>
          </FormControl>

          <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.8rem' }}>
            Page {page + 1} of {totalPages}
          </Typography>

          <ButtonGroup size="small" variant="outlined" sx={{ height: 30 }}>
            <Button
              onClick={handlePrevPage}
              disabled={!hasPrevPage}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}
            >
              Previous
            </Button>
            <Button
              onClick={handleNextPage}
              disabled={!hasNextPage}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5 }}
            >
              Next
            </Button>
          </ButtonGroup>
        </Box>
      </Box>

      {/* Inspect Detail Dialog */}
      <Dialog
        open={inspectDialogOpen}
        onClose={() => setInspectDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid hsl(var(--border))' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1rem' }}>
                {inspectItem?.key}
              </Typography>
              <Chip
                label={inspectItem?.category || selectedCategory}
                size="small"
                variant="outlined"
                sx={{ fontFamily: 'monospace', fontSize: '0.72rem', height: 22 }}
              />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Copy size={13} />}
                onClick={() => inspectItem && handleCopyText(inspectItem.key, 'Key')}
                sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
              >
                Copy Key
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Copy size={13} />}
                onClick={() =>
                  inspectItem &&
                  handleCopyText(
                    typeof inspectItem.value === 'object'
                      ? JSON.stringify(inspectItem.value, null, 2)
                      : String(inspectItem.value),
                    'JSON'
                  )
                }
                sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
              >
                Copy JSON
              </Button>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ py: 2 }}>
          {inspectItem && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, color: 'hsl(var(--muted-foreground))', fontSize: '0.78rem', pt: 1 }}>
                <span>Updated: {formatTs(inspectItem.edited_at || inspectItem.created_at)}</span>
                {inspectItem.public_authorization && (
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<ExternalLink size={13} />}
                    onClick={() => {
                      const publicUrl = `${getApiUrl('')}/api/v1/orgs/${orgId}/cache/${inspectItem.key}?type=text&authorization=${inspectItem.public_authorization}`;
                      handleCopyText(publicUrl, 'Public URL');
                    }}
                    sx={{ p: 0, minWidth: 'auto', fontSize: '0.75rem', textTransform: 'none' }}
                  >
                    Public Feed URL
                  </Button>
                )}
              </Box>
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 1.5,
                  bgcolor: isDark ? 'hsl(var(--card) / 0.8)' : 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border))',
                  maxHeight: 500,
                  overflowY: 'auto',
                }}
              >
                {typeof inspectItem.value === 'object' && inspectItem.value !== null ? (
                  <JsonView
                    src={inspectItem.value}
                    dark={isDark}
                    theme="default"
                    collapseStringsAfterLength={120}
                    collapsed={defaultCollapsed}
                  />
                ) : (
                  <Typography component="pre" sx={{ m: 0, fontFamily: 'monospace', fontSize: '0.82rem', whiteSpace: 'pre-wrap' }}>
                    {String(inspectItem.value ?? '')}
                  </Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
          {!readOnly && inspectItem && (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Pencil size={13} />}
                onClick={() => {
                  setInspectDialogOpen(false);
                  handleOpenEditDialog(inspectItem);
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<Trash2 size={13} />}
                onClick={() => {
                  setInspectDialogOpen(false);
                  handleInitiateDelete([inspectItem.key]);
                }}
                sx={{ textTransform: 'none' }}
              >
                Delete
              </Button>
            </>
          )}
          <Button
            size="small"
            onClick={() => setInspectDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Entry Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))' }}>
          Add Datastore Entry
        </DialogTitle>
        <DialogContent sx={{ py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Key"
            size="small"
            fullWidth
            required
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            placeholder="e.g. incident_2026_0942"
            sx={{ mt: 1, '& input': { fontFamily: 'monospace', fontSize: '0.88rem' } }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Value (JSON or String)
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={handleFormatJson}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Format JSON
            </Button>
          </Box>

          <TextField
            multiline
            rows={10}
            fullWidth
            value={formValue}
            onChange={(e) => handleValueChange(e.target.value)}
            error={!isJsonValid}
            helperText={!isJsonValid ? 'Value is not valid JSON (will be saved as raw string if submitted)' : ''}
            sx={{
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
          <Button
            size="small"
            onClick={() => setAddDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSaveAdd}
            disabled={savingItem}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {savingItem ? 'Saving...' : 'Save Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))' }}>
          Edit Datastore Entry
        </DialogTitle>
        <DialogContent sx={{ py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Key"
            size="small"
            fullWidth
            disabled
            value={formKey}
            sx={{ mt: 1, '& input': { fontFamily: 'monospace', fontSize: '0.88rem' } }}
          />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Value (JSON or String)
            </Typography>
            <Button
              size="small"
              variant="text"
              onClick={handleFormatJson}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Format JSON
            </Button>
          </Box>

          <TextField
            multiline
            rows={10}
            fullWidth
            value={formValue}
            onChange={(e) => handleValueChange(e.target.value)}
            error={!isJsonValid}
            helperText={!isJsonValid ? 'Value is not valid JSON' : ''}
            sx={{
              '& textarea': {
                fontFamily: 'monospace',
                fontSize: '0.82rem',
                lineHeight: 1.5,
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
          <Button
            size="small"
            onClick={() => setEditDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingItem}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {savingItem ? 'Saving...' : 'Update Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Are you sure you want to delete {deleteTargets.length} key{deleteTargets.length > 1 ? 's' : ''}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button
            size="small"
            onClick={() => setDeleteConfirmOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))' }}>
          Category Settings: {selectedCategory}
        </DialogTitle>
        <DialogContent sx={{ py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Default Entry Timeout (seconds)"
            type="number"
            size="small"
            fullWidth
            value={categoryTimeout}
            onChange={(e) => setCategoryTimeout(Number(e.target.value))}
            helperText="Set to 0 for no expiration (permanent entries)."
            sx={{ mt: 1 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={isCategoryPublic}
                onChange={(e) => setIsCategoryPublic(e.target.checked)}
              />
            }
            label="Make category publicly queryable with authorization tokens"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
          <Button
            size="small"
            onClick={() => setSettingsDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={async () => {
              setSavingSettings(true);
              try {
                const payload = {
                  category: selectedCategory,
                  automations: [],
                  settings: {
                    timeout: categoryTimeout,
                    public: isCategoryPublic,
                  },
                };
                await fetch(getApiUrl('/api/v2/datastore/automate'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    ...getAuthHeader(orgId),
                  },
                  credentials: 'include',
                  body: JSON.stringify(payload),
                });
                toast.success('Category settings saved');
                setSettingsDialogOpen(false);
              } catch {
                toast.error('Failed to save settings');
              } finally {
                setSavingSettings(false);
              }
            }}
            disabled={savingSettings}
            sx={{ textTransform: 'none' }}
          >
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog
        open={createCategoryDialogOpen}
        onClose={() => {
          setCreateCategoryDialogOpen(false);
          setNewCategoryName('');
        }}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', borderBottom: '1px solid hsl(var(--border))' }}>
          Add New Category
        </DialogTitle>
        <DialogContent sx={{ pt: 2.5, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Enter a category name (e.g. <code>custom_assets</code> or <code>shuffle-security_custom</code>).
          </Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="category_name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const trimmed = newCategoryName.trim();
                if (trimmed) {
                  handleCategoryChange(trimmed);
                  setCreateCategoryDialogOpen(false);
                  setNewCategoryName('');
                  toast.success(`Category "${trimmed}" selected`);
                }
              }
            }}
            InputProps={{
              sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid hsl(var(--border))' }}>
          <Button
            size="small"
            onClick={() => {
              setCreateCategoryDialogOpen(false);
              setNewCategoryName('');
            }}
            sx={{ textTransform: 'none', color: 'hsl(var(--muted-foreground))' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!newCategoryName.trim()}
            onClick={() => {
              const trimmed = newCategoryName.trim();
              if (trimmed) {
                handleCategoryChange(trimmed);
                setCreateCategoryDialogOpen(false);
                setNewCategoryName('');
                toast.success(`Category "${trimmed}" selected`);
              }
            }}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Create Category
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Automations Dialog */}
      <CategoryAutomationsDialog
        open={automationsDialogOpen}
        onClose={() => setAutomationsDialogOpen(false)}
        category={selectedCategory}
        automations={categoryConfig?.automations || null}
        initialSettings={categoryConfig?.settings}
        onAutomationsChange={(newAutomations) => {
          setCategoryConfig((prev: any) => ({
            ...prev,
            automations: newAutomations,
          }));
        }}
        onSaved={() => {
          fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
        }}
        orgId={orgId || ''}
      />

      {sharingItem && (
        <ShareAccessModal
          open={Boolean(sharingItem)}
          onClose={() => setSharingItem(null)}
          resourceType="key"
          resourceName={sharingItem.key}
          parentName={sharingItem.category || selectedCategory}
          initialRBAC={sharingItem.rbac}
          onSave={handleSaveItemRBAC}
        />
      )}
    </Box>
  );
};

export default DatastoreCategories;
