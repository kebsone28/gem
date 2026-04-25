const LOCAL_DEPLOY_AGENT_URL =
  import.meta.env.VITE_LOCAL_DEPLOY_AGENT_URL || 'http://127.0.0.1:48631';

type LocalDeployHealth = {
  ok: boolean;
  busy?: boolean;
};

type LocalDeployResponse = {
  ok: boolean;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
};

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const probeLocalDeployAgent = async (): Promise<LocalDeployHealth | null> => {
  try {
    const response = await fetchWithTimeout(
      `${LOCAL_DEPLOY_AGENT_URL}/health`,
      { method: 'GET' },
      1200
    );

    if (!response.ok) return null;
    return (await response.json()) as LocalDeployHealth;
  } catch {
    return null;
  }
};

export const triggerLocalDeploy = async (commitMessage?: string): Promise<LocalDeployResponse> => {
  const response = await fetchWithTimeout(
    `${LOCAL_DEPLOY_AGENT_URL}/deploy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commitMessage,
        sshConfigHost: 'gem-vps',
        skipTests: false,
        skipCommit: false,
        skipPush: false,
        skipDeploy: false,
      }),
    },
    1000 * 60 * 15
  );

  const payload = (await response.json()) as LocalDeployResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || payload.stderr || 'Local deploy failed');
  }

  return payload;
};

export { LOCAL_DEPLOY_AGENT_URL };
