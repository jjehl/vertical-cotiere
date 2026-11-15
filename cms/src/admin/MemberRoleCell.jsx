import React, { useRef, useState } from 'react';
import { useFetchClient, useNotification } from '@strapi/strapi/admin';
import { useDocumentRBAC, unstable_useDocumentActions as useDocumentActions } from '@strapi/content-manager/strapi-admin';
import { Box, SingleSelect, SingleSelectOption, Typography } from '@strapi/design-system';

const model = 'plugin::users-permissions.user';

function MemberRoleCell({ member }) {
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const { canUpdate, canUpdateFields, isLoading: checkingPermissions } = useDocumentRBAC('MemberRoleCell', state => state);
  const { update } = useDocumentActions();
  const [roles, setRoles] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const current = member.role;
  const editable = !checkingPermissions && canUpdate && (canUpdateFields.length === 0 || canUpdateFields.includes('role'));

  async function loadRoles(open) {
    if (!open || roles || loading) return;
    setLoading(true);
    try {
      // Use the same relation endpoint and permissions as the member edit form.
      const options = [];
      let page = 1, pageCount = 1;
      do {
        const { data } = await get(`/content-manager/relations/${model}/role`, {
          params: { page, pageSize: 100, filters: { type: { $ne: 'public' } } },
        });
        options.push(...data.results);
        pageCount = data.pagination.pageCount;
        page++;
      } while (page <= pageCount);
      setRoles(options);
    } catch {
      toggleNotification({ type: 'danger', message: 'Impossible de charger les rôles. Rouvrez le menu pour réessayer.' });
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(value) {
    const role = roles?.find(option => String(option.id) === String(value));
    if (!editable || busy.current || !role || String(current?.id) === String(value)) return;
    busy.current = true;
    setSaving(true);
    try {
      // Strapi checks entry and field permissions, reports errors and refreshes its list cache.
      await update({ collectionType: 'collection-types', model, documentId: member.documentId }, { role: role.id });
    } catch {
      // useDocumentActions already displays the error; keep the persisted selection.
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (!editable) return <Typography textColor="neutral800">{current?.name || '—'}</Typography>;
  const options = roles?.some(role => role.id === current?.id) ? roles : [...(current ? [current] : []), ...(roles || [])];
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ') || member.username || member.documentId;
  return (
    <Box minWidth="220px" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <SingleSelect
        aria-label={`Rôle membre de ${name}`}
        value={current?.id == null ? '' : String(current.id)}
        placeholder="Choisir un rôle"
        disabled={saving}
        loading={loading || saving}
        onOpenChange={loadRoles}
        onChange={changeRole}
      >
        {options.map(role => <SingleSelectOption key={role.id} value={String(role.id)}>{role.name}</SingleSelectOption>)}
      </SingleSelect>
    </Box>
  );
}

export function memberRoleColumns({ displayedHeaders, ...rest }) {
  return {
    ...rest,
    displayedHeaders: displayedHeaders.map(header => header.name === 'role' && header.attribute?.target === 'plugin::users-permissions.role'
      ? { ...header, label: 'Rôle membre', cellFormatter: (member, column, context) => context.model === model
        ? <MemberRoleCell key={member.documentId} member={member} />
        : header.cellFormatter?.(member, column, context) || <Typography>{member.role?.name || '—'}</Typography> }
      : header),
  };
}
