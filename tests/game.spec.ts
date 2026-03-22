import { test, expect, Page } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────────────────────

async function injectConfig(
  page: Page,
  config: { version?: number; seed?: number; noSuddenReset?: boolean; tooGoodTime?: number; noObstacles?: boolean }
) {
  await page.addInitScript((cfg) => {
    window.__GAME_CONFIG__ = cfg;
  }, config);
}

async function gotoGame(
  page: Page,
  version?: number,
  seed = 0,
  extra?: { tooGoodTime?: number; noObstacles?: boolean }
) {
  if (version !== undefined) {
    await injectConfig(page, {
      version,
      seed,
      noSuddenReset: true,
      noObstacles: extra?.noObstacles ?? true,  // default: disable obstacles in tests
      tooGoodTime: extra?.tooGoodTime,
    });
  }
  await page.goto('/');
}

async function clickStart(page: Page) {
  await page.click('button:has-text("시작하기")');
}

async function waitForEnding(page: Page, timeout = 10000) {
  await page.waitForSelector('button:has-text("다시 도전")', { timeout });
}

async function reachSystemErrorEnding(page: Page) {
  // version=5, seed=0 → errorTime=10s, roll=(0%3)=0 → system_error
  await gotoGame(page, 5, 0);
  await clickStart(page);
  await page.locator('button:has-text("확인")').waitFor({ state: 'visible', timeout: 15000 });
  await page.click('button:has-text("확인")');
  await waitForEnding(page, 5000);
}

// ── 인트로 화면 ───────────────────────────────────────────────────────────────

test.describe('인트로 화면', () => {
  test('제목, 부제목, 시작 버튼이 렌더된다', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('h1')).toHaveText('60초 챌린지');
    await expect(page.locator('text=60초를 채우면 상품이 있습니다')).toBeVisible();
    await expect(page.locator('button:has-text("시작하기")')).toBeVisible();
  });

  test('닉네임이 "#숫자" 형식으로 표시된다', async ({ page }) => {
    await gotoGame(page);
    // Nickname is set client-side via useEffect; wait for it
    const wrapper = page.locator('text=오늘의 닉네임').locator('..');
    await expect(wrapper.locator('p').last()).toContainText('#', { timeout: 3000 });
  });

  test('처음엔 엔딩 도감 버튼(링크)이 없다', async ({ page }) => {
    await gotoGame(page);
    await expect(page.locator('button:has-text("엔딩 도감")')).not.toBeVisible();
  });

  test('엔딩 수집 후 인트로에서 엔딩 도감 버튼이 나타난다', async ({ page }) => {
    await reachSystemErrorEnding(page);
    // 도감 보기 → ← 버튼으로 인트로로 복귀 (컬렉션 보유 상태)
    await page.click('button:has-text("도감 보기")');
    await page.locator('text=엔딩 도감').first().waitFor();
    await page.click('text=←');
    await expect(page.locator('button:has-text("엔딩 도감")')).toBeVisible({ timeout: 3000 });
  });
});

// ── 게임 플레이 기본 ──────────────────────────────────────────────────────────

test.describe('게임 플레이 기본', () => {
  test('시작하기 누르면 "/ 60" 표시가 나타난다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    await expect(page.locator('text=/ 60')).toBeVisible();
  });

  test('타이머 숫자가 0 이상 렌더된다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    const num = await page.locator('span.text-7xl').first().textContent();
    expect(Number(num)).toBeGreaterThanOrEqual(0);
  });

  test('3초 후 숫자가 증가한다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    await page.waitForTimeout(1500);
    const before = Number(await page.locator('span.text-7xl').first().textContent());
    await page.waitForTimeout(2000);
    const after = Number(await page.locator('span.text-7xl').first().textContent());
    expect(after).toBeGreaterThan(before);
  });

  test('플레이 중 버전 이름이 표시된다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    await expect(page.locator('text=기본 챌린지')).toBeVisible();
  });

  test('프로그레스 바가 렌더된다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    const bar = page.locator('.rounded-full.h-5 > div');
    await expect(bar).toBeVisible();
  });

  test('남은 시간 텍스트가 표시된다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    await expect(page.locator('text=초 남았습니다')).toBeVisible();
  });
});

