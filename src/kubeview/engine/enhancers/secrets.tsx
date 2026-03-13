import React from 'react';
import type { ResourceEnhancer } from './index';
import type { K8sResource } from '../renderers/index';

export const secretEnhancer: ResourceEnhancer = {
  matches: ['v1/secrets'],

  columns: [
    {
      id: 'type',
      header: 'Type',
      accessorFn: (resource) => {
        return resource.type ?? 'Opaque';
      },
      render: (value) => {
        const type = String(value);
        const shortType = type.replace('kubernetes.io/', '');

        let color = 'bg-gray-100 text-gray-800';
        if (type.includes('tls')) {
          color = 'bg-green-100 text-green-800';
        } else if (type.includes('token') || type.includes('service-account')) {
          color = 'bg-blue-100 text-blue-800';
        } else if (type.includes('dockercfg') || type.includes('dockerconfigjson')) {
          color = 'bg-purple-100 text-purple-800';
        }

        return (
          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${color}`} title={type}>
            {shortType}
          </span>
        );
      },
      sortable: true,
      priority: 10,
    },
    {
      id: 'keys',
      header: 'Data Keys',
      accessorFn: (resource) => {
        const data = resource.data as Record<string, unknown> | undefined;
        const keys = data ? Object.keys(data) : [];
        return keys.length;
      },
      render: (value, resource) => {
        const count = Number(value);
        const data = resource.data as Record<string, unknown> | undefined;
        const keys = data ? Object.keys(data) : [];

        if (count === 0) {
          return <span className="text-gray-400">0</span>;
        }

        const keyList = keys.slice(0, 3).join(', ');
        const remaining = count - 3;
        const title = keys.join(', ');

        return (
          <div className="flex items-center">
            <span className="font-mono text-sm text-gray-700 mr-2">{count}</span>
            <span className="text-xs text-gray-500" title={title}>
              {keyList}
              {remaining > 0 && ` +${remaining}`}
            </span>
          </div>
        );
      },
      sortable: true,
      priority: 11,
    },
  ],

  defaultSort: { column: 'name', direction: 'asc' },
};
