import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE_URL = 'https://www.cathaybk.com.tw/cathaybk/service/newwealth/search/search.asmx/ETFSearch';
const OUTPUT_PATH = new URL('../data/cathay-etfs.json', import.meta.url);
const EXCHANGES = {
  NYSE: { tradingView: 'AMEX', market: 'US' },
  NASDAQ: { tradingView: 'NASDAQ', market: 'US' },
  CboeBZX: { tradingView: 'CBOE', market: 'US' },
  TOKYO: { tradingView: 'TSE', market: 'JP' },
  HKE: { tradingView: 'HKEX', market: 'HK' },
  TWSE: { tradingView: 'TWSE', market: 'TW' },
  OTC: { tradingView: 'TPEX', market: 'TW' }
};

const response = await fetch(SOURCE_URL, { headers: { 'user-agent': 'Top50ETF universe sync' } });
if (!response.ok) throw new Error(`Cathay ETF source returned ${response.status}`);
const payload = await response.json();
if (payload.statusCode !== 200 || !Array.isArray(payload.Data)) throw new Error('Cathay ETF source did not return a valid ETF list');

const items = payload.Data.map(item => {
  const exchange = EXCHANGES[item.EB100100];
  if (!exchange || !item.EB100010) return null;
  const code = String(item.EB100010).trim();
  const tradingViewCode = code.replace(/\.(JP|HK|TW)$/i, '');
  const name = item.CUB_ETF_NAME && item.CUB_ETF_NAME !== '-' ? item.CUB_ETF_NAME : item.BANKENAME;
  return {
    symbol: `${exchange.tradingView}:${tradingViewCode}`,
    ticker: code,
    label: name || code,
    market: exchange.market,
    cathayExchange: item.EB100100,
    bankFundId: item.BANKFUNDID
  };
}).filter(Boolean).sort((a, b) => a.market.localeCompare(b.market) || a.ticker.localeCompare(b.ticker));

const duplicates = items.filter((item, index) => items.findIndex(candidate => candidate.symbol === item.symbol) !== index);
if (duplicates.length) throw new Error(`Duplicate TradingView symbols: ${duplicates.map(item => item.symbol).join(', ')}`);

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(OUTPUT_PATH, `${JSON.stringify({
  source: SOURCE_URL,
  syncedAt: new Date().toISOString(),
  count: items.length,
  items
}, null, 2)}\n`);
console.log(`Wrote ${items.length} Cathay-saleable ETF symbols.`);