// ── 버전 1: 타임 오류 ─────────────────────────────────────────────────────────

test.describe('버전 1 — 타임 오류', () => {
  test('글리치 발생 전까지 정상 타이머가 보인다', async ({ page }) => {
    await gotoGame(page, 1);
    await clickStart(page);
    await expect(page.locator('text=/ 60')).toBeVisible();
    await expect(page.locator('.glitch-number')).not.toBeVisible();
  });
});

// ── 버전 2: 역주행 ────────────────────────────────────────────────────────────

test.describe('버전 2 — 역주행', () => {
  test('14초 후 "역주행 중" 텍스트가 나타난다', async ({ page }) => {
    // seed=0 → reverseStart = 14 + (0%10) = 14s
    await gotoGame(page, 2, 0);
    await clickStart(page);
    await expect(page.locator('text=역주행 중')).toBeVisible({ timeout: 20000 });
  });

  test('역주행 시 프로그레스 바가 파란색 그라디언트로 바뀐다', async ({ page }) => {
    await gotoGame(page, 2, 0);
    await clickStart(page);
    await page.locator('text=역주행 중').waitFor({ timeout: 20000 });
    const bar = page.locator('.rounded-full.h-5 > div');
    const cls = await bar.getAttribute('class');
    expect(cls).toContain('blue');
  });

  test('역주행 엔딩이 수집된다', async ({ page }) => {
    test.setTimeout(50000);
    // seed=0 → reverseStart=14s, ends at t=36s (14+22), plus 1.2s delay → ~38s total
    await gotoGame(page, 2, 0);
    await clickStart(page);
    await waitForEnding(page, 45000);
    await expect(page.locator('text=역주행')).toBeVisible();
  });
});

// ── 버전 3: 암흑 ─────────────────────────────────────────────────────────────

test.describe('버전 3 — 암흑', () => {
  test('18초 후 dark-overlay가 DOM에 추가된다', async ({ page }) => {
    // seed=0 → darkenStart = 18 + (0%8) = 18s
    await gotoGame(page, 3, 0);
    await clickStart(page);
    await page.locator('.dark-overlay').waitFor({ state: 'attached', timeout: 25000 });
    await expect(page.locator('.dark-overlay')).toBeAttached();
  });

  test('정전 엔딩이 수집된다', async ({ page }) => {
    test.setTimeout(50000);
    // darken at 18s, darkLevel reaches 0.97 at ~18+16.2=34.2s, plus 0.4s delay → ~35s
    await gotoGame(page, 3, 0);
    await clickStart(page);
    await waitForEnding(page, 45000);
    await expect(page.locator('text=정전')).toBeVisible();
  });
});

// ── 버전 4: 아이템 챌린지 ────────────────────────────────────────────────────

