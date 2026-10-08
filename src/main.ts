import './style.css';

const appRoot = document.querySelector<HTMLElement>('#app');

if (!appRoot) {
  throw new Error('Operator console root element not found.');
}

appRoot.innerHTML = `
  <section class="mx-auto max-w-3xl px-4 py-8 text-slate-900">
    <header class="mb-6">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        ImageForge
      </p>
      <h1 class="mt-2 text-3xl font-bold text-slate-900">운영자 콘솔</h1>
    </header>

    <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="mb-4 flex gap-2">
        <button type="button" data-mode="url" class="mode-button rounded-lg border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white shadow-sm">URL</button>
        <button type="button" data-mode="prefix" class="mode-button rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700">Prefix</button>
      </div>

      <div class="mb-4">
        <label for="service-select" class="mb-2 block text-sm font-medium text-slate-700">
          서비스
        </label>
        <select
          id="service-select"
          class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-base text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          aria-label="서비스 선택"
          disabled
        >
          <option value="">서비스 목록을 불러오는 중...</option>
        </select>
      </div>

      <div class="mb-4">
        <label for="path-input" class="mb-2 block text-sm font-medium text-slate-700">
          경로 입력
        </label>
        <textarea
          id="path-input"
          rows="6"
          class="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="/images/logo.png?width=800\n/images/banner.jpg?format=webp"
        ></textarea>
      </div>

      <div class="flex items-center justify-end gap-3">
        <button
          id="execute-button"
          type="button"
          class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          실행
        </button>
      </div>

      <div class="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" id="catalog-status">
        서비스 목록을 불러오고 있습니다.
      </div>

      <div id="result-area" class="mt-4 space-y-2"></div>
    </div>
  </section>
`;

const serviceSelect = document.querySelector<HTMLSelectElement>('#service-select');
const catalogStatus = document.querySelector<HTMLElement>('#catalog-status');
const pathInput = document.querySelector<HTMLTextAreaElement>('#path-input');
const resultArea = document.querySelector<HTMLElement>('#result-area');
const executeButton = document.querySelector<HTMLButtonElement>('#execute-button');
const modeButtons = [...document.querySelectorAll<HTMLButtonElement>('.mode-button')];

let selectedMode: 'url' | 'prefix' = 'url';

function setMode(mode: 'url' | 'prefix'): void {
  selectedMode = mode;

  for (const button of modeButtons) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('border-sky-600', active);
    button.classList.toggle('bg-sky-600', active);
    button.classList.toggle('text-white', active);
    button.classList.toggle('border-slate-300', !active);
    button.classList.toggle('bg-slate-100', !active);
    button.classList.toggle('text-slate-700', !active);
  }

  if (!pathInput) {
    return;
  }

  pathInput.placeholder =
    mode === 'url'
      ? '/images/logo.png?width=800\n/images/banner.jpg?format=webp'
      : '/images/';
}

function renderErrors(messages: string[]): void {
  if (!resultArea) {
    return;
  }

  resultArea.innerHTML = messages
    .map((message) => `<div class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">${message}</div>`)
    .join('');
}

function renderResults(payload: {
  notice?: string;
  results?: Array<{ target: string; success: boolean; reason?: string }>;
}): void {
  if (!resultArea) {
    return;
  }

  const blocks: string[] = [];

  if (payload.notice) {
    blocks.push(
      `<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${payload.notice}</div>`,
    );
  }

  const results = payload.results ?? [];
  for (const result of results) {
    const stateLabel = result.success ? '성공' : '실패';
    const reasonText = result.reason ? `: ${result.reason}` : '';
    blocks.push(
      `<div class="rounded-lg border ${result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-700'} px-3 py-2 text-sm">
        <div class="font-medium">${result.target}</div>
        <div class="mt-1">${stateLabel}${reasonText}</div>
      </div>`,
    );
  }

  resultArea.innerHTML = blocks.join('');
}

async function loadCatalog(): Promise<void> {
  if (!serviceSelect || !catalogStatus) {
    return;
  }

  try {
    const response = await fetch('/purge/catalog', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`Catalog request failed: ${response.status}`);
    }

    const payload = (await response.json()) as { services?: string[] };
    const services = Array.isArray(payload.services)
      ? payload.services.filter(
          (service): service is string =>
            typeof service === 'string' && service.trim().length > 0,
        )
      : [];

    serviceSelect.innerHTML = '';

    if (services.length === 0) {
      const fallback = document.createElement('option');
      fallback.value = '';
      fallback.textContent = '사용 가능한 서비스가 없습니다.';
      serviceSelect.append(fallback);
      serviceSelect.disabled = true;
      catalogStatus.textContent = '서비스 목록이 비어 있습니다.';
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '서비스를 선택하세요';
    serviceSelect.append(placeholder);

    for (const service of services) {
      const option = document.createElement('option');
      option.value = service;
      option.textContent = service;
      serviceSelect.append(option);
    }

    serviceSelect.disabled = false;
    catalogStatus.textContent = `${services.length}개의 서비스가 로드되었습니다.`;
  } catch {
    serviceSelect.innerHTML = '<option value="">서비스 목록을 불러오지 못했습니다.</option>';
    serviceSelect.disabled = true;
    catalogStatus.textContent = '유효한 서비스 catalog를 불러오지 못했습니다.';
  }
}

async function executePurge(): Promise<void> {
  if (!serviceSelect || !pathInput || !resultArea || !executeButton) {
    return;
  }

  const service = serviceSelect.value.trim();
  const rawPathText = pathInput.value;

  if (!service) {
    renderErrors(['서비스를 선택해주세요.']);
    return;
  }

  if (selectedMode === 'url') {
    const lines = rawPathText.split(/\r?\n/).map((line) => line.trim());
    if (lines.length === 0 || lines.every((line) => line.length === 0)) {
      renderErrors(['빈 경로는 허용하지 않습니다.']);
      return;
    }

    if (lines.some((line) => line.length === 0)) {
      renderErrors(['빈 경로 행이 포함되어 있어 요청을 처리할 수 없습니다.']);
      return;
    }

    executeButton.disabled = true;
    executeButton.textContent = '처리 중...';

    try {
      const response = await fetch('/purge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'url', service, paths: lines }),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        errors?: string[];
        notice?: string;
        results?: Array<{ target: string; success: boolean; reason?: string }>;
      };

      if (!response.ok || payload.ok === false) {
        renderErrors(payload.errors ?? ['업스트림 요청을 처리할 수 없습니다.']);
        return;
      }

      renderResults(payload);
    } catch {
      renderErrors(['요청 처리 중 오류가 발생했습니다.']);
    } finally {
      executeButton.disabled = false;
      executeButton.textContent = '실행';
    }
    return;
  }

  renderErrors(['Prefix 모드는 아직 지원하지 않습니다.']);
}

for (const button of modeButtons) {
  button.addEventListener('click', () => {
    setMode(button.dataset.mode as 'url' | 'prefix');
  });
}

executeButton?.addEventListener('click', () => {
  void executePurge();
});

setMode('url');
void loadCatalog();
