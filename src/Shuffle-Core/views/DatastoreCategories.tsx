import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
} from '@mui/material';
import JsonView from 'react18-json-view';
import 'react18-json-view/src/style.css';
import 'react18-json-view/src/dark.css';
import { defaultCollapsed } from '@/lib/jsonView';
import { getApiUrl, getAuthHeader } from '@/Shuffle-MCPs/api';
import { useAuth } from '@/context/AuthContext';
import { useTheme as useAppTheme } from '@/context/ThemeContext';
import { toast } from '@/lib/toast';
import { useLocation, useNavigate } from '@/lib/router-compat';
import { DATASTORE_CATEGORIES } from '@/Shuffle-MCPs/datastore';
import { CategoryAutomationsDialog } from '@/Shuffle-Core/components/CategoryAutomationsDialog';
import { useSubOrgs } from '@/hooks/useSubOrgs';

export interface DatastoreItemRecord {
  key: string;
  value: any;
  category: string;
  created_at?: number;
  edited_at?: number;
  suborg_distribution?: string[];
  public_authorization?: string;
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
}

export const DatastoreValueCell: React.FC<DatastoreValueCellProps> = ({
  item,
  isDark = false,
  selectedCategory,
  maxHeight = 180,
}) => {
  if (selectedCategory === 'protected') {
    return (
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'monospace',
          color: 'hsl(var(--muted-foreground))',
          letterSpacing: '0.15em',
        }}
      >
        ****************
      </Typography>
    );
  }

  let parsedJson: any = null;
  let isJson = false;

  if (typeof item.value === 'object' && item.value !== null) {
    parsedJson = item.value;
    isJson = true;
  } else if (typeof item.value === 'string') {
    try {
      parsedJson = JSON.parse(item.value);
      isJson = typeof parsedJson === 'object' && parsedJson !== null;
    } catch {
      isJson = false;
    }
  }

  if (isJson) {
    return (
      <Box
        sx={{
          maxHeight,
          overflowY: 'auto',
          p: 1,
          borderRadius: '4px',
          border: '1px solid hsl(var(--border))',
          bgcolor: isDark ? 'hsl(var(--card) / 0.6)' : 'hsl(var(--muted) / 0.3)',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
        }}
      >
        <JsonView
          src={parsedJson}
          dark={isDark}
          theme="default"
          collapseStringsAfterLength={60}
          collapsed={defaultCollapsed}
        />
      </Box>
    );
  }

  const strVal = String(item.value ?? '');
  return (
    <Typography
      variant="body2"
      sx={{
        fontFamily: 'monospace',
        fontSize: '0.82rem',
        color: 'hsl(var(--foreground))',
        wordBreak: 'break-all',
        maxHeight: 100,
        overflowY: 'auto',
      }}
    >
      {strVal.length > 240 ? `${strVal.slice(0, 240)}...` : strVal}
    </Typography>
  );
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
  DATASTORE_CATEGORIES.USERS,
];