test.describe('버전 4 — 아이템 챌린지', () => {
  test('14초 후 ⭐ 아이템이 나타난다', async ({ page }) => {
    // seed=0 → powerupTime = 14 + (0%5) = 14s
    await gotoGame(page, 4, 0);
    await clickStart(page);
    const item = page.locator('button').filter({ hasText: '아이템!' });
    await item.waitFor({ state: 'visible', timeout: 20000 });
    await expect(item).toBeVisible();
  });

  test('⭐ 아이템 클릭 → item_trap 엔딩', async ({ page }) => {
    await gotoGame(page, 4, 0);
    await clickStart(page);
    const item = page.locator('button').filter({ hasText: '아이템!' });
    await item.waitFor({ state: 'visible', timeout: 20000 });
    // force:true bypasses animation-transform positioning checks
    await item.click({ force: true });
    await waitForEnding(page, 5000);
    await expect(page.locator('text=아이템 함정')).toBeVisible();
  });

  test('28초 후 🛡️ 방패가 나타난다', async ({ page }) => {
    test.setTimeout(40000);
    // seed=0 → shieldTime = 28 + (0%7) = 28s
    // Shield button renders with class item-shield-glow (not text "방패")
    await gotoGame(page, 4, 0);
    await clickStart(page);
    const shield = page.locator('button').filter({ has: page.locator('.item-shield-glow') });
    await shield.waitFor({ state: 'visible', timeout: 35000 });
    await expect(shield).toBeVisible();
  });

  test('🛡️ 방패 클릭 → shield_boom 엔딩', async ({ page }) => {
    test.setTimeout(40000);
    await gotoGame(page, 4, 0);
    await clickStart(page);
    const shield = page.locator('button').filter({ has: page.locator('.item-shield-glow') });
    await shield.waitFor({ state: 'visible', timeout: 35000 });
    await shield.click({ force: true });
    await waitForEnding(page, 5000);
    await expect(page.locator('text=방패 폭발')).toBeVisible();
  });

  test('아이템 무시 시 "너무 잘함" 팝업이 뜬다', async ({ page }) => {
    // tooGoodTime=8 so we don't wait 50s in real time
    await gotoGame(page, 4, 0, { tooGoodTime: 8 });
    await clickStart(page);
    await expect(page.locator('text=너무 잘 하셔서')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('button:has-text("다시 도전하기")')).toBeVisible();
  });

  test('너무 잘함 "다시 도전하기" → 엔딩 화면으로 이동', async ({ page }) => {
    await gotoGame(page, 4, 0, { tooGoodTime: 8 });
    await clickStart(page);
    await page.locator('button:has-text("다시 도전하기")').waitFor({ timeout: 12000 });
    await page.click('button:has-text("다시 도전하기")');
    await expect(page.locator('text=너무 잘함')).toBeVisible({ timeout: 3000 });
  });
});

// ── 버전 5: 에러 챌린지 ──────────────────────────────────────────────────────

test.describe('버전 5 — 에러 챌린지', () => {
  test('seed=0 → 시스템 오류 모달이 나타난다', async ({ page }) => {
    // seed=0: errorTime = 10 + (0%18) = 10s, roll=(0%3)=0 → system_error
    await gotoGame(page, 5, 0);
    await clickStart(page);
    await expect(page.locator('text=치명적인 오류가 발생했습니다')).toBeVisible({ timeout: 15000 });
  });

  test('시스템 오류 확인 클릭 → system_error 엔딩', async ({ page }) => {
    await gotoGame(page, 5, 0);
    await clickStart(page);
    await page.locator('button:has-text("확인")').waitFor({ state: 'visible', timeout: 15000 });
    await page.click('button:has-text("확인")');
    await waitForEnding(page, 3000);
    await expect(page.locator('text=시스템 오류')).toBeVisible();
  });

  test('seed=1 → 업데이트 필요 모달이 나타난다', async ({ page }) => {
    // seed=1: roll=(1%3)=1 → update_required
    await gotoGame(page, 5, 1);
    await clickStart(page);
    await expect(page.locator('text=버전 1.0.0 지원 종료')).toBeVisible({ timeout: 15000 });
  });

  test('업데이트 모달 → update_required 엔딩', async ({ page }) => {
    await gotoGame(page, 5, 1);
    await clickStart(page);
    await page.locator('text=버전 1.0.0 지원 종료').waitFor({ timeout: 15000 });
    await page.locator('button').filter({ hasText: '업데이트' }).click();
    await waitForEnding(page, 3000);
    await expect(page.locator('text=업데이트 필요')).toBeVisible();
  });

  test('seed=2 → 바이러스 발견 모달이 나타난다', async ({ page }) => {
    // seed=2: roll=(2%3)=2 → virus_found
    await gotoGame(page, 5, 2);
    await clickStart(page);
    await expect(page.locator('text=바이러스 발견!')).toBeVisible({ timeout: 15000 });
  });

  test('바이러스 모달 → virus_found 엔딩', async ({ page }) => {
    await gotoGame(page, 5, 2);
    await clickStart(page);
    await page.locator('text=바이러스 발견!').waitFor({ timeout: 15000 });
    await page.locator('button').filter({ hasText: '위협 제거' }).click();
    await waitForEnding(page, 3000);
    await expect(page.locator('h2:has-text("바이러스 발견")')).toBeVisible();
  });
});

