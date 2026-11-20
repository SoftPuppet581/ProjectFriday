import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice, storeLinks, steamClientLink, newsSearchLink } from '../src/lib/stores.js';

describe('formatPrice', () => {
  test('정가는 원화 쉼표 표기', () => {
    assert.deepEqual(formatPrice({ final: 79800, initial: 79800, discountPercent: 0, onSale: false }), {
      kind: 'paid', text: '₩79,800', originalText: null, discountText: null,
    });
  });

  test('할인 중이면 현재가, 원가, 할인율', () => {
    assert.deepEqual(formatPrice({ final: 41920, initial: 59900, discountPercent: 30, onSale: true }), {
      kind: 'sale', text: '₩41,920', originalText: '₩59,900', discountText: '-30%',
    });
  });

  test('0원은 무료, 가격이 없으면 가격 미정', () => {
    assert.equal(formatPrice({ final: 0, initial: 0, onSale: false }).text, '무료');
    assert.equal(formatPrice({ final: 0, initial: 0, onSale: false }).kind, 'free');
    for (const empty of [null, undefined, {}, { final: '1000' }]) {
      assert.deepEqual(formatPrice(empty), { kind: 'unknown', text: '가격 미정', originalText: null, discountText: null });
    }
  });

  test('onSale인데 원가가 현재가 이하면 할인으로 보지 않는다 (잘못된 데이터 방어)', () => {
    assert.equal(formatPrice({ final: 5000, initial: 5000, discountPercent: 10, onSale: true }).kind, 'paid');
  });
});

describe('storeLinks', () => {
  const steam = { name: 'Steam', url: 'https://store.steampowered.com/app/10/' };
  const ps = { name: 'PlayStation Store', url: 'https://store.playstation.com/x' };

  test('스토어 이름을 key로 바꾸고 상품 페이지(store)로 표시', () => {
    const links = storeLinks({ stores: [steam, ps], steamStoreUrl: steam.url, steamSearchUrl: 'https://store.steampowered.com/search/?term=x' });
    assert.deepEqual(links, [
      { key: 'steam', label: 'Steam', url: steam.url, kind: 'store' },
      { key: 'playstation', label: 'PlayStation Store', url: ps.url, kind: 'store' },
    ]);
  });

  test('Steam 상품이 없으면 "Steam에서 검색" 링크를 맨 뒤에 붙인다', () => {
    const links = storeLinks({ stores: [ps], steamStoreUrl: null, steamSearchUrl: 'https://store.steampowered.com/search/?term=x' });
    assert.deepEqual(links.map((l) => [l.key, l.kind]), [['playstation', 'store'], ['steam-search', 'search']]);
  });

  test('스토어가 하나도 없어도 Steam 검색 링크는 나온다', () => {
    const links = storeLinks({ stores: [], steamStoreUrl: null, steamSearchUrl: 'https://store.steampowered.com/search/?term=x' });
    assert.deepEqual(links.map((l) => l.key), ['steam-search']);
  });

  test('steamStoreUrl만 있고 stores에 Steam이 없으면 Steam을 맨 앞에 넣는다', () => {
    const links = storeLinks({ stores: [ps], steamStoreUrl: 'https://store.steampowered.com/app/5/', steamSearchUrl: 'x' });
    assert.deepEqual(links.map((l) => l.key), ['steam', 'playstation']);
  });

  test('모르는 스토어 이름은 key가 store, 게임이 비어 있어도 에러 없음', () => {
    assert.equal(storeLinks({ stores: [{ name: '기타 스토어', url: 'https://x.example/' }] })[0].key, 'store');
    assert.deepEqual(storeLinks(null), []);
    assert.deepEqual(storeLinks({}), []);
  });
});

describe('steamClientLink / newsSearchLink', () => {
  test('값이 있으면 그대로, 없으면 null', () => {
    assert.equal(steamClientLink({ steamClientUrl: 'steam://store/10' }), 'steam://store/10');
    assert.equal(steamClientLink({ steamClientUrl: null }), null);
    assert.equal(steamClientLink(undefined), null);
    assert.equal(newsSearchLink({ newsSearchUrl: 'https://search.naver.com/x' }), 'https://search.naver.com/x');
    assert.equal(newsSearchLink(null), null);
  });
});
