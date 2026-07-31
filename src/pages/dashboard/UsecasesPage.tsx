/**
 * UsecasesPage — host wrapper around the standalone Shuffle-Core
 * implementation. Injects host-owned slots (currently: the same Webhook
 * ingestion button used on /incidents) into the usecase detail view so
 * /usecases/siem_alerts and /usecases/edr_alerts expose the exact same
 * enable/disable control next to "Source".
 */
import { Usecases, API_CONFIG } from '@/Shuffle-Core';
import { WebhookIngestionButton, type WebhookIngestionInfo } from '@/components/incidents/WebhookIngestionButton';
import { useWebhookStatus } from '@/hooks/useWebhookStatus';
import { useVulnerabilityAutomationStatus, VULNERABILITY_WORKFLOW_LABELS } from '@/hooks/useVulnerabilityAutomationStatus';
import { VulnerabilityReadinessBanner } from '@/components/vulnerabilities/VulnerabilityReadinessBanner';
import { useWorkflows } from '@/hooks/useWorkflows';
import { IncidentRoutingEditor } from '@/components/settings/IncidentRoutingEditor';
import MonitorsView from '@/Shuffle-Core/views/monitors/MonitorsView';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';

const WEBHOOK_FLOW_IDS = new Set(['siem_case_management_1', 'edr_case_management_1']);

/** Vulnerability usecases — they all read from the exact same status hook
 *  (`useVulnerabilityAutomationStatus`) as /vulnerabilities. */
const VULNERABILITY_FLOW_IDS = new Set([
  'asset_management_case_management_vuln_1',
  'vulnerability_ingestion_1',
]);

interface UsecasesPageProps {
  isLoaded?: boolean;
  isLoggedIn?: boolean;
  userdata?: any;
  globalUrl?: string;
}

const UsecasesPage = (props: UsecasesPageProps = {}) => {
  const webhook = useWebhookStatus();
  const vulnAutomation = useVulnerabilityAutomationStatus();
  const { refetch } = useWorkflows();
  const { resolvedTheme } = useTheme();
  const { userInfo } = useAuth();

  const info: WebhookIngestionInfo = {
    url: webhook.url,
    exists: webhook.exists,
    enabled: webhook.enabled,
    workflowId: null,
  };

  return (
    <Usecases
      globalUrl={API_CONFIG.baseUrl}
      theme={resolvedTheme}
      userdata={userInfo as any}
      isLoaded={true}
      isLoggedIn={!!userInfo}
      {...props}
      renderEndpointSlot={({ flowId, side }) => {
        if (side !== 'source') return null;
        if (VULNERABILITY_FLOW_IDS.has(flowId)) {
          const vulnInfo: WebhookIngestionInfo = {
            url: vulnAutomation.webhook.url ?? null,
            exists: vulnAutomation.webhook.exists,
            enabled: vulnAutomation.webhook.active,
            workflowId: null,
          };
          return {
            node: (
              <WebhookIngestionButton
                webhook={vulnInfo}
                workflowLabel={VULNERABILITY_WORKFLOW_LABELS.webhook}
                onToggled={() => vulnAutomation.refresh()}
              />
            ),
            enabled: vulnAutomation.webhook.active,
          } as any;
        }
        if (!WEBHOOK_FLOW_IDS.has(flowId)) return null;
        return {
          node: <WebhookIngestionButton webhook={info} onToggled={() => refetch()} />,
          enabled: !!webhook.enabled,
        } as any;
      }}
      renderUsecaseDetailSlot={({ flowId }) => {
        if (VULNERABILITY_FLOW_IDS.has(flowId)) {
          // Exact same readiness checker as /vulnerabilities.
          return <VulnerabilityReadinessBanner status={vulnAutomation} />;
        }
        if (flowId !== 'case_management_incident_routing_1') return null;
        // Same component used on /preferences — single source of truth so
        // changes apply in both places.
        return <IncidentRoutingEditor forceShow />;
      }}
      renderUsecaseActionModal={({ modal, open, onClose }) => {
        // Embed the same Add Host dialog from /monitors directly in the
        // usecase sidebar so users can deploy a monitor without navigating.
        if (modal !== 'add-host' || !open) return null;
        return <MonitorsView mode="add-host-dialog" onClose={onClose} />;
      }}
    />
  );
};

export default UsecasesPage;