// ── 엔딩 화면 ─────────────────────────────────────────────────────────────────

test.describe('엔딩 화면', () => {
  test('희귀도 배지, 이모지, 제목이 표시된다', async ({ page }) => {
    await reachSystemErrorEnding(page);
    await expect(page.locator('text=엔딩 획득!')).toBeVisible();
    await expect(page.locator('text=시스템 오류')).toBeVisible();
    await expect(page.locator('text=희귀')).toBeVisible();
  });

  test('메시지 박스가 렌더된다', async ({ page }) => {
    await reachSystemErrorEnding(page);
    await expect(page.locator('text=FATAL: 0x0000DEAD')).toBeVisible();
  });

  test('수집 진행도 텍스트가 표시된다', async ({ page }) => {
    await reachSystemErrorEnding(page);
    await expect(page.locator('text=수집한 엔딩:')).toBeVisible();
    await expect(page.locator('text=1 / 11')).toBeVisible();
  });

  test('다시 도전 → 게임 재시작', async ({ page }) => {
    await reachSystemErrorEnding(page);
    await page.click('button:has-text("다시 도전")');
    await expect(page.locator('text=/ 60')).toBeVisible({ timeout: 5000 });
  });

  test('도감 보기 → 컬렉션 화면', async ({ page }) => {
    await reachSystemErrorEnding(page);
    await page.click('button:has-text("도감 보기")');
    await expect(page.locator('h2:has-text("엔딩 도감")')).toBeVisible();
  });
});

// ── 엔딩 도감 ─────────────────────────────────────────────────────────────────

test.describe('엔딩 도감', () => {
  async function openCollection(page: Page) {
    await reachSystemErrorEnding(page);
    await page.click('button:has-text("도감 보기")');
    await page.locator('h2:has-text("엔딩 도감")').waitFor();
  }

  test('전체 11개 엔딩 카드가 렌더된다', async ({ page }) => {
    await openCollection(page);
    const cards = page.locator('.grid > div');
    await expect(cards).toHaveCount(11);
  });

  test('획득한 엔딩은 이름이 보인다', async ({ page }) => {
    await openCollection(page);
    await expect(page.locator('text=시스템 오류')).toBeVisible();
  });

  test('미획득 엔딩은 ??? 로 표시된다', async ({ page }) => {
    await openCollection(page);
    const locked = page.locator('.grid > div').filter({ hasText: '???' });
    expect(await locked.count()).toBeGreaterThan(0);
  });

  test('수집 진행도 퍼센트가 표시된다', async ({ page }) => {
    await openCollection(page);
    // 1/11 ≈ 9%
    await expect(page.locator('text=9%')).toBeVisible();
  });

  test('← 버튼으로 인트로로 돌아간다', async ({ page }) => {
    await openCollection(page);
    await page.click('text=←');
    await expect(page.locator('h1:has-text("60초 챌린지")')).toBeVisible();
  });
});

// ── 콘솔 에러 없음 ─────────────────────────────────────────────────────────────

test.describe('콘솔 에러 없음', () => {
  test('인트로 로드 시 콘솔 에러가 없다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('게임 시작 후 3초간 콘솔 에러가 없다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await gotoGame(page, 1);
    await clickStart(page);
    await page.waitForTimeout(3000);
    expect(errors).toEqual([]);
  });

  test('에러 모달 확인 후 콘솔 에러가 없다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));
    await reachSystemErrorEnding(page);
    expect(errors).toEqual([]);
  });
});
