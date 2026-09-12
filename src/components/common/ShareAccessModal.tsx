import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Switch,
  Alert,
  CircularProgress,
  Divider,
  Autocomplete,
} from '@mui/material';
import { X as CloseIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUsers } from '@/hooks/useUsers';
import { RBACConfig } from '@/Shuffle-MCPs/datastore';

export type AccessRole = 'viewer' | 'editor' | 'admin';

export interface ShareAccessModalProps {
  open: boolean;
  onClose: () => void;
  resourceType: 'key' | 'category';
  resourceName: string;
  parentName?: string;
  initialRBAC?: RBACConfig | null;
  onSave: (rbac: RBACConfig | null) => Promise<void>;
}

interface AccessEntry {
  id: string; // user ID or role name
  type: 'user' | 'role';
  name: string;
  email?: string;
  role: AccessRole | 'owner';
  isOwner?: boolean;
}

const DEFAULT_ROLES = [
  { id: 'admin', name: 'Admins (admin)', description: 'Organization administrators' },
  { id: 'user', name: 'Users (user)', description: 'Standard organization users' },
  { id: 'org-reader', name: 'Readers (org-reader)', description: 'Read-only organization members' },
];

export const ShareAccessModal: React.FC<ShareAccessModalProps> = ({
  open,
  onClose,
  resourceType,
  resourceName,
  parentName,
  initialRBAC,
  onSave,
}) => {
  const { userInfo } = useAuth();
  const { users: tenantUsers, loading: loadingUsers } = useUsers();

  const currentUserId = userInfo?.id || '';
  const currentUsername = userInfo?.username || 'Current User';
  const currentUserEmail = (userInfo as unknown as Record<string, string>)?.email || '';

  // Whether RBAC is actively configured on this object
  const [rbacEnabled, setRbacEnabled] = useState(false);
  const [inherit, setInherit] = useState(true);
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Search/Add input state
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [candidateSearchText, setCandidateSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState<AccessRole>('editor');
  const [tenantWarning, setTenantWarning] = useState<string | null>(null);

  // Parse initial RBAC into state
  useEffect(() => {
    if (!open) return;
    setSaveError(null);
    setTenantWarning(null);
    setSelectedCandidate(null);
    setCandidateSearchText('');

    const hasActiveRules =
      Boolean(initialRBAC) &&
      (Boolean(initialRBAC?.read?.roles?.length) ||
        Boolean(initialRBAC?.read?.users?.length) ||
        Boolean(initialRBAC?.write?.roles?.length) ||
        Boolean(initialRBAC?.write?.users?.length) ||
        Boolean(initialRBAC?.admin?.roles?.length) ||
        Boolean(initialRBAC?.admin?.users?.length) ||
        Boolean(initialRBAC?.inherit));

    setRbacEnabled(hasActiveRules);
    setInherit(initialRBAC?.inherit !== false);

    // Build entry list
    const parsedEntries: AccessEntry[] = [];

    // Always ensure current user is Owner
    parsedEntries.push({
      id: currentUserId || 'owner',
      type: 'user',
      name: currentUsername,
      email: currentUserEmail,
      role: 'owner',
      isOwner: true,
    });

    if (initialRBAC) {
      const readUsers = initialRBAC.read?.users || [];
      const writeUsers = initialRBAC.write?.users || [];
      const adminUsers = initialRBAC.admin?.users || [];

      const readRoles = initialRBAC.read?.roles || [];
      const writeRoles = initialRBAC.write?.roles || [];
      const adminRoles = initialRBAC.admin?.roles || [];

      // Collect all unique user IDs
      const allUserIds = Array.from(new Set([...readUsers, ...writeUsers, ...adminUsers]));
      for (const uId of allUserIds) {
        if (uId === currentUserId || uId === currentUsername) continue;
        const matchedTenantUser = tenantUsers.find(
          (u) => u.id === uId || u.username === uId
        );
        let userRole: AccessRole = 'viewer';
        if (adminUsers.includes(uId)) {
          userRole = 'admin';
        } else if (writeUsers.includes(uId)) {
          userRole = 'editor';
        }

        parsedEntries.push({
          id: uId,
          type: 'user',
          name: matchedTenantUser?.username || uId,
          email: (matchedTenantUser as unknown as Record<string, string>)?.email || '',
          role: userRole,
          isOwner: false,
        });
      }

      // Collect all unique roles
      const allRoles = Array.from(new Set([...readRoles, ...writeRoles, ...adminRoles]));
      for (const rId of allRoles) {
        let roleRole: AccessRole = 'viewer';
        if (adminRoles.includes(rId)) {
          roleRole = 'admin';
        } else if (writeRoles.includes(rId)) {
          roleRole = 'editor';
        }

        const matchedDefaultRole = DEFAULT_ROLES.find((r) => r.id === rId);
        parsedEntries.push({
          id: rId,
          type: 'role',
          name: matchedDefaultRole?.name || `Role: ${rId}`,
          role: roleRole,
          isOwner: false,
        });
      }
    }

    setEntries(parsedEntries);
  }, [open, initialRBAC, currentUserId, currentUsername, currentUserEmail, tenantUsers]);

  // Autocomplete options: tenant users + default roles
  const autocompleteOptions = useMemo(() => {
    const options: any[] = [];

    // Add roles
    for (const r of DEFAULT_ROLES) {
      const alreadyAdded = entries.some((e) => e.id === r.id);
      if (!alreadyAdded) {
        options.push({
          id: r.id,
          label: r.name,
          category: 'Roles',
          type: 'role',
          subtext: r.description,
        });
      }
    }

    // Add tenant users
    for (const u of tenantUsers) {
      const alreadyAdded = entries.some((e) => e.id === u.id || e.id === u.username);
      if (!alreadyAdded) {
        const email = (u as unknown as Record<string, string>)?.email || '';
        options.push({
          id: u.id,
          username: u.username,
          label: `${u.username}${email ? ` (${email})` : ''}`,
          category: 'People in Organization',
          type: 'user',
          email,
        });
      }
    }

    return options;
  }, [tenantUsers, entries]);

  // Validate typed candidate against tenant boundary
  const handleInputChange = (_: any, newInputValue: string) => {
    setCandidateSearchText(newInputValue);
    if (!newInputValue.trim()) {
      setTenantWarning(null);
      return;
    }

    const trimmed = newInputValue.trim().toLowerCase();
    const matchesUser = tenantUsers.some(
      (u) =>
        u.username.toLowerCase() === trimmed ||
        u.id.toLowerCase() === trimmed ||
        ((u as unknown as Record<string, string>)?.email || '').toLowerCase() === trimmed
    );
    const matchesRole = DEFAULT_ROLES.some((r) => r.id.toLowerCase() === trimmed);

    if (!matchesUser && !matchesRole && trimmed.includes('@')) {
      setTenantWarning('User must exist in the current organization (for now)');
    } else {
      setTenantWarning(null);
    }
  };

  const handleAddCandidate = () => {
    if (!selectedCandidate) return;

    setRbacEnabled(true);
    setTenantWarning(null);

    const newEntry: AccessEntry = {
      id: selectedCandidate.id,
      type: selectedCandidate.type,
      name: selectedCandidate.username || selectedCandidate.label || selectedCandidate.id,
      email: selectedCandidate.email || '',
      role: selectedRole,
      isOwner: false,
    };

    setEntries((prev) => [...prev, newEntry]);
    setSelectedCandidate(null);
    setCandidateSearchText('');
  };

  const handleRoleChange = (id: string, newRole: AccessRole | 'remove') => {
    if (newRole === 'remove') {
      // Owner cannot be removed
      setEntries((prev) => prev.filter((e) => e.id !== id || e.isOwner));
      return;
    }

    setEntries((prev) =>
      prev.map((e) => (e.id === id && !e.isOwner ? { ...e, role: newRole } : e))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      // If RBAC is disabled or no custom rules were added beyond owner and inherit is default,
      // return null so it does NOTHING until roles are assigned
      const hasOtherRules = entries.some((e) => !e.isOwner);
      const isInheritOnly = resourceType === 'key' && inherit && !hasOtherRules;

      if (!rbacEnabled && !isInheritOnly) {
        await onSave(null);
        onClose();
        return;
      }

      // Build RBACConfig payload
      const readUsers: string[] = [];
      const writeUsers: string[] = [];
      const adminUsers: string[] = [];

      const readRoles: string[] = [];
      const writeRoles: string[] = [];
      const adminRoles: string[] = [];

      // Current user is always added to owner/admin
      if (currentUserId) {
        readUsers.push(currentUserId);
        writeUsers.push(currentUserId);
        adminUsers.push(currentUserId);
      }
      if (currentUsername && currentUsername !== currentUserId) {
        readUsers.push(currentUsername);
        writeUsers.push(currentUsername);
        adminUsers.push(currentUsername);
      }

      for (const entry of entries) {
        if (entry.isOwner) continue;

        if (entry.type === 'user') {
          if (entry.role === 'viewer') {
            readUsers.push(entry.id);
          } else if (entry.role === 'editor') {
            readUsers.push(entry.id);
            writeUsers.push(entry.id);
          } else if (entry.role === 'admin') {
            readUsers.push(entry.id);
            writeUsers.push(entry.id);
            adminUsers.push(entry.id);
          }
        } else if (entry.type === 'role') {
          if (entry.role === 'viewer') {
            readRoles.push(entry.id);
          } else if (entry.role === 'editor') {
            readRoles.push(entry.id);
            writeRoles.push(entry.id);
          } else if (entry.role === 'admin') {
            readRoles.push(entry.id);
            writeRoles.push(entry.id);
            adminRoles.push(entry.id);
          }
        }
      }

      const rbacConfig: RBACConfig = {
        inherit: resourceType === 'key' ? inherit : undefined,
        read: {
          users: Array.from(new Set(readUsers)),
          roles: Array.from(new Set(readRoles)),
        },
        write: {
          users: Array.from(new Set(writeUsers)),
          roles: Array.from(new Set(writeRoles)),
        },
        admin: {
          users: Array.from(new Set(adminUsers)),
          roles: Array.from(new Set(adminRoles)),
        },
      };

      await onSave(rbacConfig);
      onClose();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setRbacEnabled(false);
    setEntries((prev) => prev.filter((e) => e.isOwner));
    setInherit(true);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          border: '1px solid hsl(var(--border))',
          bgcolor: 'hsl(var(--card))',
          backgroundImage: 'none',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        },
      }}
    >
      <DialogTitle
        sx={{
          py: 2,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid hsl(var(--border))',
        }}
      >
        <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          Share &ldquo;{resourceName}&rdquo;
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{
            color: 'hsl(var(--muted-foreground))',
            '&:hover': { color: 'hsl(var(--foreground))' },
          }}
        >
          <CloseIcon size={18} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        {saveError && (
          <Alert severity="error" sx={{ mb: 2, fontSize: '0.82rem' }}>
            {saveError}
          </Alert>
        )}

        {/* Add people / roles input */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <Autocomplete
              fullWidth
              size="small"
              options={autocompleteOptions}
              groupBy={(option) => option.category}
              getOptionLabel={(option) => option.label || option.id}
              value={selectedCandidate}
              onChange={(_, newValue) => {
                setSelectedCandidate(newValue);
                setTenantWarning(null);
              }}
              inputValue={candidateSearchText}
              onInputChange={handleInputChange}
              loading={loadingUsers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Add people or roles in current organization"
                  helperText={
                    tenantWarning ? (
                      <Typography component="span" sx={{ color: 'hsl(var(--destructive))', fontSize: '0.75rem' }}>
                        {tenantWarning}
                      </Typography>
                    ) : undefined
                  }
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'hsl(var(--background))',
                      borderRadius: 1.5,
                      fontSize: '0.85rem',
                    },
                  }}
                />
              )}
            />

            <FormControl size="small" sx={{ minWidth: 105 }}>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as AccessRole)}
                sx={{
                  bgcolor: 'hsl(var(--background))',
                  borderRadius: 1.5,
                  fontSize: '0.85rem',
                  '& .MuiSelect-select': { py: 1 },
                }}
              >
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="editor">Editor</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              onClick={handleAddCandidate}
              disabled={!selectedCandidate || Boolean(tenantWarning)}
              sx={{
                height: 40,
                px: 2,
                borderRadius: 1.5,
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                bgcolor: 'hsl(var(--primary))',
                color: 'hsl(var(--primary-foreground))',
                '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
              }}
            >
              Add
            </Button>
          </Box>
        </Box>

        {/* Key inheritance option */}
        {resourceType === 'key' && (
          <Box
            sx={{
              mb: 3,
              p: 1.5,
              borderRadius: 2,
              border: '1px solid hsl(var(--border))',
              bgcolor: 'hsl(var(--muted) / 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                Inherit category permissions
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                {parentName
                  ? `Members with access to category "${parentName}" will automatically have access to this key`
                  : 'Inherit access rules from parent category'}
              </Typography>
            </Box>
            <Switch
              checked={inherit}
              onChange={(e) => {
                setInherit(e.target.checked);
                setRbacEnabled(true);
              }}
              color="primary"
            />
          </Box>
        )}

        {/* People with access list */}
        <Box sx={{ mb: 2 }}>
          <Typography
            sx={{
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'hsl(var(--muted-foreground))',
              mb: 1.5,
            }}
          >
            People with access
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {entries.map((entry) => {
              const initialLetter = (entry.name || 'U').charAt(0).toUpperCase();
              return (
                <Box
                  key={entry.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 0.75,
                    px: 1,
                    borderRadius: 1.5,
                    '&:hover': { bgcolor: 'hsl(var(--muted) / 0.15)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {/* Plain circular avatar with initial */}
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        bgcolor: entry.isOwner
                          ? '#ea580c'
                          : entry.type === 'role'
                          ? 'hsl(var(--secondary))'
                          : 'hsl(var(--muted))',
                        color: entry.isOwner
                          ? '#ffffff'
                          : 'hsl(var(--foreground))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        border: '1px solid hsl(var(--border))',
                        flexShrink: 0,
                      }}
                    >
                      {initialLetter}
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'hsl(var(--foreground))' }}>
                        {entry.name} {entry.isOwner && '(you)'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
                        {entry.email || (entry.type === 'role' ? 'Role-based access' : entry.id)}
                      </Typography>
                    </Box>
                  </Box>

                  {entry.isOwner ? (
                    <Typography
                      sx={{
                        fontSize: '0.85rem',
                        color: 'hsl(var(--muted-foreground))',
                        px: 1.5,
                        py: 0.5,
                        fontWeight: 500,
                      }}
                    >
                      Owner
                    </Typography>
                  ) : (
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={entry.role}
                        onChange={(e) => handleRoleChange(entry.id, e.target.value as any)}
                        sx={{
                          fontSize: '0.82rem',
                          bgcolor: 'hsl(var(--background))',
                          '& .MuiSelect-select': { py: 0.5, px: 1 },
                        }}
                      >
                        <MenuItem value="viewer">Viewer</MenuItem>
                        <MenuItem value="editor">Editor</MenuItem>
                        <MenuItem value="admin">Admin</MenuItem>
                        <Divider sx={{ my: 0.5 }} />
                        <MenuItem value="remove" sx={{ color: 'hsl(var(--destructive))' }}>
                          Remove access
                        </MenuItem>
                      </Select>
                    </FormControl>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RBAC Status info box */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: rbacEnabled ? 'hsl(var(--primary) / 0.08)' : 'hsl(var(--muted) / 0.2)',
            border: '1px solid',
            borderColor: rbacEnabled ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--border))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
              {rbacEnabled ? 'RBAC is Active' : 'Default Access (Inactive RBAC)'}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))' }}>
              {rbacEnabled
                ? 'Only members and roles explicitly listed above have access.'
                : 'All organization members have access based on their default workspace role.'}
            </Typography>
          </Box>

          {rbacEnabled && (
            <Button
              size="small"
              onClick={handleResetToDefault}
              sx={{
                fontSize: '0.75rem',
                textTransform: 'none',
                color: 'hsl(var(--destructive))',
                '&:hover': { bgcolor: 'hsl(var(--destructive) / 0.1)' },
              }}
            >
              Reset to default
            </Button>
          )}
        </Box>
      </DialogContent>

      <Divider sx={{ borderColor: 'hsl(var(--border))' }} />

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'flex-end', gap: 1 }}>
        <Button
          size="small"
          onClick={onClose}
          sx={{
            textTransform: 'none',
            fontSize: '0.85rem',
            color: 'hsl(var(--muted-foreground))',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          size="small"
          onClick={handleSave}
          disabled={isSaving}
          sx={{
            textTransform: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            px: 2.5,
            bgcolor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            '&:hover': { bgcolor: 'hsl(var(--primary) / 0.9)' },
          }}
        >
          {isSaving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