export const DatastoreCategories: React.FC<DatastoreCategoriesProps> = ({
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
  const { resolvedTheme } = useAppTheme();
  const isDark = resolvedTheme === 'dark';
  const orgId = userInfo?.active_org?.id;
  const location = useLocation();
  const navigate = useNavigate();

  // SubOrgs hook for distribution
  const { subOrgs } = useSubOrgs(orgId);

  // URL search params sync
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const urlCategory = searchParams.get('category') || initialCategory || 'default';
  const urlKey = searchParams.get('key') || '';

  // Core state
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory);
  const [newCategoryInput, setNewCategoryInput] = useState<string>('');
  const [showAddCategoryInput, setShowAddCategoryInput] = useState<boolean>(false);

  // Search & lookup state
  const [keySearch, setKeySearch] = useState<string>(urlKey);
  const [activeSearchTerm, setActiveSearchTerm] = useState<string>(urlKey);

  // Data & loading state
  const [items, setItems] = useState<DatastoreItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [totalAmount, setTotalAmount] = useState<number>(0);

  // Pagination state
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(50);
  const [cursors, setCursors] = useState<Record<number, string>>({ 0: '' });

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
  const [activeItem, setActiveItem] = useState<DatastoreItemRecord | null>(null);
  const [formKey, setFormKey] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formValue, setFormValue] = useState<string>('');
  const [isJsonValid, setIsJsonValid] = useState<boolean>(true);
  const [savingItem, setSavingItem] = useState<boolean>(false);

  // Delete confirm dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<boolean>(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Category Settings & Automations
  const [settingsDialogOpen, setSettingsDialogOpen] = useState<boolean>(false);
  const [automationsDialogOpen, setAutomationsDialogOpen] = useState<boolean>(false);
  const [categoryTimeout, setCategoryTimeout] = useState<string>('0');
  const [categoryPublic, setCategoryPublic] = useState<boolean>(false);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Suborg distribution modal
  const [distributionDialogOpen, setDistributionDialogOpen] = useState<boolean>(false);
  const [distributeTargetKey, setDistributeTargetKey] = useState<string>('');
  const [selectedSuborgIds, setSelectedSuborgIds] = useState<string[]>([]);
  const [savingDistribution, setSavingDistribution] = useState<boolean>(false);

  // Track initial mount
  const isInitialMount = useRef(true);

  // Update selectedCategory if URL category changes externally
  useEffect(() => {
    if (urlCategory && urlCategory !== selectedCategory) {
      setSelectedCategory(urlCategory);
      setPage(0);
      setCursors({ 0: '' });
      setSelectedKeys([]);
    }
  }, [urlCategory]);

  // Update URL search params when category or key search changes
  const updateUrlParams = useCallback((newCat: string, newKey?: string) => {
    if (categoryLocked) return;

    const params = new URLSearchParams(location.search);
    if (newCat && newCat !== 'default') {
      params.set('category', newCat);
    } else {
      params.delete('category');
    }

    if (newKey) {
      params.set('key', newKey);
    } else {
      params.delete('key');
    }

    // Keep admin_tab or other params clean
    params.delete('tab');
    params.delete('admin_tab');

    const nextSearch = params.toString();
    const nextPath = location.pathname;
    navigate(`${nextPath}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
  }, [categoryLocked, location.pathname, location.search, navigate]);

  // Fetch cache entries from backend
  const fetchCache = useCallback(async (
    targetCategory: string,
    targetPage: number,
    targetPageSize: number,
    searchTerm: string,
    knownCursors: Record<number, string>
  ) => {
    if (!orgId) {
      const samples = sampleItems || getDefaultSampleItems(targetCategory);
      setItems(samples);
      setTotalAmount(samples.length);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let url = getApiUrl(`/api/v1/orgs/${orgId}/list_cache`);
      const params = new URLSearchParams();

      const catParam = targetCategory ? targetCategory.replace(/\s+/g, '_') : 'default';
      params.set('category', catParam);
      params.set('top', String(targetPageSize));

      if (targetPage > 0 && knownCursors[targetPage - 1]) {
        params.set('cursor', knownCursors[targetPage - 1]);
      }

      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...getAuthHeader(orgId),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to list cache: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success !== false) {
        const rawKeys: DatastoreItemRecord[] = Array.isArray(data.keys) ? data.keys : [];
        setItems(rawKeys);

        // Update total count
        if (typeof data.total_amount === 'number' && data.total_amount >= 0) {
          setTotalAmount(data.total_amount);
        } else {
          setTotalAmount(rawKeys.length);
        }

        // Store next cursor
        if (data.cursor) {
          setCursors((prev) => ({
            ...prev,
            [targetPage]: data.cursor,
          }));
        }

        // Merge discovered categories
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories((prev) => {
            const combined = Array.from(new Set([...prev, ...data.categories]));
            return combined;
          });
        }

        // Update category config if provided
        if (data.category_config) {
          if (typeof data.category_config.timeout === 'number') {
            setCategoryTimeout(String(data.category_config.timeout));
          }
          if (typeof data.category_config.public === 'boolean') {
            setCategoryPublic(data.category_config.public);
          }
        }
      } else {
        setItems([]);
        setTotalAmount(0);
      }
    } catch (err) {
      console.error('[Datastore] fetchCache error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to fetch datastore entries');
      setItems([]);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Initial load and category / page / search transitions
  useEffect(() => {
    fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
  }, [fetchCache, selectedCategory, page, pageSize, activeSearchTerm]);

  // Handle category switch
  const handleCategoryChange = (newCategory: string) => {
    setSelectedCategory(newCategory);
    setPage(0);
    setCursors({ 0: '' });
    setSelectedKeys([]);
    setActiveSearchTerm('');
    setKeySearch('');
    updateUrlParams(newCategory, '');
  };

  // Handle adding a new category
  const handleAddNewCategory = () => {
    const trimmed = newCategoryInput.trim().replace(/\s+/g, '_');
    if (!trimmed) return;

    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed]);
    }
    setNewCategoryInput('');
    setShowAddCategoryInput(false);
    handleCategoryChange(trimmed);
  };

  // Handle search submission
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
      toast.success(`Copied ${label} to clipboard`);
    }
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
      toast.success(`Entry "${trimmedKey}" saved to local datastore`);
      setAddDialogOpen(false);
      return;
    }

    setSavingItem(true);
    try {
      const payload = {
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
        throw new Error(`Failed to save entry: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();
      if (resJson.success === false) {
        throw new Error(resJson.reason || 'Failed to save entry');
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
        throw new Error(`Failed to update entry: ${response.status} ${response.statusText}`);
      }

      const resJson = await response.json();
      if (resJson.success === false) {
        throw new Error(resJson.reason || 'Failed to update entry');
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
        const payload = {
          key: targetKey,
          category: selectedCategory,
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
          console.warn(`Failed to delete ${targetKey}: ${response.status}`);
        }
      }

      toast.success(`Deleted ${deleteTargets.length} key${deleteTargets.length > 1 ? 's' : ''}`);
      setDeleteConfirmOpen(false);
      setSelectedKeys([]);
      setDeleteTargets([]);
      fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
    } catch (err) {
      console.error('[Datastore] delete error:', err);
      toast.error('Failed to delete selected items');
    } finally {
      setDeleting(false);
    }
  };

  // Save Category Settings (timeout & public)
  const handleSaveCategorySettings = async () => {
    if (!orgId) return;

    setSavingSettings(true);
    try {
      const parsedTimeout = parseInt(categoryTimeout, 10);
      const settingsPayload = {
        timeout: isNaN(parsedTimeout) ? 0 : parsedTimeout,
        public: categoryPublic,
      };

      const payload = {
        category: selectedCategory === 'default' ? '' : selectedCategory,
        automations: [],
        settings: settingsPayload,
      };

      const response = await fetch(getApiUrl('/api/v2/datastore/automate'), {
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
        throw new Error(`Failed to save settings: ${response.status}`);
      }

      toast.success('Category settings saved successfully');
      setSettingsDialogOpen(false);
    } catch (err) {
      console.error('[Datastore] settings error:', err);
      toast.error('Failed to save category settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Suborg Distribution initiation
  const handleOpenDistribution = (item: DatastoreItemRecord) => {
    setDistributeTargetKey(item.key);
    setSelectedSuborgIds(item.suborg_distribution || []);
    setDistributionDialogOpen(true);
  };

  // Suborg Distribution save
  const handleSaveDistribution = async () => {
    if (!distributeTargetKey || !orgId) return;

    setSavingDistribution(true);
    try {
      const targetItem = items.find((i) => i.key === distributeTargetKey);
      if (!targetItem) return;

      const payload = {
        key: targetItem.key,
        value: targetItem.value,
        category: targetItem.category || selectedCategory,
        suborg_distribution: selectedSuborgIds,
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
        throw new Error(`Failed to update sub-org distribution: ${response.status}`);
      }

      toast.success(`Updated distribution for "${distributeTargetKey}"`);
      setDistributionDialogOpen(false);
      fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
    } catch (err) {
      console.error('[Datastore] distribution error:', err);
      toast.error('Failed to update sub-org distribution');
    } finally {
      setSavingDistribution(false);
    }
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
    if (hasNextPage) {
      setPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (hasPrevPage) {
      setPage((prev) => prev - 1);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(0);
    setCursors({ 0: '' });
  };

  // Format timestamp helper
  const formatTs = (ts?: number) => {
    if (!ts) return '-';
    try {
      const ms = ts > 1e11 ? ts : ts * 1000;
      return new Date(ms).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ts);
    }
  };

  // Render value cell using exported DatastoreValueCell component
  const renderValueCell = (item: DatastoreItemRecord) => (
    <DatastoreValueCell
      item={item}
      isDark={isDark}
      selectedCategory={selectedCategory}
      maxHeight={compact ? 120 : 180}
    />
  );

  return (
    <Box sx={{ width: '100%', p: embedded ? 0 : { xs: 2, md: 3 } }}>
      {/* Header controls bar */}
      {!hideHeaderControls && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'stretch', md: 'center' },
            justifyContent: 'space-between',
            gap: 2,
            mb: 3,
            p: 2,
            borderRadius: 2,
            border: '1px solid hsl(var(--border))',
            bgcolor: 'hsl(var(--card))',
          }}
        >
          {/* Category selector & Add Category */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            {!hideCategorySelector && !categoryLocked ? (
              <>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id="category-select-label">Category</InputLabel>
                  <Select
                    labelId="category-select-label"
                    value={selectedCategory}
                    label="Category"
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat} value={cat}>
                        {cat}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {!showAddCategoryInput ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setShowAddCategoryInput(true)}
                    sx={{ textTransform: 'none', height: 38 }}
                  >
                    New Category
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      placeholder="category_name"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewCategory();
                        }
                      }}
                      sx={{ width: 170 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAddNewCategory}
                      sx={{ textTransform: 'none', height: 38 }}
                    >
                      Add
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => {
                        setNewCategoryInput('');
                        setShowAddCategoryInput(false);
                      }}
                      sx={{ textTransform: 'none', height: 38 }}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setSettingsDialogOpen(true)}
                  sx={{ textTransform: 'none', height: 38 }}
                >
                  Settings
                </Button>

                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setAutomationsDialogOpen(true)}
                  sx={{ textTransform: 'none', height: 38 }}
                >
                  Automations
                </Button>
              </>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                  Category:
                </Typography>
                <Chip
                  label={selectedCategory}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    borderColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary))',
                  }}
                />
              </Box>
            )}
          </Box>

          {/* Right side: Search & Add Key */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Box
              component="form"
              onSubmit={handleSearchSubmit}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <TextField
                size="small"
                placeholder="Lookup key or prefix..."
                value={keySearch}
                onChange={(e) => setKeySearch(e.target.value)}
                sx={{ minWidth: 200 }}
              />
              <Button
                type="submit"
                variant="contained"
                size="small"
                sx={{ textTransform: 'none', height: 38 }}
              >
                Lookup
              </Button>
              {activeSearchTerm && (
                <Button
                  variant="text"
                  size="small"
                  onClick={handleClearSearch}
                  sx={{ textTransform: 'none', height: 38 }}
                >
                  Clear
                </Button>
              )}
            </Box>

            {!readOnly && (
              <Button
                variant="contained"
                size="small"
                onClick={handleOpenAddDialog}
                sx={{
                  textTransform: 'none',
                  height: 38,
                  bgcolor: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontWeight: 600,
                }}
              >
                [+] Add Key
              </Button>
            )}

            <Button
              variant="outlined"
              size="small"
              onClick={() => fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors)}
              disabled={loading}
              sx={{ textTransform: 'none', height: 38 }}
            >
              Refresh
            </Button>
          </Box>
        </Box>
      )}

      {/* Batch actions bar */}
      {selectedKeys.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            mb: 2,
            px: 2,
            py: 1.5,
            borderRadius: 1.5,
            bgcolor: 'hsl(var(--destructive) / 0.1)',
            border: '1px solid hsl(var(--destructive) / 0.3)',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'hsl(var(--destructive))' }}>
            {selectedKeys.length} key{selectedKeys.length > 1 ? 's' : ''} selected
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              size="small"
              onClick={() => handleInitiateDelete(selectedKeys)}
              sx={{ textTransform: 'none' }}
            >
              Delete Selected ({selectedKeys.length})
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => setSelectedKeys([])}
              sx={{ textTransform: 'none' }}
            >
              Deselect All
            </Button>
          </Box>
        </Box>
      )}

      {/* Datastore entries table */}
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          mb: 2,
        }}
      >
        <Table size="small">
          <TableHead sx={{ bgcolor: 'hsl(var(--muted) / 0.4)' }}>
            <TableRow>
              <TableCell padding="checkbox" sx={{ width: 44 }}>
                <Checkbox
                  size="small"
                  indeterminate={selectedKeys.length > 0 && selectedKeys.length < items.length}
                  checked={items.length > 0 && selectedKeys.length === items.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: '22%' }}>Key</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '40%' }}>Value</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600, width: '12%' }}>Updated</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600, width: '14%' }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                  <CircularProgress size={28} sx={{ mb: 1.5 }} />
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    Loading entries for {selectedCategory}...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ textAlign: 'center', py: 6 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    No entries found
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
                    {activeSearchTerm
                      ? `No keys matched "${activeSearchTerm}" in category "${selectedCategory}".`
                      : `Category "${selectedCategory}" has no datastore items.`}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const isSelected = selectedKeys.includes(item.key);
                return (
                  <TableRow
                    key={item.key}
                    hover
                    selected={isSelected}
                    sx={{
                      '&:last-child td, &:last-child th': { border: 0 },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(item.key, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: 'hsl(var(--foreground))',
                            wordBreak: 'break-all',
                          }}
                        >
                          {item.key}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            variant="text"
                            size="small"
                            onClick={() => handleCopyText(item.key, 'Key')}
                            sx={{
                              p: 0,
                              minWidth: 'auto',
                              fontSize: '0.72rem',
                              textTransform: 'none',
                              color: 'hsl(var(--muted-foreground))',
                            }}
                          >
                            Copy Key
                          </Button>
                          {item.public_authorization && (
                            <Button
                              variant="text"
                              size="small"
                              onClick={() => {
                                const publicUrl = `${getApiUrl('')}/api/v1/orgs/${orgId}/cache/${item.key}?type=text&authorization=${item.public_authorization}`;
                                handleCopyText(publicUrl, 'Public URL');
                              }}
                              sx={{
                                p: 0,
                                minWidth: 'auto',
                                fontSize: '0.72rem',
                                textTransform: 'none',
                                color: 'hsl(var(--primary))',
                              }}
                            >
                              Public URL
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>{renderValueCell(item)}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.category || selectedCategory}
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          borderColor: 'hsl(var(--border))',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' }}>
                        {formatTs(item.edited_at || item.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, flexWrap: 'wrap' }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleOpenEditDialog(item)}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
                        >
                          Edit
                        </Button>

                        {subOrgs && subOrgs.length > 0 && (
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => handleOpenDistribution(item)}
                            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
                          >
                            Distribute
                          </Button>
                        )}

                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => handleInitiateDelete([item.key])}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, px: 1 }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination toolbar */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          p: 1.5,
          borderRadius: 2,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
            Showing {items.length > 0 ? page * pageSize + 1 : 0} - {page * pageSize + items.length} of {totalAmount} keys
          </Typography>

          <FormControl size="small" sx={{ width: 110 }}>
            <Select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              sx={{ fontSize: '0.85rem' }}
            >
              <MenuItem value={25}>25 / page</MenuItem>
              <MenuItem value={50}>50 / page</MenuItem>
              <MenuItem value={100}>100 / page</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ mr: 1, color: 'hsl(var(--muted-foreground))' }}>
            Page {page + 1} of {totalPages}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={!hasPrevPage || loading}
            onClick={handlePrevPage}
            sx={{ textTransform: 'none' }}
          >
            Previous
          </Button>
          <Button
            variant="outlined"
            size="small"
            disabled={!hasNextPage || loading}
            onClick={handleNextPage}
            sx={{ textTransform: 'none' }}
          >
            Next
          </Button>
        </Box>
      </Box>

      {/* Add Entry Dialog */}
      <Dialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add Datastore Entry</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Key"
            value={formKey}
            onChange={(e) => setFormKey(e.target.value)}
            placeholder="e.g. user_settings_default"
            fullWidth
            required
            size="small"
            sx={{ mt: 1 }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="add-dialog-category-label">Category</InputLabel>
            <Select
              labelId="add-dialog-category-label"
              value={formCategory}
              label="Category"
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Value (JSON or String)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isJsonValid ? 'hsl(var(--success, 142 76% 36%))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {isJsonValid ? 'Valid JSON' : 'Raw String'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleFormatJson}
                  sx={{ textTransform: 'none', py: 0.2, px: 1, fontSize: '0.75rem' }}
                >
                  Format JSON
                </Button>
              </Box>
            </Box>
            <TextField
              multiline
              rows={12}
              value={formValue}
              onChange={(e) => handleValueChange(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="text"
            onClick={() => setAddDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveAdd}
            disabled={savingItem}
            sx={{ textTransform: 'none' }}
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
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Edit Datastore Entry: {activeItem?.key}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Key"
            value={formKey}
            disabled
            fullWidth
            size="small"
            sx={{ mt: 1 }}
          />

          <FormControl size="small" fullWidth>
            <InputLabel id="edit-dialog-category-label">Category</InputLabel>
            <Select
              labelId="edit-dialog-category-label"
              value={formCategory}
              label="Category"
              onChange={(e) => setFormCategory(e.target.value)}
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>
                  {c}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Value
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    color: isJsonValid ? 'hsl(var(--success, 142 76% 36%))' : 'hsl(var(--muted-foreground))',
                  }}
                >
                  {isJsonValid ? 'Valid JSON' : 'Raw String'}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleFormatJson}
                  sx={{ textTransform: 'none', py: 0.2, px: 1, fontSize: '0.75rem' }}
                >
                  Format JSON
                </Button>
              </Box>
            </Box>
            <TextField
              multiline
              rows={14}
              value={formValue}
              onChange={(e) => handleValueChange(e.target.value)}
              fullWidth
              slotProps={{
                input: {
                  sx: {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="text"
            onClick={() => setEditDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={savingItem}
            sx={{ textTransform: 'none' }}
          >
            {savingItem ? 'Updating...' : 'Update Entry'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 1 }}>
            Are you sure you want to delete the following{' '}
            {deleteTargets.length === 1 ? 'entry' : `${deleteTargets.length} entries`} from category "
            {selectedCategory}"?
          </Typography>
          <Box
            sx={{
              maxHeight: 160,
              overflowY: 'auto',
              p: 1.5,
              borderRadius: 1,
              bgcolor: 'hsl(var(--muted) / 0.3)',
              border: '1px solid hsl(var(--border))',
              fontFamily: 'monospace',
              fontSize: '0.82rem',
            }}
          >
            {deleteTargets.map((k) => (
              <Box key={k} sx={{ py: 0.2 }}>
                {k}
              </Box>
            ))}
          </Box>
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="text"
            onClick={() => setDeleteConfirmOpen(false)}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDelete}
            disabled={deleting}
            sx={{ textTransform: 'none' }}
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
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Category Settings: {selectedCategory}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          <Box sx={{ mt: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              Entry Timeout (Seconds)
            </Typography>
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 1 }}>
              Automatically removes keys in this category after the specified number of seconds since their last update. Set to 0 to disable.
            </Typography>
            <TextField
              type="number"
              size="small"
              value={categoryTimeout}
              onChange={(e) => setCategoryTimeout(e.target.value)}
              fullWidth
            />
          </Box>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={categoryPublic}
                  onChange={(e) => setCategoryPublic(e.target.checked)}
                />
              }
              label="Make Category Public"
            />
            <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))' }}>
              Enables public unauthenticated read access to items in this category.
            </Typography>
          </Box>

          {categoryPublic && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 1,
                bgcolor: 'hsl(var(--muted) / 0.3)',
                border: '1px solid hsl(var(--border))',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>
                Public Feed URL
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontFamily: 'monospace', fontSize: '0.8rem', wordBreak: 'break-all', mt: 0.5 }}
              >
                {`${getApiUrl('')}/api/v2/datastore/category/${selectedCategory}?top=1000&type=keys&org_id=${orgId}`}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  const url = `${getApiUrl('')}/api/v2/datastore/category/${selectedCategory}?top=1000&type=keys&org_id=${orgId}`;
                  handleCopyText(url, 'Public Category URL');
                }}
                sx={{ textTransform: 'none', mt: 1, fontSize: '0.75rem' }}
              >
                Copy URL
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="text"
            onClick={() => setSettingsDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveCategorySettings}
            disabled={savingSettings}
            sx={{ textTransform: 'none' }}
          >
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Automations Dialog */}
      {automationsDialogOpen && (
        <CategoryAutomationsDialog
          open={automationsDialogOpen}
          onClose={() => setAutomationsDialogOpen(false)}
          category={selectedCategory}
          automations={null}
          onAutomationsChange={() => {
            fetchCache(selectedCategory, page, pageSize, activeSearchTerm, cursors);
          }}
          orgId={orgId}
        />
      )}

      {/* SubOrg Distribution Dialog */}
      <Dialog
        open={distributionDialogOpen}
        onClose={() => setDistributionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            },
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>
          Sub-Organization Distribution: {distributeTargetKey}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: 'hsl(var(--muted-foreground))', mb: 2 }}>
            Select which child organizations should receive this datastore item.
          </Typography>

          <Box sx={{ maxHeight: 280, overflowY: 'auto' }}>
            {subOrgs.map((subOrg) => {
              const isChecked = selectedSuborgIds.includes(subOrg.id);
              return (
                <Box
                  key={subOrg.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1,
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'hsl(var(--muted) / 0.3)' },
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {subOrg.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'monospace' }}>
                      {subOrg.id}
                    </Typography>
                  </Box>
                  <Checkbox
                    size="small"
                    checked={isChecked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSuborgIds((prev) => [...prev, subOrg.id]);
                      } else {
                        setSelectedSuborgIds((prev) => prev.filter((id) => id !== subOrg.id));
                      }
                    }}
                  />
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="text"
            onClick={() => setDistributionDialogOpen(false)}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveDistribution}
            disabled={savingDistribution}
            sx={{ textTransform: 'none' }}
          >
            {savingDistribution ? 'Saving...' : 'Save Distribution'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DatastoreCategories;
