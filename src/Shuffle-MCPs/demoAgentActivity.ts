import type { AgentRun } from './agentActivity';

const NOW = Date.now();

export const DEMO_AGENT_RUNS: AgentRun[] = [
  {
    execution_id: 'demo-exec-incident-triage-01',
    workflow_id: 'AGENT',
    status: 'SUCCESS',
    started_at: String(NOW - 1000 * 60 * 18),
    completed_at: String(NOW - 1000 * 60 * 17),
    duration: 52,
    execution_source: 'Datastore automation',
    execution_argument: JSON.stringify({
      original_input: 'Alert INC-8921: host-prod-04 (10.0.4.15) detected communicating with suspicious destination 198.51.100.23:443. Investigate indicators, verify threat intelligence, and isolate endpoint if malicious.',
    }),
    workflow: {
      name: 'Incident Triage & Host Containment',
      description: 'Autonomous threat triage, IP reputation analysis, and endpoint response',
      actions: [
        { app_name: 'VirusTotal', label: 'Check IP Reputation' },
        { app_name: 'Shuffle Host Monitor', label: 'Isolate Host' },
        { app_name: 'Jira', label: 'Create Incident Ticket' },
      ],
    },
    decisions: [
      {
        i: 0,
        tool: 'VirusTotal',
        action: 'get_ip_report',
        fields: [{ key: 'ip', value: '198.51.100.23' }],
        reason: 'Verify reputation and threat intelligence scoring for destination IP 198.51.100.23.',
        confidence: 0.98,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 1120,
          result: {
            data: {
              attributes: {
                last_analysis_stats: {
                  malicious: 16,
                  suspicious: 4,
                  harmless: 65,
                  undetected: 10,
                },
                reputation: -48,
                as_owner: 'Hostinger International Ltd.',
                network: '198.51.100.0/24',
              },
            },
          },
        },
      },
      {
        i: 1,
        tool: 'Shuffle Host Monitor',
        action: 'isolate_host',
        fields: [
          { key: 'host_id', value: 'host-prod-04' },
          { key: 'reason', value: 'C2 beaconing detected to confirmed malicious IP 198.51.100.23' },
        ],
        reason: 'Host host-prod-04 has established repeated outbound TLS sessions to a confirmed Cobalt Strike C2 IP (16 detections on VirusTotal). Apply network isolation to stop potential lateral movement.',
        confidence: 0.96,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 680,
          result: {
            success: true,
            action: 'isolate_host',
            host_id: 'host-prod-04',
            isolated: true,
            rules_applied: ['block_all_outbound', 'allow_shuffle_daemon_inbound'],
            timestamp: Math.floor((NOW - 1000 * 60 * 17.5) / 1000),
          },
        },
      },
      {
        i: 2,
        tool: 'Jira',
        action: 'create_issue',
        fields: [
          { key: 'project', value: 'SOC' },
          { key: 'summary', value: 'Containment: host-prod-04 isolated due to Cobalt Strike C2 communication' },
          { key: 'priority', value: 'High' },
        ],
        reason: 'Create high-priority containment issue in Jira for Tier 2 SecOps analyst follow-up.',
        confidence: 0.99,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 490,
          result: {
            key: 'SOC-4029',
            id: '10982',
            self: 'https://jira.internal/rest/api/2/issue/10982',
            status: 'Open',
          },
        },
      },
    ],
    results: [
      {
        action: {
          app_name: 'AI Agent',
          label: 'AI Agent',
          id: 'agent_node_primary',
        },
        status: 'SUCCESS',
        result: JSON.stringify({
          status: 'SUCCESS',
          original_input: 'Alert INC-8921: host-prod-04 (10.0.4.15) detected communicating with suspicious destination 198.51.100.23:443. Investigate indicators, verify threat intelligence, and isolate endpoint if malicious.',
          allowed_actions: [
            'app:virustotal:VirusTotal',
            'app:host_monitors:Shuffle Host Monitor',
            'app:jira:Jira',
          ],
          output: `### Investigation & Remediation Report

- **Endpoint**: \`host-prod-04\` (IP: \`10.0.4.15\`)
- **Target Indicator**: \`198.51.100.23\` (AS200052, Hostinger International Ltd.)
- **Threat Intelligence**:
  - VirusTotal returned **16 malicious detections** and **4 suspicious flags**.
  - Indicator is associated with known Cobalt Strike command-and-control infrastructure.
- **Automated Actions Executed**:
  1. \`virustotal.get_ip_report\`: Retrieved live reputation score (\`-48\`).
  2. \`host_monitors.isolate_host\`: Applied endpoint network isolation on \`host-prod-04\`. Daemon connectivity preserved for remote forensics.
  3. \`jira.create_issue\`: Created ticket **SOC-4029** assigned to Tier 2 Incident Response.
- **Recommended Operator Next Steps**:
  - Acquire volatile memory image via Host Monitor.
  - Review local auditd logs for parent process spawning outbound curl or powershell commands.`,
          decisions: [
            {
              i: 0,
              tool: 'VirusTotal',
              action: 'get_ip_report',
              fields: [{ key: 'ip', value: '198.51.100.23' }],
              reason: 'Verify reputation and threat intelligence scoring for destination IP 198.51.100.23.',
              confidence: 0.98,
              approval_required: false,
              run_details: {
                status: 'SUCCESS',
                duration: 1120,
                result: {
                  data: {
                    attributes: {
                      last_analysis_stats: {
                        malicious: 16,
                        suspicious: 4,
                        harmless: 65,
                        undetected: 10,
                      },
                      reputation: -48,
                      as_owner: 'Hostinger International Ltd.',
                    },
                  },
                },
              },
            },
            {
              i: 1,
              tool: 'Shuffle Host Monitor',
              action: 'isolate_host',
              fields: [
                { key: 'host_id', value: 'host-prod-04' },
                { key: 'reason', value: 'C2 beaconing detected to confirmed malicious IP 198.51.100.23' },
              ],
              reason: 'Host host-prod-04 has established repeated outbound TLS sessions to a confirmed Cobalt Strike C2 IP (16 detections on VirusTotal). Apply network isolation to stop potential lateral movement.',
              confidence: 0.96,
              approval_required: false,
              run_details: {
                status: 'SUCCESS',
                duration: 680,
                result: {
                  success: true,
                  action: 'isolate_host',
                  host_id: 'host-prod-04',
                  isolated: true,
                  rules_applied: ['block_all_outbound', 'allow_shuffle_daemon_inbound'],
                },
              },
            },
            {
              i: 2,
              tool: 'Jira',
              action: 'create_issue',
              fields: [
                { key: 'project', value: 'SOC' },
                { key: 'summary', value: 'Containment: host-prod-04 isolated due to Cobalt Strike C2 communication' },
                { key: 'priority', value: 'High' },
              ],
              reason: 'Create high-priority containment issue in Jira for Tier 2 SecOps analyst follow-up.',
              confidence: 0.99,
              approval_required: false,
              run_details: {
                status: 'SUCCESS',
                duration: 490,
                result: {
                  key: 'SOC-4029',
                  id: '10982',
                  status: 'Open',
                },
              },
            },
          ],
          llm_requests: [
            {
              model: 'gemini-2.5-flash',
              temperature: 0.2,
              messages: [
                {
                  role: 'system',
                  content: 'You are an autonomous Shuffle SecOps Agent. You analyze security alerts, invoke MCP tools to enrich indicators, isolate compromised endpoints, and file tracking tickets.',
                },
                {
                  role: 'user',
                  content: 'Alert INC-8921: host-prod-04 (10.0.4.15) detected communicating with suspicious destination 198.51.100.23:443. Investigate indicators, verify threat intelligence, and isolate endpoint if malicious.',
                },
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'virustotal_get_ip_report',
                    description: 'Retrieve reputation, threat classification, and network ownership for an IP address.',
                    parameters: {
                      type: 'object',
                      properties: {
                        ip: { type: 'string', description: 'IPv4 or IPv6 address' },
                      },
                      required: ['ip'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'shuffle_host_monitors_isolate_host',
                    description: 'Enforce network isolation rules on a managed endpoint using the local daemon firewall.',
                    parameters: {
                      type: 'object',
                      properties: {
                        host_id: { type: 'string', description: 'Host identifier or hostname' },
                        reason: { type: 'string', description: 'Audit rationale for isolation' },
                      },
                      required: ['host_id'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'jira_create_issue',
                    description: 'Create an incident ticket in Jira.',
                    parameters: {
                      type: 'object',
                      properties: {
                        project: { type: 'string', description: 'Jira project key' },
                        summary: { type: 'string', description: 'Issue headline' },
                        priority: { type: 'string', description: 'Severity level' },
                      },
                      required: ['project', 'summary'],
                    },
                  },
                },
              ],
            },
          ],
          llm_responses: [
            {
              id: 'chatcmpl-demo-91823',
              choices: [
                {
                  index: 0,
                  finish_reason: 'tool_calls',
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_vt_ip_01',
                        type: 'function',
                        function: {
                          name: 'virustotal_get_ip_report',
                          arguments: '{"ip":"198.51.100.23"}',
                        },
                      },
                    ],
                  },
                },
              ],
              usage: {
                prompt_tokens: 1420,
                completion_tokens: 42,
                total_tokens: 1462,
              },
            },
          ],
        }),
      },
    ],
    result: JSON.stringify({
      status: 'SUCCESS',
      original_input: 'Alert INC-8921: host-prod-04 (10.0.4.15) detected communicating with suspicious destination 198.51.100.23:443. Investigate indicators, verify threat intelligence, and isolate endpoint if malicious.',
      output: '### Investigation & Remediation Report\n\n- **Endpoint**: `host-prod-04` (IP: `10.0.4.15`)\n- **Target Indicator**: `198.51.100.23` (AS200052, Hostinger International Ltd.)\n- **Threat Intelligence**: VirusTotal returned 16 malicious detections.\n- **Actions Executed**: Host isolated, Jira ticket SOC-4029 opened.',
      decisions: [
        {
          i: 0,
          tool: 'VirusTotal',
          action: 'get_ip_report',
          fields: [{ key: 'ip', value: '198.51.100.23' }],
          reason: 'Verify reputation and threat intelligence scoring for destination IP 198.51.100.23.',
          confidence: 0.98,
          approval_required: false,
        },
        {
          i: 1,
          tool: 'Shuffle Host Monitor',
          action: 'isolate_host',
          fields: [{ key: 'host_id', value: 'host-prod-04' }],
          reason: 'Host host-prod-04 communicating with verified C2 IP. Applied network isolation.',
          confidence: 0.96,
          approval_required: false,
        },
      ],
    }),
  },
  {
    execution_id: 'demo-exec-vulnerability-audit-02',
    workflow_id: 'AGENT',
    status: 'SUCCESS',
    started_at: String(NOW - 1000 * 60 * 125),
    completed_at: String(NOW - 1000 * 60 * 123),
    duration: 84,
    execution_source: 'Schedule',
    execution_argument: JSON.stringify({
      original_input: 'Audit Linux fleet for CVE-2024-6387 (regreSSHion). Identify exposed servers and propose mitigation configurations.',
    }),
    workflow: {
      name: 'Vulnerability Fleet Auditor',
      description: 'Scans endpoints and advisory feeds for active CVE exposure',
      actions: [
        { app_name: 'OSV Advisory', label: 'Query Package Advisory' },
        { app_name: 'Shuffle Host Monitor', label: 'Inspect SSH Config' },
        { app_name: 'Slack', label: 'Notify SOC' },
      ],
    },
    decisions: [
      {
        i: 0,
        tool: 'OSV Advisory',
        action: 'query_package',
        fields: [
          { key: 'package_name', value: 'openssh-server' },
          { key: 'ecosystem', value: 'Debian' },
        ],
        reason: 'Lookup OSV vulnerability database for openssh-server vulnerabilities affecting Debian/Ubuntu installations.',
        confidence: 0.99,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 940,
          result: {
            vulns: [
              {
                id: 'CVE-2024-6387',
                summary: 'signal handler race condition in OpenSSH server (regreSSHion)',
                affected_versions: ['8.5p1 through 9.7p1'],
                fixed: ['9.8p1-1'],
              },
            ],
          },
        },
      },
      {
        i: 1,
        tool: 'Shuffle Host Monitor',
        action: 'remote_control',
        fields: [
          { key: 'host_id', value: 'bastion-01' },
          { key: 'command', value: 'grep -E "^LoginGraceTime" /etc/ssh/sshd_config || echo "default"' },
        ],
        reason: 'Check if LoginGraceTime is explicitly configured on perimeter bastion-01.',
        confidence: 0.95,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 720,
          result: {
            stdout: 'LoginGraceTime 120\n',
            exit_code: 0,
          },
        },
      },
      {
        i: 2,
        tool: 'Slack',
        action: 'send_message',
        fields: [
          { key: 'channel', value: '#soc-vulnerabilities' },
          { key: 'message', value: 'CVE-2024-6387 exposure identified on 3 perimeter bastions. LoginGraceTime workaround recommended.' },
        ],
        reason: 'Post fleet audit alert to SecOps Slack channel.',
        confidence: 0.97,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 310,
          result: { ok: true, channel: 'C0591823', ts: '1726055812.019200' },
        },
      },
    ],
    results: [
      {
        action: {
          app_name: 'AI Agent',
          label: 'AI Agent',
          id: 'agent_node_vuln',
        },
        status: 'SUCCESS',
        result: JSON.stringify({
          status: 'SUCCESS',
          original_input: 'Audit Linux fleet for CVE-2024-6387 (regreSSHion). Identify exposed servers and propose mitigation configurations.',
          allowed_actions: [
            'app:osv_advisory:OSV Advisory',
            'app:host_monitors:Shuffle Host Monitor',
            'app:slack:Slack',
          ],
          output: `### Fleet Exposure Assessment: CVE-2024-6387 (regreSSHion)

- **Vulnerability**: Unauthenticated Remote Code Execution in OpenSSH server via signal handler race condition.
- **Scanned Systems**: 14 Debian/Ubuntu fleet endpoints evaluated.
- **Affected Endpoints**:
  - \`bastion-01\` (\`openssh-server 9.2p1-2\`, \`LoginGraceTime 120\`)
  - \`bastion-02\` (\`openssh-server 9.2p1-2\`, \`LoginGraceTime 120\`)
  - \`bastion-03\` (\`openssh-server 8.9p1-3\`, default grace period)
- **Mitigation Recommended**:
  - Setting \`LoginGraceTime 0\` in \`/etc/ssh/sshd_config\` prevents exploitation by denying the timing race condition until package update 9.8p1 can be deployed.
- **Notification**: Alert published to \`#soc-vulnerabilities\`.`,
          decisions: [
            {
              i: 0,
              tool: 'OSV Advisory',
              action: 'query_package',
              fields: [{ key: 'package_name', value: 'openssh-server' }],
              reason: 'Lookup OSV vulnerability database for CVE-2024-6387.',
              confidence: 0.99,
              approval_required: false,
            },
            {
              i: 1,
              tool: 'Shuffle Host Monitor',
              action: 'remote_control',
              fields: [{ key: 'host_id', value: 'bastion-01' }],
              reason: 'Inspect sshd_config for LoginGraceTime setting.',
              confidence: 0.95,
              approval_required: false,
            },
          ],
          llm_requests: [
            {
              model: 'gemini-2.5-flash',
              temperature: 0.2,
              messages: [
                {
                  role: 'system',
                  content: 'You are an autonomous vulnerability analyst. You query OSV advisories and verify system configuration parameters.',
                },
                {
                  role: 'user',
                  content: 'Audit Linux fleet for CVE-2024-6387 (regreSSHion). Identify exposed servers and propose mitigation configurations.',
                },
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'osv_query_package',
                    description: 'Query OSV database for known package vulnerabilities.',
                    parameters: {
                      type: 'object',
                      properties: {
                        package_name: { type: 'string' },
                        ecosystem: { type: 'string' },
                      },
                      required: ['package_name'],
                    },
                  },
                },
              ],
            },
          ],
          llm_responses: [
            {
              id: 'chatcmpl-demo-vuln-01',
              choices: [
                {
                  index: 0,
                  finish_reason: 'tool_calls',
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_osv_01',
                        type: 'function',
                        function: {
                          name: 'osv_query_package',
                          arguments: '{"package_name":"openssh-server","ecosystem":"Debian"}',
                        },
                      },
                    ],
                  },
                },
              ],
              usage: {
                prompt_tokens: 1180,
                completion_tokens: 36,
                total_tokens: 1216,
              },
            },
          ],
        }),
      },
    ],
    result: JSON.stringify({
      status: 'SUCCESS',
      original_input: 'Audit Linux fleet for CVE-2024-6387 (regreSSHion). Identify exposed servers and propose mitigation configurations.',
      output: '### Fleet Exposure Assessment: CVE-2024-6387\n\n- Scanned 14 systems; 3 perimeter bastions vulnerable.\n- Applied workaround advice (LoginGraceTime 0). Alert posted to Slack.',
      decisions: [],
    }),
  },
  {
    execution_id: 'demo-exec-phishing-triage-03',
    workflow_id: 'AGENT',
    status: 'WAITING',
    started_at: String(NOW - 1000 * 60 * 35),
    duration: 38,
    execution_source: 'Webhook',
    execution_argument: JSON.stringify({
      original_input: 'User reported email with subject "Urgent: Payroll Direct Deposit Verification Required". Analyze headers, embedded links, and attachment.',
    }),
    workflow: {
      name: 'Phishing Email Triage',
      description: 'Extracts observables from reported messages, submits URLs to sandbox, and requests tenant purge approval',
      actions: [
        { app_name: 'URLScan', label: 'Submit URL' },
        { app_name: 'VirusTotal', label: 'Check Domain' },
        { app_name: 'Google Workspace', label: 'Quarantine Email' },
      ],
    },
    decisions: [
      {
        i: 0,
        tool: 'URLScan',
        action: 'submit_url',
        fields: [{ key: 'url', value: 'hxxps://auth-portal-verify[.]com/direct-deposit' }],
        reason: 'Submit suspicious payroll login URL to sandbox for behavioral analysis and screenshot capture.',
        confidence: 0.97,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 2100,
          result: {
            page: {
              title: 'Microsoft 365 Single Sign-On',
              domain: 'auth-portal-verify.com',
              ip: '203.0.113.88',
            },
            verdicts: {
              malicious: true,
              score: 100,
              categories: ['phishing', 'credential_harvesting'],
            },
          },
        },
      },
      {
        i: 1,
        tool: 'Google Workspace',
        action: 'quarantine_message',
        fields: [
          { key: 'message_id', value: '<202409110941.x829@external-relay.net>' },
          { key: 'subject', value: 'Urgent: Payroll Direct Deposit Verification Required' },
          { key: 'action', value: 'tenant_wide_purge' },
        ],
        reason: 'URL confirmed as credential harvesting landing page. Requesting analyst confirmation before purging identical messages across the entire organization.',
        confidence: 0.99,
        approval_required: true,
        run_details: {
          status: 'WAITING',
          result: {
            prompt: 'Approve tenant-wide purge of 14 received instances of "Urgent: Payroll Direct Deposit Verification Required"?',
            target_count: 14,
          },
        },
      },
    ],
    results: [
      {
        action: {
          app_name: 'AI Agent',
          label: 'AI Agent',
          id: 'agent_node_phish',
        },
        status: 'WAITING',
        result: JSON.stringify({
          status: 'WAITING',
          original_input: 'User reported email with subject "Urgent: Payroll Direct Deposit Verification Required". Analyze headers, embedded links, and attachment.',
          allowed_actions: [
            'app:urlscan:URLScan',
            'app:virustotal:VirusTotal',
            'app:google_workspace:Google Workspace',
          ],
          output: `### Phishing Analysis: Action Required

- **Subject**: \`Urgent: Payroll Direct Deposit Verification Required\`
- **Sender**: \`payroll-update@secure-hr-notice[.]com\` (SPF Softfail, DMARC Fail)
- **Extracted Link**: \`hxxps://auth-portal-verify[.]com/direct-deposit\`
- **URLScan Sandbox Verdict**: **Malicious (Score 100)**. Cloned Microsoft 365 credential harvester.
- **Tenant Scope**: 14 employees in Accounting and Sales received this message.
- **Current Status**: **WAITING FOR APPROVAL** to execute tenant-wide quarantine via Google Workspace.`,
          decisions: [
            {
              i: 0,
              tool: 'URLScan',
              action: 'submit_url',
              fields: [{ key: 'url', value: 'hxxps://auth-portal-verify[.]com/direct-deposit' }],
              reason: 'Analyze suspicious link in sandbox.',
              confidence: 0.97,
              approval_required: false,
            },
            {
              i: 1,
              tool: 'Google Workspace',
              action: 'quarantine_message',
              fields: [{ key: 'action', value: 'tenant_wide_purge' }],
              reason: 'Purge phishing message from 14 recipient mailboxes.',
              confidence: 0.99,
              approval_required: true,
            },
          ],
          llm_requests: [
            {
              model: 'gemini-2.5-flash',
              temperature: 0.1,
              messages: [
                {
                  role: 'system',
                  content: 'You are an autonomous Phishing Triage Agent. You extract observables, scan links, and protect recipient mailboxes.',
                },
                {
                  role: 'user',
                  content: 'User reported email with subject "Urgent: Payroll Direct Deposit Verification Required". Analyze headers, embedded links, and attachment.',
                },
              ],
              tools: [
                {
                  type: 'function',
                  function: {
                    name: 'urlscan_submit_url',
                    description: 'Submit suspicious URL for sandbox scanning.',
                    parameters: {
                      type: 'object',
                      properties: { url: { type: 'string' } },
                      required: ['url'],
                    },
                  },
                },
                {
                  type: 'function',
                  function: {
                    name: 'google_workspace_quarantine_message',
                    description: 'Purge or quarantine phishing message across all tenant inboxes.',
                    parameters: {
                      type: 'object',
                      properties: { message_id: { type: 'string' }, action: { type: 'string' } },
                      required: ['message_id'],
                    },
                  },
                },
              ],
            },
          ],
          llm_responses: [
            {
              id: 'chatcmpl-demo-phish-01',
              choices: [
                {
                  index: 0,
                  finish_reason: 'tool_calls',
                  message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [
                      {
                        id: 'call_urlscan_01',
                        type: 'function',
                        function: {
                          name: 'urlscan_submit_url',
                          arguments: '{"url":"hxxps://auth-portal-verify[.]com/direct-deposit"}',
                        },
                      },
                    ],
                  },
                },
              ],
              usage: {
                prompt_tokens: 1530,
                completion_tokens: 40,
                total_tokens: 1570,
              },
            },
          ],
        }),
      },
    ],
    result: JSON.stringify({
      status: 'WAITING',
      original_input: 'User reported email with subject "Urgent: Payroll Direct Deposit Verification Required". Analyze headers, embedded links, and attachment.',
      output: '### Phishing Analysis: Action Required\n\n- Cloned credential harvester detected.\n- Paused waiting for analyst approval to purge 14 tenant mailboxes.',
      decisions: [],
    }),
  },
  {
    execution_id: 'demo-exec-ssh-bruteforce-04',
    workflow_id: 'AGENT',
    status: 'SUCCESS',
    started_at: String(NOW - 1000 * 60 * 240),
    completed_at: String(NOW - 1000 * 60 * 239),
    duration: 31,
    execution_source: 'Manual',
    execution_argument: JSON.stringify({
      original_input: 'Correlate recent failed SSH authentication spikes on db-primary. Identify source subnets and verify whether any logins succeeded.',
    }),
    workflow: {
      name: 'Authentication Anomaly Investigation',
      description: 'Queries auth logs and correlates failed vs successful sessions',
      actions: [
        { app_name: 'Shuffle Host Monitor', label: 'Query Auth Logs' },
        { app_name: 'AlienVault OTX', label: 'Lookup Subnet Pulse' },
      ],
    },
    decisions: [
      {
        i: 0,
        tool: 'Shuffle Host Monitor',
        action: 'remote_control',
        fields: [
          { key: 'host_id', value: 'db-primary' },
          { key: 'command', value: 'grep -E "Failed password|Accepted password" /var/log/auth.log | tail -n 100' },
        ],
        reason: 'Retrieve recent SSH authentication attempts from db-primary.',
        confidence: 0.98,
        approval_required: false,
        run_details: {
          status: 'SUCCESS',
          duration: 540,
          result: {
            stdout: '1,420 failed password attempts for invalid user root from 203.0.113.45. Zero accepted sessions.',
            exit_code: 0,
          },
        },
      },
    ],
    results: [
      {
        action: {
          app_name: 'AI Agent',
          label: 'AI Agent',
          id: 'agent_node_auth',
        },
        status: 'SUCCESS',
        result: JSON.stringify({
          status: 'SUCCESS',
          original_input: 'Correlate recent failed SSH authentication spikes on db-primary. Identify source subnets and verify whether any logins succeeded.',
          allowed_actions: [
            'app:host_monitors:Shuffle Host Monitor',
            'app:alienvault_otx:AlienVault OTX',
          ],
          output: `### Authentication Anomaly Summary: db-primary

- **Event**: 1,420 failed SSH login attempts recorded over a 15-minute window.
- **Attacker IP**: \`203.0.113.45\`
- **Target Usernames**: Common dictionaries (\`root\`, \`admin\`, \`postgres\`, \`ubuntu\`).
- **Success Status**: **0 successful logins**. Public key authentication remains enforced on \`db-primary\`.
- **Action Taken**: Host-level fail2ban triggered automatically, dropping packets from source IP.`,
          decisions: [
            {
              i: 0,
              tool: 'Shuffle Host Monitor',
              action: 'remote_control',
              fields: [{ key: 'host_id', value: 'db-primary' }],
              reason: 'Query auth.log on db-primary.',
              confidence: 0.98,
              approval_required: false,
            },
          ],
          llm_requests: [
            {
              model: 'gemini-2.5-flash',
              temperature: 0.1,
              messages: [
                {
                  role: 'system',
                  content: 'You are an autonomous incident response agent.',
                },
                {
                  role: 'user',
                  content: 'Correlate recent failed SSH authentication spikes on db-primary. Identify source subnets and verify whether any logins succeeded.',
                },
              ],
              tools: [],
            },
          ],
          llm_responses: [
            {
              id: 'chatcmpl-demo-auth-01',
              choices: [
                {
                  index: 0,
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: 'Querying authentication logs on db-primary to analyze failed password attempts.',
                  },
                },
              ],
              usage: {
                prompt_tokens: 950,
                completion_tokens: 28,
                total_tokens: 978,
              },
            },
          ],
        }),
      },
    ],
    result: JSON.stringify({
      status: 'SUCCESS',
      original_input: 'Correlate recent failed SSH authentication spikes on db-primary. Identify source subnets and verify whether any logins succeeded.',
      output: '### Authentication Anomaly Summary: db-primary\n\n- 1,420 failed password attempts from 203.0.113.45. Zero successful logins.',
      decisions: [],
    }),
  },
];
