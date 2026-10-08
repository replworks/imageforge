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

    <form class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

      <div class="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" id="catalog-status">
        서비스 목록을 불러오고 있습니다.
      </div>
    </form>
  </section>
`;

const serviceSelect = document.querySelector<HTMLSelectElement>('#service-select');
const catalogStatus = document.querySelector<HTMLElement>('#catalog-status');

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
      ? payload.services.filter((service): service is string => typeof service === 'string' && service.trim().length > 0)
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

void loadCatalog();
