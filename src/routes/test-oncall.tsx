import { createFileRoute } from '@tanstack/react-router';
import OnCallScheduleManager from '@/components/users/OnCallScheduleManager';

const users = [
  { id: 'demo-user-1', username: 'Ada Chen', role: 'admin', active: true },
  { id: 'demo-user-2', username: 'Ben Okafor', role: 'user', active: true },
  { id: 'demo-user-3', username: 'Cara Smith', role: 'user', active: false },
];

export const Route = createFileRoute('/test-oncall')({
  component: () => (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <OnCallScheduleManager users={users} loading={false} />
    </div>
  ),
});
